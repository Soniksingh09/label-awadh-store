import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, json } from "../_shared/cors.ts";
const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  try {
    const b = await req.json();
    const { customer, items, payment_method } = b;
    const couponCode = String(b.coupon_code ?? "").trim().toUpperCase();
    if (!customer || !Array.isArray(items) || !items.length || items.length > 30) return json({ error: "Invalid order" }, 400);
    if (!['cod','online'].includes(payment_method)) return json({ error: "Invalid payment method" }, 400);
    const name = String(customer.name ?? '').trim(), email = String(customer.email ?? '').trim().toLowerCase(), phone = String(customer.phone ?? '').replace(/\D/g,'');
    const postal = String(customer.postal_code ?? '').trim();
    if (name.length < 2 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !/^\d{10}$/.test(phone) || !/^\d{6}$/.test(postal) || !String(customer.address_line1 ?? '').trim() || !String(customer.city ?? '').trim() || !String(customer.state ?? '').trim()) return json({ error: "Please check name, email, 10-digit phone and 6-digit PIN code" }, 400);
    const ids = [...new Set(items.map((x: any) => String(x.product_id ?? '')))];
    if (ids.some((x: string) => !x)) return json({ error: "Missing product" }, 400);
    const { data: products, error: pe } = await db.from('products').select('id,slug,name,price_paise,stock_by_size,active').in('id', ids).eq('active', true);
    if (pe || !products || products.length !== ids.length) return json({ error: "One or more products are unavailable" }, 400);
    let subtotal = 0; const lines: any[] = [];
    for (const raw of items) {
      const prod = products.find((x: any) => x.id === raw.product_id); const size = String(raw.size ?? ''); const qty = Number(raw.quantity);
      if (!prod || !Number.isInteger(qty) || qty < 1 || qty > 5 || !Array.isArray(Object.keys(prod.stock_by_size ?? {})) || !Object.keys(prod.stock_by_size ?? {}).includes(size)) return json({ error: "Invalid size or quantity" }, 400);
      if (Number(prod.stock_by_size[size] ?? 0) < qty) return json({ error: `${prod.name} (${size}) is out of stock` }, 409);
      const unit = Number(prod.price_paise); const line = unit * qty; subtotal += line;
      lines.push({ product_id: prod.id, product_name: prod.name, product_slug: prod.slug, size, quantity: qty, unit_price_paise: unit, line_total_paise: line });
    }
    let discount = 0;
    if (couponCode === 'AWADH10') discount = Math.min(50000, Math.round(subtotal * 0.10));
    else if (couponCode === 'FLAT500') { if (subtotal < 499900) return json({ error: 'FLAT500 requires a product subtotal of at least ₹4,999.' }, 400); discount = 50000; }
    else if (couponCode === 'FREESHIP') { /* free shipping is applied below */ }
    else if (couponCode) return json({ error: 'This coupon code is not valid.' }, 400);
    const shipping = subtotal >= 199900 || couponCode === 'FREESHIP' ? 0 : 9900;
    const total = Math.max(0, subtotal - discount + shipping);
    const { data: order, error: oe } = await db.from('orders').insert({ customer_name:name,email,phone,address_line1:String(customer.address_line1??'').trim(),address_line2:String(customer.address_line2??'').trim(),city:String(customer.city??'').trim(),state:String(customer.state??'').trim(),postal_code:postal,country:'India',notes:String(customer.notes??'').slice(0,500),payment_method,payment_status:'pending',status:'pending',subtotal_paise:subtotal,discount_paise:discount,coupon_code:couponCode||null,shipping_paise:shipping,total_paise:total }).select('id,order_number,total_paise,payment_method,status').single();
    if (oe || !order) throw oe ?? new Error('Could not create order');
    const { error: ie } = await db.from('order_items').insert(lines.map((x) => ({...x, order_id:order.id})));
    if (ie) { await db.from('orders').delete().eq('id', order.id); throw ie; }
    // Notifications are attempted server-side; failures are logged but do not expose secrets.
    await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/send-order-notifications`, { method:'POST', headers:{'Content-Type':'application/json','Authorization':`Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`}, body:JSON.stringify({order_id:order.id}) }).catch((e)=>console.error('Notification call failed',e));
    return json({ order_id:order.id, order_number:order.order_number, subtotal_paise:subtotal, discount_paise:discount, total_paise:total, shipping_paise:shipping, payment_method, status:'pending' }, 201);
  } catch (e) { console.error('create-order', e); return json({ error: "Could not place order. Please try again." }, 500); }
});
