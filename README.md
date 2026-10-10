# LK Jewellers static site
**Deploy:** push this folder to GitHub > Settings > Pages > deploy from `main` / root. Add `lkjewellers.co.uk` as the custom domain.

**Pages:** index, jewellery, engagements, about, contact, plus one detail page per product (`product-<name>.html`, 28 in total). The Watches page has been removed.

**Every page is self-contained.** The CSS and JavaScript are built into each HTML file, so a page looks right even when opened on its own. `css/style.css` and `js/main.js` hold the same code as a reference copy. To restyle the whole site, change the same rule in the `<style>` block of each page.

**Palette:** neutral unisex palette: off-white background `#f7f7f5`, stone `#eceeec`, mist `#e9edeb`, champagne gold `#c2a167` / `#8a6a36`, ink text `#1e2327`, slate grey `#5a6167`.

**Images:** `images/<product>-1.webp`, `-2`, `-3`… are each product's gallery (1000×1000, transparent backgrounds, `-1` is the main image). `thumbs/` (at the root, next to `images/`) holds 200px versions used for the thumbnail buttons. All were prepared from the supplied renders: backgrounds removed, soft shadows kept, trimmed and centred at a consistent size, never stretched. One lifestyle photo (`infinity-cross-4`) is kept as a photo.

**Galleries:** on cards and product pages, each thumbnail is a `<button data-src="images/…webp">`. Clicking it swaps the main image. To add a view, add an image file and another button in the same format.

**Products:** each product card is one `<article class="prod">` in jewellery.html or engagements.html (and in "Related pieces" on product pages). Prices currently say "Price on request". To show a price, replace `<span class="price por">Price on request</span>` with `<span class="price">£1,450</span>` on the card and on the product page, and optionally add an `"offers"` block to that page's JSON-LD.

**Homepage slideshow:** each `<figure class="slide">` in index.html is one product and links to its product page. Add, remove or reorder them; the dots build themselves.

**Forms:** set `YOUR_FORM_ID` (contact.html) and `YOUR_NEWSLETTER_ID` (footer, every page) from formspree.io. Every Enquire button opens contact.html with the product name pre-filled.

**Before launch, check:** the address and phone number in contact.html; the Instagram handle; each product's name, stones, sizes and metal options; and that every claim (handmade, lifetime care, UK studio) is true for your business.

## Accounts, LK Studio and live products (V1.4)
- `studio/`: **LK Studio**, the private business app (products, suppliers, receipts, customers, leads, quotes, orders, invoices, payments, finance, tasks, settings). Staff only; customers are blocked by the database, not just the screen. `admin/` now redirects here.
- `account/`: customer sign in, create account, password reset and the customer portal.
- `latest.html` and `item.html`: products published from LK Studio.
- `js/config.js`: fill in your own values (Supabase URL, anon key, site URL, Worker URL). No secret keys ever go in this folder.
- `js/lk-db.js` (database client), `js/lk-pdf.js` (quote/invoice PDFs), `js/enquiry.js` (contact form → LK Studio), `js/lk.js`, `js/account.js`, `js/content.js`, `js/shop-dynamic.js`, `css/portal.css`.

Setup: see `lk-jewellers-backend/docs/SETUP-GUIDE.md`. The London line sits under the logo on every page.
