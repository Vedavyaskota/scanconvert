# ScanConvert

A mobile-first web app that scans product barcodes and instantly converts prices and quantities across currencies and units.

**Live App → [vedavyaskota.github.io/scanconvert](https://vedavyaskota.github.io/scanconvert/)**

---

## What It Does

1. **Scan a barcode** using your phone camera (or type the UPC/EAN code manually)
2. The app fetches the product name, brand, image, size, and category automatically
3. **Enter the store price** in your local currency
4. **Pick your target currency and unit** — the app calculates the converted price per unit in real time

### Example

You find a **1 gallon milk** priced at **$2.99 USD** in a US store.

Set the target to **Liter** and **INR** — the app shows you the price per liter in Indian Rupees, with a full breakdown of the unit conversion and exchange rate used.

---

## How to Use

### On Your Phone (Recommended)

1. Open [vedavyaskota.github.io/scanconvert](https://vedavyaskota.github.io/scanconvert/) in your phone browser
2. Tap **Scan Barcode** and allow camera access
3. Point your camera at any product barcode — it detects UPC-A, UPC-E, EAN-13, EAN-8, and Code 128
4. Once the product loads, enter the price you see on the shelf
5. Select your desired currency and unit from the dropdowns
6. The converted price appears instantly

### Install as an App

- **iPhone**: Open in Safari → tap Share → "Add to Home Screen"
- **Android**: Open in Chrome → tap the install banner or Menu → "Add to Home Screen"

### Manual Entry

If a product's size isn't found in the database, an input field appears where you can type the amount and select the unit (e.g., `1 gal`, `500 g`, `16 fl oz`).

---

## Supported Conversions

| Volume | Weight |
|--------|--------|
| Gallon ↔ Liter | Kilogram ↔ Pound |
| Milliliter ↔ Fluid Oz | Gram ↔ Ounce |
| Quart ↔ Pint ↔ Cup | |

**Currencies**: USD, INR, EUR, GBP, CAD, AUD, JPY — with live exchange rates.

---

## Data Sources

- **Product data**: [Open Food Facts](https://world.openfoodfacts.org/) — free, open-source product database
- **Exchange rates**: [ExchangeRate API](https://www.exchangerate-api.com/) — refreshed every hour

---

## Self-Hosting

This is a static site with no build step. To host it yourself:

```bash
git clone https://github.com/Vedavyaskota/scanconvert.git
cd scanconvert

# Serve with any static file server
npx serve .
# or
python3 -m http.server 3000
```

Deploy the folder to any static host — Netlify, Vercel, Cloudflare Pages, or your own server.

> **Note**: The barcode scanner requires HTTPS to access the camera. Local development on `localhost` works without HTTPS.
