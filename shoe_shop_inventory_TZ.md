# Technical Specification (TZ)
## Shoe Shop Inventory & Sales Tracking System

**Version:** 1.0 (Draft)
**Date:** 2026-09-17
**Client:** Single shoe seller, bazaar shop (Tashkent)
**Author:** Prepared with Claude based on requirements discussion

---

## 1. Purpose

A web-based inventory and sales-tracking system for a single-person shoe shop in a bazaar. The owner logs new stock as it arrives, the system generates a scannable barcode for each stock line, and scanning that code lets the owner look up the item and record a sale. The system also provides basic statistics (profit, best sellers, slow-moving stock).

This is **not** a public storefront — it is an internal tool used only by the shop owner.

---

## 2. Scope

**In scope**
- Single-user system (one login — the owner)
- Stock entry by brand, with per-size quantities and a shared bought price
- Barcode generation, one per size line, printable on any regular printer
- Scan → view details → record a sale
- Statistics dashboard
- UI available in Uzbek and Russian
- Currency: Uzbek so'm (UZS)

**Out of scope (v1)**
- Multiple staff accounts / permission levels
- Returns or exchanges
- Offline mode / PWA sync (not needed — shop has reliable internet)
- Thermal label printer integration (labels are just printable images/PDFs; hardware is the owner's choice)
- Public-facing storefront or online sales

---

## 3. User Roles

| Role | Description |
|---|---|
| Owner | The only user. Full access: add stock, scan/sell, view stats, edit/delete entries. |

Authentication: simple username/password login (Django auth is sufficient — no registration flow, the account is created manually/via admin).

---

## 4. Core Concepts

| Term | Meaning |
|---|---|
| **Batch** | One restock event: a brand bought at a specific price, possibly across several sizes, on a given date. |
| **Size Entry** | One size line within a batch (e.g. "size 41" within a Nike batch). **This is the unit a barcode points to.** Holds a running quantity. |
| **Sale** | A single unit sold from a Size Entry, logged with its own sold price and timestamp. |

A barcode does not represent one physical pair — it represents "this brand, this size, from this batch." Scanning it shows how many are left and lets the owner record one sale at a time.

---

## 5. Functional Requirements

### 5.1 Authentication
- Login page (username + password).
- No self-registration; only one account exists.
- Session-based auth is sufficient (standard Django sessions).

### 5.2 Adding a New Batch (stock entry)
- Form fields:
  - Brand (text)
  - Bought price (numeric, so'm, applies to all sizes in this batch)
  - Picture (optional image upload)
  - Size breakdown: one or more rows of `size` + `quantity` (e.g. 40 → 5, 41 → 8, 42 → 3)
- On save:
  - One `Batch` record is created.
  - One `SizeEntry` record is created **per size row**, each with its own unique code.
  - Barcode images are generated for each new `SizeEntry`.
- **Restock logic (assumption — confirm with owner):**
  - If the owner enters a brand + size that already has stock **at the same bought price**, the new quantity is **added to the existing SizeEntry** (no new code).
  - If the bought price is **different** from the existing entry, a **new Batch + SizeEntry** is created (with a new code), so profit calculations for old and new stock aren't mixed together.

### 5.3 Barcode Generation
- Each `SizeEntry` gets a unique short code (e.g. a numeric or alphanumeric ID, such as an incrementing ID or a short random token).
- The barcode encodes that code directly (not a full URL — 1D barcodes are best kept to short numeric/alphanumeric strings). Recommended symbology: **Code128**, since it supports letters and numbers without needing pre-registered product codes like EAN/UPC do.
- Generated once per Size Entry; reused for reprints until that line reaches zero stock.
- **Important difference from QR:** a 1D barcode isn't something a phone's default camera app can open automatically the way it can with a QR code (which encodes a clickable URL). Scanning a barcode just gives you back the raw code — something has to read that code and look it up. See §5.5 for how that lookup happens.

### 5.4 Label Printing
- Each Size Entry page has a "Download/Print label" option producing a small image (PNG or SVG) with the barcode and basic text (brand, size).
- A "Print labels" batch view lets the owner select multiple pending Size Entries and generate one PDF sheet (e.g. laid out for A4) to print and cut out.
- No dependency on specific printer hardware — works with a regular printer + sticker paper, or a print shop.

### 5.5 Scanning & Lookup
Because a 1D barcode doesn't auto-open like a QR code, the app needs its own scan feature rather than relying on the phone's default camera:
- The web app includes a **"Scan"** page/button that turns on the phone's camera inside the browser and reads the barcode using a barcode-decoding library (see §8).
- Once decoded, the app looks up the code and takes the owner straight to that Size Entry's page — same experience as QR, just with one extra tap to open the scanner first.
- A **manual code entry** fallback (type or search the code) should also be available, in case a barcode is damaged, poorly printed, or hard to scan.
- Size Entry page shows: brand, size, bought price, quantity remaining, picture (if set), date added.
- If quantity is 0, page shows "Out of stock" (page still exists for historical/statistical purposes).

**Technical flow for the scan → lookup step:**
1. Browser requests camera access (`getUserMedia`) and streams video into the scan page.
2. The barcode library reads frames in real time; when it recognizes a barcode, it returns the decoded string via a callback (e.g. `"A1B2C3D4E5"`).
3. The page immediately navigates to something like `/scan/<code>/`.
4. A small Django view looks up `SizeEntry.objects.get(code=<code>)` and redirects (or renders) to that entry's normal detail page — the exact same page reachable from the Inventory List.
5. If no entry matches the code, show a clear "code not found" message rather than a generic error.

This means the scan step is really just a fast path to the same page you'd reach by browsing — no separate "scanned" state or special handling once you're there.

*Note: if in practice the in-browser camera scanning feels unreliable, a cheap USB/Bluetooth barcode-scanner gun (common and inexpensive) is a very solid alternative — it just "types" the scanned code into a search box like a keyboard, no camera library needed at all. Worth keeping in mind as a fallback if phone-camera scanning of 1D barcodes proves finicky in practice.*

### 5.6 Recording a Sale
- On the Size Entry page (while quantity > 0): a **"Sell one"** action.
- Prompts for **sold price** (numeric input, so'm).
- On submit:
  - Creates a `Sale` record (linked to the Size Entry, with sold price and timestamp).
  - Decrements the Size Entry's quantity by 1.
- No return/undo flow in v1 — a mistaken sale would need manual correction by the owner (e.g. via a simple edit/delete on the Sale record, admin-level access only).

### 5.7 Inventory List
- Table/list view of all Size Entries (current stock), with:
  - Search by brand
  - Filter by size, in-stock/out-of-stock, date range added
  - Sort by date added, quantity, or bought price
- Each row links to that Size Entry's own page. **Marking a sale doesn't require scanning** — the same "Sell one" action is available whether the owner arrived at the page by scanning the barcode or by browsing/searching the inventory list directly. Scanning is just a shortcut to get there faster.

### 5.8 Statistics Dashboard
- Total current inventory value (Σ bought_price × quantity remaining across all Size Entries)
- Revenue and profit over a selected date range (profit = Σ sold_price − Σ bought_price of sold units)
- Best-selling brands and sizes (by units sold)
- Average days from `Batch.date_added` to each sale (how fast stock moves)
- Slow-moving stock: Size Entries with quantity > 0 that haven't sold in the last N days
- Simple charts (e.g. sales over time, by month/week)

### 5.9 Data Export
- Export current inventory and/or sales history to CSV/Excel for the owner's own records.

---

## 6. Data Model

```
Batch
- id
- brand (CharField)
- bought_price (PositiveIntegerField, so'm)
- picture (ImageField, optional)
- date_added (DateTimeField, auto)

SizeEntry
- id
- batch (ForeignKey → Batch)
- code (CharField, unique, indexed — the value encoded in the barcode)
- size (CharField or PositiveSmallIntegerField, depending on how sizes are represented)
- quantity (PositiveIntegerField)
- initial_quantity (PositiveIntegerField — optional, keeps original count for stats even after quantity drops)

Sale
- id
- size_entry (ForeignKey → SizeEntry)
- sold_price (PositiveIntegerField, so'm)
- sold_at (DateTimeField, auto)
```

Notes:
- `code` should be generated with something like `uuid.uuid4().hex[:10]` or a similar short random token — unique and short enough to encode cleanly as a Code128 barcode.
- Storing `initial_quantity` alongside `quantity` avoids having to recompute "how many were originally in this line" from the Sale table every time stats are calculated.

---

## 7. Non-Functional Requirements

- **Language:** UI available in Uzbek and Russian. Use Django's built-in i18n framework (`gettext`, `.po` files, `USE_I18N = True`). Only interface text needs translation — brand names and other owner-entered data do not.
- **Currency:** All monetary values stored as integers (so'm has no everyday fractional/decimal usage). Displayed with thousands separators, e.g. `250 000 so'm`.
- **Connectivity:** Standard online web app; no offline support needed.
- **Devices:** Must work well on a phone browser (mobile-first), since both stock entry and scanning happen on a phone in practice.
- **Security:** Single-user login is enough; Size Entry codes should still be non-sequential/unguessable so URLs can't be trivially enumerated.

---

## 8. Suggested Technology Stack

- **Backend:** Django (server-rendered views are likely sufficient for a single-user internal tool — a full DRF API layer isn't strictly necessary unless a separate frontend/mobile app is planned later)
- **Barcode generation:** `python-barcode` (Python package) — generates the barcode image (Code128) from the Size Entry's code
- **In-browser barcode scanning:** `@ericblade/quagga2` — a JS library purpose-built for real-time barcode decoding via the device camera. Chosen over the native browser `BarcodeDetector` API so behavior stays consistent across both Android and iPhone (native support for that API has historically been inconsistent, especially on iOS). `ZXing-js` is a solid drop-in alternative if quagga2's maintenance status ever becomes a concern. *[Medium confidence on current library maintenance/versioning specifics — verify before committing.]*
- **Image handling:** `Pillow` (dependency of `python-barcode`, also used for the optional product picture)
- **PDF label sheets:** a PDF library such as `reportlab`, or Django's built-in templating rendered to PDF via a tool like `weasyprint`
- **i18n:** Django's built-in translation framework
- **Database:** PostgreSQL or SQLite (SQLite is likely fine given the small scale — single shop, single user)

*Note: confirm current versions/maintenance status of any third-party package before committing to it — package ecosystems change over time.*

---

## 9. Screens / Pages

1. Login
2. Add new batch (brand, bought price, picture, size/quantity rows)
3. Inventory list (search/filter)
4. Size Entry detail page (the barcode scan target) — view info + "Sell one"
5. Sell confirmation (enter sold price)
6. Scan page (camera-based barcode scanner + manual code entry fallback)
7. Print labels (select entries → generate PDF sheet)
8. Statistics dashboard
9. Export data

---

## 10. Assumptions Made (please confirm or correct)

- Restocking the same brand/size at the same price adds to existing quantity rather than creating a new code; a price change creates a new code.
- No requirement (yet) for editing/correcting a mistaken sale beyond basic admin-level access.
- Sizes will be entered as simple numbers (e.g. EU sizing); no need to support multiple sizing systems (US/UK/EU) unless stated otherwise.
- One photo per batch (not per size) is sufficient, since a picture generally represents the shoe model, not the individual size.

---

## 11. Future Enhancements (not in v1)

- Multi-user support with roles (owner vs. employee) if he hires help
- Return/exchange handling
- Thermal label printer support
- Dedicated USB/Bluetooth barcode-scanner hardware, as a more reliable alternative to phone-camera scanning
- QR code option, in addition to barcode, if phone-camera barcode scanning proves unreliable in practice
- Offline-capable PWA, if internet reliability changes
- Multi-shop / multi-location support
