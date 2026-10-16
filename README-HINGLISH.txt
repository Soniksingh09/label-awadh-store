LABEL AWADH WEBSITE — HINGLISH SETUP

1. ZIP extract karo.
2. Node.js LTS install karo: https://nodejs.org/
3. Folder ko VS Code mein open karo.
4. Terminal > New Terminal kholo.
5. Commands run karo:
   npm install
   npm run dev
6. Terminal mein jo URL aaye (usually http://localhost:5173), use Chrome mein kholo.
7. Website band karne ke liye terminal mein Ctrl + C dabao.

WhatsApp number set karna:
- public/store.js file VS Code mein kholo.
- Sabse upar BUSINESS_WHATSAPP line par apna number country code ke saath digits only mein likho.
- Example format: 919876543210 (ye sirf example hai, apna number use karo).
- Customer order place karega to WhatsApp mein order details ka message pre-filled open ho sakta hai. Customer ko Send dabana hoga.

IMPORTANT:
Abhi ye working frontend/demo storefront hai, full production ecommerce backend nahi.
- Demo products aur suit illustrations ko apni actual product photos, names, prices, sizes aur stock se replace karna hai.
- Checkout orders filhaal customer ke browser mein save hote hain; tumhare paas central order dashboard nahi hai.
- Payment gateway connected nahi hai. Real card details kabhi enter mat karna.
- Automatic email alerts, secure database, real inventory, shipping updates aur payment processing live launch se pehle add karne honge.

Live karne ke liye:
- npm run build
- Netlify par dist folder deploy karo ya Git repository import karo.
- Netlify mein Domain management > Add a domain se GoDaddy domain add karo.
- GoDaddy DNS mein wahi records set karo jo Netlify tumhari site ke liye dikhata hai. Existing email-related DNS records ko bina samjhe delete mat karna.
