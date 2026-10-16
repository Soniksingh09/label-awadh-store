# Label Awadh — React + Supabase E-commerce Backend (Hinglish)

Ye package tumhare existing `awadh.html` design ko reference rakhta hai. Existing storefront abhi prototype-style HTML/JS ko React wrapper mein render karta hai. Is package mein Supabase database schema, secure Edge Functions, payment/notification backend examples aur setup guide hain. **Live services tab tak configured nahi hain jab tak tum apne accounts ke secrets add karke test nahi karti.** Existing storefront checkout abhi automatically in functions ko call nahi karta; live orders lene se pehle checkout integration aur end-to-end tests karna zaroori hai.

## Architecture
- Frontend: React + Vite (existing Label Awadh storefront design preserved)
- Database/auth: Supabase Postgres + Supabase Auth + Row Level Security
- Server functions: Supabase Edge Functions (service-role key server par only)
- Online payment: Razorpay Orders API + signature verification + webhook
- Email: Resend API
- WhatsApp: Meta WhatsApp Cloud API
- Hosting: Netlify; domain GoDaddy par

## A. Local website run karna
1. Node.js LTS install karo: https://nodejs.org/
2. ZIP extract karo; VS Code mein `label-awadh-react` folder open karo.
3. Terminal mein `npm install`
4. `npm run dev`
5. Browser mein terminal ka URL kholo (normally http://localhost:5173).
6. Production build check: `npm run build`.

## B. Supabase project and database
1. https://supabase.com par account banao, New project create karo, strong database password safe jagah rakho.
2. Dashboard → SQL Editor → New query kholo.
3. `supabase/migrations/0001_store_schema.sql` ka poora content paste karke Run karo.
4. Project Settings → API se Project URL aur publishable/anon key lo.
5. Project root mein `.env` naam ki file banao (`.env.example` copy karke), `VITE_SUPABASE_URL` aur `VITE_SUPABASE_ANON_KEY` fill karo. Sirf public/publishable key frontend mein ja sakti hai.
6. `products` table mein apne real products add karo. Price `price_paise` mein hai: ₹2,499 = `249900`. `active=true` karne ke baad product public catalogue query mein aa sakta hai. Real photos ke liye Supabase Storage bucket ya image hosting URLs use karo.

## C. Supabase CLI and Edge Functions
Supabase CLI install guide: https://supabase.com/docs/guides/cli
1. Terminal mein `supabase login`
2. Project folder mein `supabase link --project-ref YOUR_PROJECT_REF`
3. Edge Function secrets dashboard → Edge Functions → Secrets mein add karo (ya supported CLI secrets command use karo).
4. Secrets required depending on features:
   - `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_ANON_KEY`, `SITE_ORIGIN`
   - Email: `RESEND_API_KEY`, `ORDER_EMAIL_FROM`, `ORDER_EMAIL_TO`
   - WhatsApp: `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_ADMIN_TO`
   - Razorpay: `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET`
5. Deploy functions:
   ```bash
   supabase functions deploy create-order --no-verify-jwt
   supabase functions deploy send-order-notifications --no-verify-jwt
   supabase functions deploy create-payment-order --no-verify-jwt
   supabase functions deploy verify-payment --no-verify-jwt
   supabase functions deploy razorpay-webhook --no-verify-jwt
   supabase functions deploy admin-update-order --no-verify-jwt
   ```
   Public checkout functions validate input and use server-side service role only internally. Admin updates independently verify the user's Supabase Auth session and `admin_users` membership. Do not expose service role key to browser.

## D. Create the first admin safely
1. Supabase Dashboard → Authentication → Users → Add user. Use your business email and a strong password.
2. Copy that user's UUID.
3. SQL Editor mein run karo, UUID replace karke:
   ```sql
   insert into public.admin_users (user_id) values ('PASTE_AUTH_USER_UUID_HERE');
   ```
4. Only that account is an admin. Never add a public sign-up form that automatically grants admin access.
5. The SQL schema restricts orders to server-side writes and admin-only reads. Test policies before launch.

## E. Email notifications (Resend)
1. https://resend.com account banao and verify the sending domain according to their dashboard instructions.
2. Generate an API key. Add it as Supabase secret `RESEND_API_KEY`.
3. Set `ORDER_EMAIL_FROM` to the verified sender and `ORDER_EMAIL_TO` to the inbox that should receive orders. Multiple recipient emails comma-separated.
4. Test with a small COD test order. Function logs and Resend dashboard show delivery/failure. No email is sent until valid credentials and verified sender are configured.

## F. WhatsApp notifications (Meta Cloud API)
1. Meta for Developers → create/use a Business app → add WhatsApp product and complete phone-number/business setup.
2. Get a valid access token and Phone Number ID. Set recipient number including country code in `WHATSAPP_ADMIN_TO` (digits only, e.g. 91...; use your real number).
3. Save token, Phone Number ID and admin recipient as Supabase Edge Function secrets.
4. Check current Meta rules for recipient opt-in, template requirements and production access. For business-initiated messages, approved templates may be required; test setup can have recipient restrictions.
5. Run a real test and verify API response in logs. Do not assume delivery merely because code is present.

## G. Online payment (Razorpay)
1. Create Razorpay account and start in Test Mode: https://razorpay.com
2. Add `RAZORPAY_KEY_ID` and `RAZORPAY_KEY_SECRET` as Supabase secrets. Never put secret in `.env` or browser JS.
3. Configure webhook URL: `https://YOUR_PROJECT_REF.supabase.co/functions/v1/razorpay-webhook`; subscribe to `payment.captured` (and optionally payment.failed). Save webhook secret as `RAZORPAY_WEBHOOK_SECRET`.
4. The supplied functions can create a Razorpay order and verify the checkout signature. Frontend still needs to call `create-order` with `payment_method:"online"`, call `create-payment-order`, launch Razorpay Checkout with returned order details, and call `verify-payment` with the checkout response. This integration is not yet wired into the supplied storefront UI; do not offer online payments until wired and tested.
5. Test success, failure, refresh/back button, duplicate webhook and mismatched-signature cases in test mode. Only switch to live keys after end-to-end tests.

## H. Connect the existing checkout
`public/store.js` currently has a demo `placeOrder()` that writes to browser `localStorage`, simulates order tracking and opens WhatsApp. That is NOT a real central order system. Before selling, replace this path so it:
- sends only product IDs, sizes, quantities and customer/address data to `create-order`;
- uses server-returned prices and totals (never trust browser prices);
- shows confirmation only after server success;
- for COD, leaves payment status pending and sends notifications;
- for online, invokes Razorpay flow and server signature verification;
- loads real orders from a protected server/API for the admin, not customer `localStorage`.

The Edge Function request shape for create-order is:
```json
{
  "customer": {
    "name": "Customer Name", "email": "customer@example.com", "phone": "9876543210",
    "address_line1": "House / street", "address_line2": "Area", "city": "Lucknow",
    "state": "Uttar Pradesh", "postal_code": "226001", "notes": "Optional"
  },
  "payment_method": "cod",
  "items": [{"product_id":"UUID_FROM_PRODUCTS_TABLE", "size":"M", "quantity":1}]
}
```
Call with the Supabase URL `/functions/v1/create-order`, `Content-Type: application/json`, and `apikey: YOUR_PUBLIC_ANON_KEY`. Public checkout function has `verify_jwt=false` intentionally, but validates products, price, size, quantity and address server-side. Add rate limiting / CAPTCHA before public launch to reduce abuse.

## I. Netlify deploy + GoDaddy domain
1. Push project to a private GitHub repository, or deploy via Netlify's Git integration.
2. Netlify → Add new site → Import existing project; build command `npm run build`, publish directory `dist`.
3. Add frontend env vars `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in Netlify site environment variables, then redeploy.
4. Netlify → Domain management → Add domain; enter your GoDaddy domain.
5. GoDaddy → DNS management; apply the exact records Netlify shows for your domain. Do not delete unrelated MX/email records. Wait for DNS and HTTPS verification.
6. Update Supabase `SITE_ORIGIN` secret to your final `https://yourdomain.com` and redeploy functions if needed.

## J. Launch checklist
- Replace every demo suit/photo/price/size with accurate inventory.
- Set privacy policy, terms, shipping, cancellation, returns/exchange and contact details.
- Test mobile and desktop, COD checkout, stock edge cases, order email, WhatsApp, payment success/failure, refund/cancellation process and admin-only access.
- Configure backups, Supabase Auth security, abuse protection and monitoring.
- Use Razorpay test keys first. No real payment, email or WhatsApp integration is configured until you add credentials and verify test messages/payments.

## Troubleshooting
- `npm install` fails: check internet, use current Node.js LTS, retry `npm install`.
- `Invalid API key`: confirm Supabase project URL and publishable/anon key.
- Function says integration not configured: set the related Edge Function secrets, then redeploy/retest.
- Admin gets 403: check the exact authenticated user UUID is in `admin_users`.
- Domain not working: check Netlify's exact DNS instructions and preserve email MX records.

Official docs: Supabase https://supabase.com/docs · Netlify https://docs.netlify.com · Razorpay https://razorpay.com/docs · Resend https://resend.com/docs · Meta WhatsApp https://developers.facebook.com/docs/whatsapp/cloud-api


## Updated admin UI (added 16 Oct 2026)
- Admin route: `/admin/` (React/Vite app).
- Uses `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` (also accepts the older `VITE_SUPABASE_ANON_KEY`).
- Auth is verified by calling `public.is_admin()` RPC; product/order queries then rely on RLS.
- See `START-HERE-HINGLISH.md` for admin account setup and cloud deployment.
- The original storefront checkout remains demo-only; admin orders will only show backend-created orders.
