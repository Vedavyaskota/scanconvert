const UNIT_TO_BASE = {
  l: { base: 'l', factor: 1 },
  ml: { base: 'l', factor: 0.001 },
  gal: { base: 'l', factor: 3.78541 },
  qt: { base: 'l', factor: 0.946353 },
  pt: { base: 'l', factor: 0.473176 },
  fl_oz: { base: 'l', factor: 0.0295735 },
  cup: { base: 'l', factor: 0.236588 },
  kg: { base: 'kg', factor: 1 },
  g: { base: 'kg', factor: 0.001 },
  lb: { base: 'kg', factor: 0.453592 },
  oz: { base: 'kg', factor: 0.0283495 },
};

const UNIT_LABELS = {
  l: 'L', ml: 'mL', gal: 'gal', qt: 'qt', pt: 'pt',
  fl_oz: 'fl oz', cup: 'cup', kg: 'kg', g: 'g', lb: 'lb', oz: 'oz',
};

const CURRENCY_SYMBOLS = {
  USD: '$', INR: '₹', EUR: '€', GBP: '£',
  CAD: 'C$', AUD: 'A$', JPY: '¥',
};

let scanner = null;
let scanning = false;
let currentProduct = null;
let exchangeRates = {};
let ratesFetchedAt = 0;

async function fetchRates(base) {
  const now = Date.now();
  if (exchangeRates[base] && now - ratesFetchedAt < 3600000) {
    return exchangeRates[base];
  }
  try {
    const resp = await fetch(`https://api.exchangerate-api.com/v4/latest/${base}`);
    const data = await resp.json();
    exchangeRates[base] = data.rates;
    ratesFetchedAt = now;
    return data.rates;
  } catch {
    showToast('Could not fetch exchange rates', true);
    return null;
  }
}

function parseQuantity(product) {
  const q = product.quantity || product.product_quantity || '';
  const qUnit = product.quantity_unit || '';

  const match = q.toString().match(/([\d.]+)\s*(ml|cl|l|fl\s*oz|gal|gallon|qt|quart|pt|pint|cup|kg|g|lb|oz|liter|litre|milliliter|millilitre|gram|kilogram|pound|ounce)/i);
  if (match) {
    const val = parseFloat(match[1]);
    const raw = match[2].toLowerCase().replace(/\s+/g, '');
    const unitMap = {
      ml: 'ml', cl: 'ml', l: 'l', liter: 'l', litre: 'l',
      milliliter: 'ml', millilitre: 'ml',
      'floz': 'fl_oz', gal: 'gal', gallon: 'gal',
      qt: 'qt', quart: 'qt', pt: 'pt', pint: 'pt', cup: 'cup',
      kg: 'kg', g: 'g', gram: 'g', kilogram: 'kg',
      lb: 'lb', pound: 'lb', oz: 'oz', ounce: 'oz',
    };
    const unit = unitMap[raw] || raw;
    const adjustedVal = raw === 'cl' ? val * 10 : val;
    return { value: adjustedVal, unit };
  }

  if (product.product_quantity && qUnit) {
    const unitMap = { ml: 'ml', l: 'l', g: 'g', kg: 'kg', oz: 'oz', lb: 'lb' };
    return {
      value: parseFloat(product.product_quantity),
      unit: unitMap[qUnit.toLowerCase()] || qUnit.toLowerCase(),
    };
  }

  return null;
}

function setSmartDefaults(parsedQty) {
  if (!parsedQty) return;
  const unitInfo = UNIT_TO_BASE[parsedQty.unit];
  if (!unitInfo) return;

  const unitTo = document.getElementById('unit-to');
  if (unitInfo.base === 'l') {
    unitTo.value = parsedQty.unit === 'gal' ? 'l' : (parsedQty.unit === 'l' ? 'gal' : 'l');
  } else {
    unitTo.value = parsedQty.unit === 'kg' ? 'lb' : (parsedQty.unit === 'lb' ? 'kg' : 'kg');
  }
}

async function lookupProduct(upc) {
  show('loading');
  hide('product-card');

  try {
    const resp = await fetch(`https://world.openfoodfacts.org/api/v0/product/${upc}.json`);
    const data = await resp.json();

    if (data.status !== 1) {
      showToast('Product not found. Try entering details manually.', true);
      hide('loading');
      return;
    }

    const p = data.product;
    currentProduct = {
      name: p.product_name || p.product_name_en || 'Unknown Product',
      brand: p.brands || 'Unknown Brand',
      image: p.image_front_small_url || p.image_url || '',
      upc,
      category: (p.categories_tags || [])[0]?.replace('en:', '') || 'General',
      quantity: parseQuantity(p),
      raw: p,
    };

    renderProduct();
    addToHistory(currentProduct);

  } catch {
    showToast('Network error. Please try again.', true);
  }

  hide('loading');
}

function renderProduct() {
  const p = currentProduct;
  document.getElementById('product-name').textContent = p.name;
  document.getElementById('product-brand').textContent = p.brand;
  document.getElementById('product-upc').textContent = p.upc;
  document.getElementById('product-category').textContent = p.category.replace(/-/g, ' ');

  const img = document.getElementById('product-img');
  if (p.image) {
    img.src = p.image;
    img.style.display = 'block';
  } else {
    img.style.display = 'none';
  }

  if (p.quantity) {
    document.getElementById('original-size').textContent =
      `${p.quantity.value} ${UNIT_LABELS[p.quantity.unit] || p.quantity.unit}`;
    setSmartDefaults(p.quantity);
    hide('manual-size-section');
  } else {
    document.getElementById('original-size').textContent = 'Not available';
    show('manual-size-section');
    document.getElementById('manual-size-value').value = '';
  }

  show('product-card');
  hide('result-card');
  hide('direct-convert-card');
  document.getElementById('price-input').value = '';
  document.getElementById('price-input').focus();
}

async function convert() {
  const priceStr = document.getElementById('price-input').value;
  const price = parseFloat(priceStr);
  const fromCurrency = document.getElementById('currency-from').value;
  const toCurrency = document.getElementById('currency-to').value;

  if (!price) {
    hide('direct-convert-card');
    hide('result-card');
    return;
  }

  let rate = 1;
  if (fromCurrency !== toCurrency) {
    const rates = await fetchRates(fromCurrency);
    if (!rates || !rates[toCurrency]) {
      showToast('Exchange rate unavailable', true);
      return;
    }
    rate = rates[toCurrency];
  }

  const fromSym = CURRENCY_SYMBOLS[fromCurrency] || fromCurrency;
  const toSym = CURRENCY_SYMBOLS[toCurrency] || toCurrency;
  const directConverted = price * rate;

  document.getElementById('direct-from-price').textContent =
    `${fromSym}${price.toFixed(2)}`;
  document.getElementById('direct-to-price').textContent =
    `${toSym}${directConverted.toFixed(2)}`;
  document.getElementById('direct-rate-text').textContent =
    fromCurrency === toCurrency
      ? 'Same currency'
      : `1 ${fromCurrency} = ${rate.toFixed(4)} ${toCurrency}`;
  show('direct-convert-card');

  if (!currentProduct?.quantity) {
    hide('result-card');
    return;
  }

  const toUnit = document.getElementById('unit-to').value;
  const qty = currentProduct.quantity;
  const fromUnitInfo = UNIT_TO_BASE[qty.unit];
  const toUnitInfo = UNIT_TO_BASE[toUnit];

  if (!fromUnitInfo || !toUnitInfo || fromUnitInfo.base !== toUnitInfo.base) {
    showToast('Cannot convert between weight and volume', true);
    hide('result-card');
    return;
  }

  const baseAmount = qty.value * fromUnitInfo.factor;
  const pricePerBase = price / baseAmount;
  const convertedQty = toUnitInfo.factor;
  const pricePerTargetUnit = pricePerBase * convertedQty;
  const finalPrice = pricePerTargetUnit * rate;

  document.getElementById('result-price').textContent =
    `${toSym}${finalPrice.toFixed(2)}`;
  document.getElementById('result-unit').textContent =
    `per ${UNIT_LABELS[toUnit] || toUnit}`;

  document.getElementById('bk-original').textContent =
    `${fromSym}${price.toFixed(2)} / ${qty.value} ${UNIT_LABELS[qty.unit]}`;
  document.getElementById('bk-unit').textContent =
    `${qty.value} ${UNIT_LABELS[qty.unit]} → ${UNIT_LABELS[toUnit]}`;
  document.getElementById('bk-rate').textContent =
    fromCurrency === toCurrency
      ? 'Same currency'
      : `1 ${fromCurrency} = ${rate.toFixed(4)} ${toCurrency}`;

  show('result-card');
}

async function toggleScanner() {
  const btn = document.getElementById('scan-btn');
  const container = document.getElementById('scanner-container');

  if (scanning) {
    if (scanner) {
      await scanner.stop();
      scanner.clear();
    }
    scanning = false;
    container.classList.remove('active');
    btn.innerHTML = '<span class="icon">📷</span> Start Scanner';
    btn.classList.remove('scanning');
    return;
  }

  scanning = true;
  container.classList.add('active');
  btn.innerHTML = '<span class="icon">⏹</span> Stop Scanner';
  btn.classList.add('scanning');

  try {
    scanner = new Html5Qrcode('reader');
    await scanner.start(
      { facingMode: 'environment' },
      {
        fps: 10,
        qrbox: { width: 250, height: 100 },
        aspectRatio: 1.5,
        formatsToSupport: [
          Html5QrcodeSupportedFormats.EAN_13,
          Html5QrcodeSupportedFormats.EAN_8,
          Html5QrcodeSupportedFormats.UPC_A,
          Html5QrcodeSupportedFormats.UPC_E,
          Html5QrcodeSupportedFormats.CODE_128,
        ],
      },
      onScanSuccess,
      () => {}
    );
  } catch (err) {
    showToast('Camera access denied or not available', true);
    scanning = false;
    container.classList.remove('active');
    btn.innerHTML = '<span class="icon">📷</span> Start Scanner';
    btn.classList.remove('scanning');
  }
}

async function onScanSuccess(decodedText) {
  if (scanner) {
    await scanner.stop();
    scanner.clear();
  }
  scanning = false;
  document.getElementById('scanner-container').classList.remove('active');
  const btn = document.getElementById('scan-btn');
  btn.innerHTML = '<span class="icon">📷</span> Start Scanner';
  btn.classList.remove('scanning');

  document.getElementById('upc-input').value = decodedText;
  showToast(`Scanned: ${decodedText}`);
  lookupProduct(decodedText);
}

function manualLookup() {
  const upc = document.getElementById('upc-input').value.trim();
  if (!upc) {
    showToast('Enter a UPC code', true);
    return;
  }
  lookupProduct(upc);
}

document.getElementById('upc-input').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') manualLookup();
});

function addToHistory(product) {
  let history = JSON.parse(localStorage.getItem('scanHistory') || '[]');
  history = history.filter((h) => h.upc !== product.upc);
  history.unshift({
    name: product.name,
    brand: product.brand,
    image: product.image,
    upc: product.upc,
    quantity: product.quantity,
    category: product.category,
  });
  if (history.length > 10) history.pop();
  localStorage.setItem('scanHistory', JSON.stringify(history));
  renderHistory();
}

function renderHistory() {
  const list = document.getElementById('history-list');
  const history = JSON.parse(localStorage.getItem('scanHistory') || '[]');
  if (!history.length) {
    list.innerHTML = '<div class="empty-state">No scans yet. Scan a barcode or enter a UPC to get started.</div>';
    return;
  }

  list.innerHTML = history
    .map(
      (h) => `
    <div class="history-item" onclick="reloadProduct('${h.upc}')">
      ${h.image ? `<img src="${h.image}" alt="">` : '<div class="hi-placeholder"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/></svg></div>'}
      <div class="hi-info">
        <div class="hi-name">${escapeHtml(h.name)}</div>
        <div class="hi-detail">${escapeHtml(h.brand)} &middot; ${h.upc}</div>
      </div>
      <svg class="hi-arrow" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>
    </div>
  `
    )
    .join('');
}

function reloadProduct(upc) {
  document.getElementById('upc-input').value = upc;
  lookupProduct(upc);
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function show(id) {
  document.getElementById(id).classList.remove('hidden');
}

function hide(id) {
  document.getElementById(id).classList.add('hidden');
}

function showToast(msg, isError = false) {
  const existing = document.querySelector('.toast');
  if (existing) existing.remove();

  const toast = document.createElement('div');
  toast.className = `toast${isError ? ' error' : ''}`;
  toast.textContent = msg;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 3000);
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function toggleTheme() {
  const current = document.documentElement.getAttribute('data-theme');
  const next = current === 'light' ? 'dark' : 'light';
  document.documentElement.setAttribute('data-theme', next);
  localStorage.setItem('theme', next);
}

(function initTheme() {
  const saved = localStorage.getItem('theme');
  if (saved) {
    document.documentElement.setAttribute('data-theme', saved);
  }
})();

function applyManualSize() {
  const val = parseFloat(document.getElementById('manual-size-value').value);
  const unit = document.getElementById('manual-size-unit').value;
  if (!val || !currentProduct) return;

  currentProduct.quantity = { value: val, unit };
  document.getElementById('original-size').textContent =
    `${val} ${UNIT_LABELS[unit] || unit}`;
  setSmartDefaults(currentProduct.quantity);
  convert();
}

renderHistory();
