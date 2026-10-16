
import { useEffect, useRef, useState } from 'react';
import './store.css';

const SUPABASE_URL = (
  import.meta.env.VITE_SUPABASE_URL || ''
).replace(/\/$/, '');

const SUPABASE_KEY =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  import.meta.env.VITE_SUPABASE_ANON_KEY ||
  '';

export default function App() {
  const host = useRef(null);
  const [status, setStatus] = useState('Loading Label Awadh…');

  useEffect(() => {
    let cancelled = false;
    let script = null;

    async function mountStorefront() {
      try {
        // Load the existing storefront HTML.
        const response = await fetch('/store-body.html');

        if (!response.ok) {
          throw new Error(
            `Could not load storefront markup (${response.status})`
          );
        }

        const markup = await response.text();

        if (cancelled || !host.current) return;

        host.current.innerHTML = markup;

        // Load the existing storefront JavaScript.
        script = document.createElement('script');
        script.src = '/store.js';

        script.onload = async () => {
          if (cancelled) return;

          setStatus('');

          if (!SUPABASE_URL || !SUPABASE_KEY) {
            console.warn(
              'Supabase is not configured. Showing the existing storefront.'
            );
            return;
          }

          try {
            // Fetch active products using the actual database columns.
            const url = new URL(
              `${SUPABASE_URL}/rest/v1/products`
            );

            url.searchParams.set('select', '*');
            url.searchParams.set('active', 'eq.true');
            url.searchParams.set('order', 'created_at.desc');

            const result = await fetch(url.toString(), {
              headers: {
                apikey: SUPABASE_KEY,
                Authorization: `Bearer ${SUPABASE_KEY}`
              }
            });

            if (!result.ok) {
              const errorText = await result.text();
              console.error(
                'Supabase product fetch failed:',
                result.status,
                errorText
              );
              return;
            }

            const rows = await result.json();

            if (cancelled || !rows.length) {
              console.info(
                'No active products were returned by Supabase.'
              );
              return;
            }

            // Keep the existing storefront renderer.
            if (
              typeof window.LabelAwadhLoadProducts === 'function'
            ) {
              window.LabelAwadhLoadProducts(rows);
            } else {
              console.error(
                'LabelAwadhLoadProducts was not found in store.js.'
              );
            }
          } catch (error) {
            console.error('Could not load Supabase products:', error);
          }
        };

        script.onerror = () => {
          if (!cancelled) {
            setStatus(
              'Storefront interactions could not load. Please refresh.'
            );
          }
        };

        document.body.appendChild(script);
      } catch (error) {
        console.error('Storefront loading error:', error);

        if (!cancelled) {
          setStatus(
            'Unable to load the store. Please refresh and try again.'
          );
        }
      }
    }

    mountStorefront();

    return () => {
      cancelled = true;

      if (script?.parentNode) {
        script.parentNode.removeChild(script);
      }
    };
  }, []);

  return (
    <>
      {status && (
        <div
          role="status"
          style={{
            padding: '18px',
            textAlign: 'center'
          }}
        >
          {status}
        </div>
      )}

      <div ref={host} />
    </>
  );
}
