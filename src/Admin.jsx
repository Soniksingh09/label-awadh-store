import React, { useCallback, useEffect, useMemo, useState } from 'react';

const URL = (import.meta.env.VITE_SUPABASE_URL || window.LABEL_AWADH_SUPABASE_URL || '').replace(/\/$/, '');
const KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY || window.LABEL_AWADH_SUPABASE_KEY || '';
const money = (paise) => new Intl.NumberFormat('en-IN',{style:'currency',currency:'INR',maximumFractionDigits:0}).format((Number(paise)||0)/100);
const statuses = ['pending','confirmed','processing','shipped','delivered','cancelled'];
const blank = { id:'', name:'', slug:'', description:'', category:'Chikankari Suits', price:'', compare:'', image_urls:'', sizes:'S, M, L, XL', stockS:'0', stockM:'0', stockL:'0', stockXL:'0', active:true };

async function api(path, { token, method='GET', body, prefer } = {}) {
  const headers = { apikey: KEY, Authorization: `Bearer ${token || KEY}` };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (prefer) headers.Prefer = prefer;
  const response = await fetch(`${URL}${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  const raw = await response.text();
  let data = null; try { data = raw ? JSON.parse(raw) : null; } catch { data = raw; }
  if (!response.ok) throw new Error(data?.message || data?.msg || data?.hint || data?.error_description || `Request failed (${response.status})`);
  return data;
}

export default function Admin() {
  const [session,setSession] = useState(()=>{ try{return JSON.parse(sessionStorage.getItem('la_admin_session')||'null')}catch{return null} });
  const [screen,setScreen] = useState('products');
  const [tab,setTab] = useState('products');
  const [email,setEmail] = useState(''); const [password,setPassword] = useState('');
  const [busy,setBusy] = useState(false); const [error,setError] = useState(''); const [notice,setNotice] = useState('');
  const [products,setProducts] = useState([]); const [orders,setOrders] = useState([]); const [itemsByOrder,setItemsByOrder] = useState({});
  const [editor,setEditor] = useState(null); const [search,setSearch] = useState('');
  const token = session?.access_token;
  const configured = Boolean(URL && KEY && !URL.includes('YOUR_PROJECT_REF'));

  const verifyAdmin = useCallback(async (s) => {
    if (!s?.access_token) return false;
    const result = await api('/rest/v1/rpc/is_admin',{token:s.access_token,method:'POST',body:{}});
    return result === true;
  },[]);

  const loadProducts = useCallback(async () => {
    const rows = await api('/rest/v1/products?select=*&order=created_at.desc',{token});
    setProducts(rows || []);
  },[token]);
  const loadOrders = useCallback(async () => {
    const rows = await api('/rest/v1/orders?select=*&order=created_at.desc&limit=100',{token});
    setOrders(rows || []);
  },[token]);
  const reload = useCallback(async () => {
    setError(''); setNotice(''); setBusy(true);
    try { if(tab==='products') await loadProducts(); else await loadOrders(); }
    catch(e){setError(e.message)} finally {setBusy(false)}
  },[tab,loadProducts,loadOrders]);

  useEffect(()=>{
    let alive=true;
    (async()=>{
      if(!configured){setError('Supabase configuration missing. In Netlify, add VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY, then trigger a new deploy.');return;}
      if(!session?.access_token) return;
      try {
        const ok=await verifyAdmin(session);
        if(!alive)return;
        if(!ok){sessionStorage.removeItem('la_admin_session');setSession(null);setError('This account is not an admin. Add its Auth user UUID to public.admin_users in Supabase.');return;}
        setError('');
      } catch(e){ if(alive){sessionStorage.removeItem('la_admin_session');setSession(null);setError(`Session/admin check failed: ${e.message}`);} }
    })();
    return ()=>{alive=false};
  },[configured,session?.access_token,verifyAdmin]);
  useEffect(()=>{ if(session?.access_token) reload(); },[session?.access_token,tab,reload]);

  async function login(e){
    e.preventDefault(); setBusy(true);setError('');
    try {
      if(!configured) throw new Error('Supabase URL/key configuration is missing.');
      const s=await api('/auth/v1/token?grant_type=password',{method:'POST',body:{email:email.trim(),password}});
      const ok=await verifyAdmin(s);
      if(!ok) throw new Error('Login successful, but this account is not an admin yet. In Supabase Authentication → Users, copy its UUID and add it to public.admin_users.');
      sessionStorage.setItem('la_admin_session',JSON.stringify(s));setSession(s);setPassword('');setError('');setNotice('Welcome to Label Awadh Admin.');
    } catch(e){setError(e.message)} finally{setBusy(false)}
  }
  function logout(){sessionStorage.removeItem('la_admin_session');setSession(null);setProducts([]);setOrders([]);setError('');setNotice('You have been signed out.');}

  function openNew(){setEditor({...blank});setError('');setNotice('');}
  function openEdit(p){setEditor({id:p.id,name:p.name,slug:p.slug,description:p.description||'',category:p.category||'Chikankari Suits',price:String((p.price_paise||0)/100),compare:p.compare_at_price_paise?String(p.compare_at_price_paise/100):'',image_urls:(p.image_urls||[]).join('\n'),sizes:(p.sizes||[]).join(', '),stockS:String(p.stock_by_size?.S??0),stockM:String(p.stock_by_size?.M??0),stockL:String(p.stock_by_size?.L??0),stockXL:String(p.stock_by_size?.XL??0),active:Boolean(p.active)});setError('');setNotice('');}
  async function saveProduct(e){
    e.preventDefault();setBusy(true);setError('');setNotice('');
    try {
      const p=editor; const name=p.name.trim(); if(!name)throw new Error('Product name is required.');
      const price=Math.round(Number(p.price)*100); if(!Number.isFinite(price)||price<0)throw new Error('Enter a valid price in rupees.');
      const compare=p.compare.trim()===''?null:Math.round(Number(p.compare)*100); if(compare!==null&&(!Number.isFinite(compare)||compare<price))throw new Error('Compare-at price must be greater than or equal to the selling price.');
      const slug=(p.slug.trim()||name.toLowerCase()).normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
      const sizes=[...new Set(p.sizes.split(',').map(x=>x.trim().toUpperCase()).filter(Boolean))]; if(!sizes.length)throw new Error('Add at least one size, or use FREE.');
      const stock={S:Math.max(0,parseInt(p.stockS||'0',10)||0),M:Math.max(0,parseInt(p.stockM||'0',10)||0),L:Math.max(0,parseInt(p.stockL||'0',10)||0),XL:Math.max(0,parseInt(p.stockXL||'0',10)||0)};
      const row={name,slug,description:p.description.trim(),category:p.category.trim()||'Chikankari Suits',price_paise:price,compare_at_price_paise:compare,image_urls:p.image_urls.split(/\n|,/).map(x=>x.trim()).filter(x=>/^https:\/\//i.test(x)),sizes,stock_by_size:stock,active:Boolean(p.active),updated_at:new Date().toISOString()};
      if(p.id) await api(`/rest/v1/products?id=eq.${encodeURIComponent(p.id)}`,{token,method:'PATCH',body:row,prefer:'return=representation'});
      else await api('/rest/v1/products',{token,method:'POST',body:{...row,created_at:new Date().toISOString()},prefer:'return=representation'});
      setEditor(null);await loadProducts();setNotice('Product saved successfully.');
    } catch(e){setError(e.message)} finally{setBusy(false)}
  }
  async function deleteProduct(p){if(!window.confirm(`Delete “${p.name}”?`))return;setBusy(true);setError('');setNotice('');try{await api(`/rest/v1/products?id=eq.${encodeURIComponent(p.id)}`,{token,method:'DELETE'});await loadProducts();setNotice('Product deleted.')}catch(e){setError(e.message)}finally{setBusy(false)}}
  async function updateOrder(id,status){setBusy(true);setError('');setNotice('');try{await api(`/rest/v1/orders?id=eq.${encodeURIComponent(id)}`,{token,method:'PATCH',body:{status,updated_at:new Date().toISOString()},prefer:'return=representation'});await loadOrders();setNotice(`Order status updated to ${status}.`)}catch(e){setError(e.message)}finally{setBusy(false)}}
  async function toggleItems(orderId){if(itemsByOrder[orderId]){setItemsByOrder(v=>{const n={...v};delete n[orderId];return n});return;}try{const rows=await api(`/rest/v1/order_items?select=*&order_id=eq.${encodeURIComponent(orderId)}`,{token});setItemsByOrder(v=>({...v,[orderId]:rows||[]}));}catch(e){setError(e.message)}}

  const filtered=useMemo(()=>products.filter(p=>`${p.name} ${p.category} ${p.slug}`.toLowerCase().includes(search.toLowerCase())),[products,search]);
  const totalSales=orders.filter(o=>o.payment_status==='paid'||o.payment_method==='cod').reduce((n,o)=>n+(Number(o.total_paise)||0),0);
  if(!configured) return <div className="la-admin-wrap"><div className="la-login"><div className="la-brand">LABEL <b>AWADH</b></div><h1>Admin setup needed</h1><p>Netlify environment variables were saved, but a new build must include them.</p><p className="la-error">{error}</p><p>Required: <code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_PUBLISHABLE_KEY</code>.</p></div></div>;
  if(!session) return <div className="la-admin-wrap"><form className="la-login" onSubmit={login}><a className="la-back" href="/">← Back to store</a><div className="la-brand">LABEL <b>AWADH</b></div><div className="la-eyebrow">PRIVATE STORE MANAGEMENT</div><h1>Admin sign in</h1><p className="la-muted">Sign in with the admin account created in Supabase Authentication.</p><label>Email<input type="email" autoComplete="username" value={email} onChange={e=>setEmail(e.target.value)} required/></label><label>Password<input type="password" autoComplete="current-password" value={password} onChange={e=>setPassword(e.target.value)} required/></label>{error&&<div className="la-error">{error}</div>}{notice&&<div className="la-notice">{notice}</div>}<button className="la-primary" disabled={busy}>{busy?'Signing in…':'Sign in securely'}</button><small>Access is checked against the Supabase admin_users table. A normal customer account cannot open the admin dashboard.</small></form></div>;

  return <div className="la-admin"><aside className="la-sidebar"><a href="/" className="la-brand">LABEL <b>AWADH</b></a><div className="la-eyebrow">STORE MANAGEMENT</div><button className={tab==='products'?'active':''} onClick={()=>{setTab('products');setEditor(null)}}>▦ Products</button><button className={tab==='orders'?'active':''} onClick={()=>{setTab('orders');setEditor(null)}}>▤ Orders</button><div className="la-side-bottom"><div className="la-user">{session.user?.email||email}</div><button onClick={logout}>↪ Sign out</button><a href="/">View storefront ↗</a></div></aside>
    <main className="la-main"><header className="la-top"><div><div className="la-eyebrow">LABEL AWADH / ADMIN</div><h1>{tab==='products'?'Products':'Orders'}</h1></div><div className="la-top-actions"><span className="la-secure">● Secure admin session</span><button className="la-outline" onClick={reload} disabled={busy}>↻ Refresh</button></div></header>
    {error&&<div className="la-alert">{error}</div>}{notice&&<div className="la-notice">{notice}</div>}
    <section className="la-stats"><article><span>Total products</span><b>{products.length}</b></article><article><span>Active products</span><b>{products.filter(p=>p.active).length}</b></article><article><span>Orders in database</span><b>{orders.length}</b></article><article><span>Order value (COD + paid)</span><b>{money(totalSales)}</b></article></section>
    {tab==='products' ? <section className="la-panel"><div className="la-panel-head"><div><h2>Product catalogue</h2><p>Changes are saved directly to Supabase.</p></div><div className="la-tools"><input className="la-search" placeholder="Search products…" value={search} onChange={e=>setSearch(e.target.value)}/><button className="la-primary la-add" onClick={openNew}>＋ Add product</button></div></div>
      {editor&&<form className="la-editor" onSubmit={saveProduct}><div className="la-editor-title"><h3>{editor.id?'Edit product':'Add new product'}</h3><button type="button" className="la-close" onClick={()=>setEditor(null)}>×</button></div><div className="la-form-grid"><label>Product name *<input value={editor.name} onChange={e=>setEditor({...editor,name:e.target.value})} required/></label><label>Slug (auto if blank)<input value={editor.slug} onChange={e=>setEditor({...editor,slug:e.target.value})} placeholder="ivory-chikankari-suit"/></label><label>Category<input value={editor.category} onChange={e=>setEditor({...editor,category:e.target.value})} required/></label><label>Selling price (₹) *<input type="number" min="0" step="1" value={editor.price} onChange={e=>setEditor({...editor,price:e.target.value})} required/></label><label>Compare-at / MRP (₹)<input type="number" min="0" step="1" value={editor.compare} onChange={e=>setEditor({...editor,compare:e.target.value})} placeholder="Optional"/></label><label>Sizes (comma separated)<input value={editor.sizes} onChange={e=>setEditor({...editor,sizes:e.target.value})} placeholder="S, M, L, XL" required/></label><label className="la-wide">Image URL(s) — one per line<textarea value={editor.image_urls} onChange={e=>setEditor({...editor,image_urls:e.target.value})} placeholder="https://…" rows="2"/></label><label className="la-wide">Description<textarea value={editor.description} onChange={e=>setEditor({...editor,description:e.target.value})} rows="3"/></label><div className="la-stock la-wide"><strong>Stock by size</strong>{['S','M','L','XL'].map(s=><label key={s}>{s}<input type="number" min="0" step="1" value={editor['stock'+s]} onChange={e=>setEditor({...editor,['stock'+s]:e.target.value})}/></label>)}</div><label className="la-active"><input type="checkbox" checked={editor.active} onChange={e=>setEditor({...editor,active:e.target.checked})}/> Active — visible in public catalogue</label></div><div className="la-editor-actions"><button type="button" className="la-outline" onClick={()=>setEditor(null)}>Cancel</button><button className="la-primary" disabled={busy}>{busy?'Saving…':'Save product'}</button></div></form>}
      {busy&&!products.length?<p className="la-empty">Loading products…</p>:filtered.length===0?<p className="la-empty">No database products found. Add your first product above. Existing demo items on the public storefront remain until at least one active database product exists.</p>:<div className="la-table-wrap"><table className="la-table"><thead><tr><th>Product</th><th>Category</th><th>Price</th><th>Stock (S/M/L/XL)</th><th>Status</th><th>Actions</th></tr></thead><tbody>{filtered.map(p=><tr key={p.id}><td><div className="la-product-cell">{p.image_urls?.[0]?<img src={p.image_urls[0]} alt=""/>:<div className="la-placeholder">LA</div>}<div><b>{p.name}</b><small>{p.slug}</small></div></div></td><td>{p.category}</td><td>{money(p.price_paise)}</td><td>{['S','M','L','XL'].map(s=>p.stock_by_size?.[s]??0).join(' / ')}</td><td><span className={`la-pill ${p.active?'live':''}`}>{p.active?'Active':'Hidden'}</span></td><td><div className="la-row-actions"><button onClick={()=>openEdit(p)}>Edit</button><button className="danger" onClick={()=>deleteProduct(p)}>Delete</button></div></td></tr>)}</tbody></table></div>}
    </section> : <section className="la-panel"><div className="la-panel-head"><div><h2>Customer orders</h2><p>Orders created through the backend appear here. The original storefront checkout is still demo-only until its checkout functions are connected and tested.</p></div></div>{orders.length===0?<p className="la-empty">No orders in Supabase yet.</p>:<div className="la-table-wrap"><table className="la-table"><thead><tr><th>Order</th><th>Customer</th><th>Total</th><th>Payment</th><th>Placed</th><th>Status</th><th>Items</th></tr></thead><tbody>{orders.map(o=><React.Fragment key={o.id}><tr><td><b>#{o.order_number||o.id.slice(0,8)}</b><small>{o.id.slice(0,8)}</small></td><td><b>{o.customer_name}</b><small>{o.phone}<br/>{o.email}</small></td><td>{money(o.total_paise)}</td><td><span className="la-pill">{o.payment_method} · {o.payment_status}</span></td><td>{o.created_at?new Date(o.created_at).toLocaleString('en-IN'):'—'}</td><td><select className="la-status" value={o.status} onChange={e=>updateOrder(o.id,e.target.value)} disabled={busy}>{statuses.map(s=><option key={s} value={s}>{s}</option>)}</select></td><td><button className="la-link" onClick={()=>toggleItems(o.id)}>{itemsByOrder[o.id]?'Hide':'View'} items</button></td></tr>{itemsByOrder[o.id]&&<tr className="la-item-row"><td colSpan="7">{itemsByOrder[o.id].length?itemsByOrder[o.id].map(i=><span key={i.id} className="la-order-item"><b>{i.product_name}</b> · {i.size} × {i.quantity} · {money(i.line_total_paise)}</span>):'No items found for this order.'}</td></tr>}</React.Fragment>)}</tbody></table></div>}</section>}
    <footer className="la-footer">Label Awadh · Admin access protected by Supabase Auth and Row Level Security.</footer></main></div>;
}
