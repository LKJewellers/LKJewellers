# LK Jewellers static site
**Deploy:** push to GitHub > Settings > Pages > deploy from `main` / root. Add `lkjewellers.co.uk` as the custom domain.

**Every page is self-contained.** The CSS and JavaScript are built into each HTML file, so a page looks right even when opened on its own (for example from a download or an email preview). `css/style.css` and `js/main.js` hold the same code as a reference copy; to restyle the whole site, change the same rule in the `<style>` block of each page, or replace that block with `<link rel="stylesheet" href="css/style.css">` (and the script block with `<script src="js/main.js"></script>`) on every page.

**Palette and fonts:** the tokens at the top of the `<style>` block (`--bg #0a0a0a`, `--gold #c8a96a`, and so on).

**Edit products:** each product is one `<article class="prod">` in jewellery.html, engagements.html or watches.html: change the name, text, price and `<img src>`. Prices also appear in the JSON-LD block in each page's `<head>`.

**Images:** Unsplash photos (free licence), hosted by Unsplash for now. Each hero is set in the `style="..."` on the `<section class="hero">`. Replace any link with your own file in an `images/` folder. Replace `favicon.svg` with your own icon.

**Forms:** set `YOUR_FORM_ID` (contact.html) and `YOUR_NEWSLETTER_ID` (footer, every page) from formspree.io. "Add to cart" is visual only. Enquire links open contact.html with the product name pre-filled.

**Before launch, check:** the address and phone number in contact.html; the Instagram handle; and that every claim (recycled metals, diamond origin, lifetime care, "UK studio") is true for your business.
