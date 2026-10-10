/* =====================================================================
   LK Jewellers site configuration (TEMPLATE)
   1. Copy this file and name the copy  js/config.js
   2. Replace each YOUR_... value (see docs/SETUP-GUIDE.md, steps 4 and 9)
   The anon key below is DESIGNED to be public: Row Level Security in the
   database is what protects your data. NEVER paste the "service_role"
   key (or any secret) in this file or anywhere on the website.
   ===================================================================== */
window.LK_CONFIG = {
  SUPABASE_URL: 'YOUR_SUPABASE_URL',             // e.g. https://abcdxyz.supabase.co
  SUPABASE_ANON_KEY: 'YOUR_SUPABASE_ANON_KEY',   // "anon / public" key
  SITE_URL: 'https://lkjewellers.co.uk',
  WORKER_URL: 'YOUR_WORKER_URL'                 // Cloudflare Worker (admin actions, receipts, emails). Leave as is until you deploy it
};
