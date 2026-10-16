# Label Awadh — updated starter (Hinglish)

## Is ZIP mein kya update hua hai?
- Original storefront design preserved.
- `/admin` par Supabase Auth login.
- Admin access `public.is_admin()` RPC se verify hota hai; sirf Supabase `admin_users` mein added user admin hoga.
- Product CRUD: add/edit/delete, price, category, images, sizes, per-size stock, active/hidden.
- Database orders list, order items view aur status update.
- Storefront active Supabase products read karne ki koshish karta hai; jab tak database mein active products na hon, original demo catalogue dikhata hai.
- Netlify SPA redirect included.

## Important limitations (launch se pehle zaroor padhein)
- Existing checkout abhi bhi demo/localStorage flow hai. It does NOT yet create real Supabase orders, and online payments are NOT connected to Razorpay checkout. Do not accept real customer orders/payments yet.
- Admin orders tab sirf Supabase `orders` table mein maujood orders dikhata hai; checkout backend ko connect/deploy/test karna abhi baaki hai.
- Product image URLs must be publicly accessible HTTPS URLs. Uploading images to Supabase Storage is not implemented in this version.
- The SQL schema already run in your Supabase project should not be run again blindly.

## Cloud deployment — laptop par Node.js install nahi karna
Recommended: GitHub + Netlify build (build runs in cloud).
1. GitHub par new private repository banao.
2. ZIP extract karke `label-awadh-react` folder ke contents repository ke root mein upload/push karo. Keep `src/`, `public/`, `supabase/`, `package.json`, and `index.html`. Do not upload `.env` files with real credentials.
3. Netlify Dashboard → Add new site → Import an existing project → GitHub → select the repository.
4. Build command: `npm run build`; Publish directory: `dist`.
5. Netlify site → Project configuration → Environment variables: set `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`. You have already added these to the existing Netlify project; after code is updated, make sure the same variables exist on the site that is connected to this repository.
6. Trigger a new deploy. Open `https://YOUR-SITE/admin/`.

## Create the first admin user (one-time)
1. Supabase Dashboard → Authentication → Users → Add user. Enter your business email and a strong password.
2. After user is created, copy that user's UUID.
3. Supabase → SQL Editor → New query. Run this, replacing the placeholder with the exact UUID (keep single quotes):

```sql
insert into public.admin_users (user_id)
values ('PASTE_AUTH_USER_UUID_HERE');
```

4. If you see a duplicate-key error, the user is already listed. Do not create a public signup that grants admin automatically.
5. Visit `/admin/` and sign in with that email/password. If access is denied, verify that the UUID matches the Auth user.

## Database product fields
- Prices are stored in paise: ₹2,499 = `249900`. The admin panel handles this conversion.
- Active products (`active = true`) can appear on the public catalogue. Hidden products remain admin-only.
- The admin UI relies on the schema created by the supplied SQL: `products`, `orders`, `order_items`, `admin_users`, and `public.is_admin()`.

## Security
- Publishable key is designed for frontend use; RLS still protects database rows.
- Never put `service_role` key, database password, Razorpay secret, or email/WhatsApp tokens in browser code or `VITE_` variables.
- Admin panel uses Supabase Auth and checks server-side `is_admin()` RPC before rendering dashboard data. Database RLS remains the enforcement layer.

## Current status
Admin interface and catalogue read integration are implemented in source. A live Netlify build/deploy and browser test against your project still need to be completed. Checkout/payment integration is not launch-ready.
