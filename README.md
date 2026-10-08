# LK Jewellers static site
**Deploy:** push this folder to GitHub > Settings > Pages > deploy from `main` / root. Add `lkjewellers.co.uk` as the custom domain.

**Every page is self-contained.** The CSS and JavaScript are built into each HTML file, so a page looks right even when opened on its own. `css/style.css` and `js/main.js` hold the same code as a reference copy. To restyle the whole site, change the same rule in the `<style>` block of each page.

**Palette:** light pastel luxury, set as tokens at the top of the `<style>` block: pearl background `#fbf8f5`, blush `#f6ebe6`, sage `#e9eee7`, champagne gold `#c2a167` / `#8a6a36`, charcoal text `#2b2622`.

**Product images** are in `images/` as 1000×1000 WebP files with transparent backgrounds, so each product sits directly on the page colour. They were prepared from the supplied renders: backgrounds removed, soft shadows kept, trimmed and centred at a consistent size, never stretched. To add your own, use a square image with a transparent background (or a clean white one) and the same naming style.

**Products:** each product is one `<article class="prod">` in jewellery.html or engagements.html. Prices currently say "Price on request" with an Enquire button. To show a price, replace `<span class="price por">Price on request</span>` with `<span class="price">£1,450</span>`; on the jewellery page you can also swap the Enquire link for `<button class="btn sm add" type="button">Add to cart</button>` (visual only for now).

**Homepage slideshow:** each `<figure class="slide">` in index.html is one product. Add, remove or reorder them; the dots build themselves. It autoplays every 5.5 seconds, pauses on hover and touch, supports swipe, arrows and arrow keys, and stays still for visitors who turn off motion.

**Watches:** no watch photography was supplied, so the Watches page is an appointment page with a gold line drawing. Add watch products later in the same card format as the other pages.

**Forms:** set `YOUR_FORM_ID` (contact.html) and `YOUR_NEWSLETTER_ID` (footer, every page) from formspree.io. Enquire links open contact.html with the product name pre-filled.

**Before launch, check:** the address and phone number in contact.html; the Instagram handle; the product names and descriptions (stone types, sizes and metals); and that every claim (handmade, lifetime care, UK studio) is true for your business.
