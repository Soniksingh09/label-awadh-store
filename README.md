# Label Awadh — React + Vite + Supabase

Label Awadh storefront and admin UI, with Supabase Edge Function source for order creation, payment setup/verification, webhook handling and notifications. The storefront uses the existing public Supabase URL/publishable key fallback in `public/admin/config.js`; server-only secrets must remain in Supabase Edge Function secrets.

Cloud build: `npm run build` (Node/npm are required only on the build host, not on the user's laptop). `netlify.toml` configures Netlify build/publish. GitHub Actions runs a cloud build check.

**Not certified production-ready:** Edge Functions must be deployed and configured in the target Supabase project; end-to-end COD/payment tests are still required. Inventory is checked at checkout but is not atomically reserved/decremented, so concurrent checkouts can oversell. Read `README-REPLACE-ON-GITHUB-HINGLISH.md` before replacing repository files.
