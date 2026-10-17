# Label Awadh — GitHub replacement pack (Hinglish)

Is ZIP mein storefront, admin UI, Supabase migrations aur Edge Function source code ek hi repository package mein hain. Laptop par Node.js/React/npm install karna zaroori nahi: hosting/build server cloud mein build karega.

## GitHub par files replace kaise karni hain
1. ZIP ko extract karo. Andar jo `label-awadh-store-main` folder hai, uske **andar ki saari files** select karo, hidden `.github` folder aur `.gitignore` samet.
2. GitHub repository `Soniksingh09/label-awadh-store` kholo. Pehle current repository ka ZIP backup download kar lo.
3. GitHub web editor se files ek-ek karke replace karna bahut cumbersome hai; GitHub browser upload ZIP ko automatically extract nahi karta. Agar GitHub connected editor/agent available ho to extracted folder ke contents repository root mein commit karo. **Repository ko delete mat karna** aur `.git` folder ko replace/upload karne ki koshish mat karna.
4. Netlify mein repository connected ho to build command `npm run build`, publish directory `dist` set honi chahiye. `netlify.toml` yahi configuration provide karta hai. Laptop par npm run nahi karna.
5. GitHub Actions `Build check` workflow push ke baad cloud mein build try karega. Green build ka matlab sirf frontend compile hua; live checkout/payment prove nahi hota.

## Existing Supabase database
- Existing project URL/public publishable key `public/admin/config.js` mein use kiye gaye hain. Publishable key browser mein hona expected hai; **service-role key kabhi frontend/GitHub mein mat daalna**.
- `coupon_code` aur `discount_paise` columns already added the; SQL dobara run mat karna.
- Product catalog ke liye `products` table mein active products hone chahiye, aur unke UUID IDs storefront use karega.
- Admin login ke liye Supabase Auth user ko `public.admin_users` mein already authorized hona chahiye. Public signup se admin access mat dena.

## Backend deployment is still separate
Supabase Edge Functions ka source `supabase/functions/` mein included hai, lekin GitHub par code upload karna un functions ko Supabase par deploy nahi karta. Supabase Dashboard → Edge Functions mein functions deploy/update karo ya approved deployment pipeline use karo. Required server-side secrets dashboard mein configure hone chahiye: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SITE_ORIGIN`; Razorpay secrets sirf tab jab online payments enable karne hon; email/WhatsApp secrets sirf un notifications ke liye. **Koi secret frontend file mein paste mat karna.**

## Launch se pehle required tests
- Product list Supabase se load ho rahi hai.
- Admin login, product update aur order list verified.
- COD test order actual `orders` + `order_items` mein banta hai.
- Wrong coupon, invalid PIN/phone, inactive product aur unavailable size reject hote hain.
- Razorpay test-mode payment, signature, amount/currency and webhook verified before live mode.
- Inventory stock reservation/decrement race condition abhi remaining launch risk hai; concurrent checkouts oversell kar sakte hain. Isko atomic database function/transaction se fix kiye bina high-traffic production launch mat karo.

## Important honest status
Yeh replacement-ready code package hai, lekin kisi assistant ne tumhare GitHub par files commit nahi ki, Netlify deploy nahi kiya, aur live Supabase/Razorpay transaction test nahi kiya. Isliye ise “perfect/fully production-verified” claim nahi kiya ja sakta. Pehle backup lo aur COD test deployment karo.
