import { useEffect, useRef, useState } from 'react';
import './store.css';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || window.LABEL_AWADH_SUPABASE_URL || '';
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY || window.LABEL_AWADH_SUPABASE_KEY || '';

export default function App() {
  const host = useRef(null);
  const [status, setStatus] = useState('Loading Label Awadh…');

  useEffect(() => {
    // The legacy storefront script uses these public-only values to call Supabase Edge Functions.
    window.LABEL_AWADH_SUPABASE_URL = SUPABASE_URL;
    window.LABEL_AWADH_SUPABASE_KEY = SUPABASE_KEY;
    let cancelled = false;
    let script;
    async function mountStorefront() {
      try {
        const response = await fetch('/store-body.html');
        if (!response.ok) throw new Error('Could not load storefront markup');
        const markup = await response.text();
        if (cancelled || !host.current) return;
        host.current.innerHTML = markup;
        script = document.createElement('script');
        script.src = '/store.js';
        script.onload = async () => {
          if (cancelled) return;
          setStatus('');
          // Public catalogue read only. If the database has no active products yet,
          // the original demo catalogue remains visible until products are added.
          if (SUPABASE_URL && SUPABASE_KEY) {
            try {
              const r = await fetch(`${SUPABASE_URL}/rest/v1/products?select=*&active=eq.true&order=created_at.desc`, {
                headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` }
              });
              if (r.ok) {
                const rows = await r.json();
                if (!cancelled && rows.length && typeof window.LabelAwadhLoadProducts === 'function') {
                  window.LabelAwadhLoadProducts(rows);
                }
              } else console.warn('Supabase catalogue read failed:', await r.text());
            } catch (e) { console.warn('Supabase catalogue is not available; showing the demo catalogue.', e); }
          }
        };
        script.onerror = () => { if (!cancelled) setStatus('Storefront interactions could not load. Refresh the page.'); };
        document.body.appendChild(script);
      } catch (error) {
        if (!cancelled) setStatus('Unable to load the store. Please check your connection and refresh.');
        console.error(error);
      }
    }
    mountStorefront();
    return () => { cancelled = true; if (script?.parentNode) script.parentNode.removeChild(script); };
  }, []);

  return <>{status && <div role="status" style={{ padding: '18px', textAlign: 'center' }}>{status}</div>}<div ref={host} /></>;
}
