import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const $ = (id) => document.getElementById(id);

const SUPABASE_URL = window.LABEL_AWADH_SUPABASE_URL;
const SUPABASE_KEY = window.LABEL_AWADH_SUPABASE_KEY;

let supabase = null;
let currentTab = 'overview';
let selectedImageFile = null;
let previewObjectUrl = null;

const statusOptions = [
  'pending', 'confirmed', 'processing',
  'shipped', 'delivered', 'cancelled'
];

/* ---------- SUPABASE CONNECTION ---------- */

if (
  SUPABASE_URL &&
  SUPABASE_URL.startsWith('https://') &&
  SUPABASE_KEY &&
  !SUPABASE_KEY.includes('PASTE_')
) {
  supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
  if ($('connectionState')) $('connectionState').textContent = 'Connected';
} else {
  if ($('connectionState')) $('connectionState').textContent = 'Not connected';
  if ($('setupNotice')) {
    $('setupNotice').classList.remove('hidden');
    $('setupNotice').textContent =
      'Check the Supabase URL and publishable/anon key in config.js.';
  }
}

/* ---------- HELPERS ---------- */

function money(value) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2
  }).format(Number(value) || 0);
}

function esc(value = '') {
  return String(value).replace(/[&<>"']/g, c => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  })[c]);
}

function toast(message) {
  if (!$('toast')) {
    alert(message);
    return;
  }

  $('toast').textContent = message;
  $('toast').classList.add('show');

  setTimeout(() => $('toast')?.classList.remove('show'), 2800);
}

function productPrice(product) {
  return Number(product?.price_paise || 0) / 100;
}

function productComparePrice(product) {
  return product?.compare_at_price_paise == null
    ? ''
    : Number(product.compare_at_price_paise) / 100;
}

function productImages(product) {
  return Array.isArray(product?.image_urls) ? product.image_urls : [];
}

function productSizes(product) {
  if (Array.isArray(product?.sizes)) return product.sizes;

  if (typeof product?.sizes === 'string') {
    try {
      const parsed = JSON.parse(product.sizes);
      if (Array.isArray(parsed)) return parsed;
    } catch {}

    return product.sizes.split(',').map(s => s.trim()).filter(Boolean);
  }

  return [];
}

function productStock(product) {
  const stock = product?.stock_by_size;

  if (typeof stock === 'number') return stock;
  if (!stock || typeof stock !== 'object') return 0;

  return Object.values(stock).reduce(
    (total, quantity) => total + (Number(quantity) || 0), 0
  );
}

function isProductActive(product) {
  return Boolean(product?.active);
}

function slugify(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

/* ---------- LOGIN / ADMIN ACCESS ---------- */

function showLogin(message = '') {
  $('loginPanel')?.classList.remove('hidden');
  $('appPanel')?.classList.add('hidden');
  $('signOut')?.classList.add('hidden');

  if ($('signedEmail')) $('signedEmail').textContent = 'Not signed in';
  if ($('loginMessage')) $('loginMessage').textContent = message;
}

function showApp(email) {
  $('loginPanel')?.classList.add('hidden');
  $('appPanel')?.classList.remove('hidden');
  $('signOut')?.classList.remove('hidden');

  if ($('signedEmail')) $('signedEmail').textContent = email || 'Admin';
  showTab(currentTab);
}

async function requireAdmin() {
  if (!supabase) {
    showLogin('Supabase configuration is missing. Check config.js.');
    return;
  }

  try {
    const { data: { session }, error: sessionError } =
      await supabase.auth.getSession();

    if (sessionError || !session) {
      showLogin();
      return;
    }

    const { data, error } = await supabase
      .from('admin_users')
      .select('user_id')
      .eq('user_id', session.user.id)
      .maybeSingle();

    if (error) {
      showLogin('Could not verify admin access: ' + error.message);
      return;
    }

    if (!data) {
      await supabase.auth.signOut();
      showLogin('This account is not approved for admin access.');
      return;
    }

    showApp(session.user.email);
  } catch (error) {
    showLogin(error.message || 'Unable to check admin access.');
  }
}

$('signIn')?.addEventListener('click', async () => {
  if (!supabase) {
    if ($('loginMessage')) {
      $('loginMessage').textContent = 'Check config.js Supabase settings.';
    }
    return;
  }

  const email = $('email')?.value.trim();
  const password = $('password')?.value;

  if (!email || !password) {
    if ($('loginMessage')) {
      $('loginMessage').textContent = 'Enter your email and password.';
    }
    return;
  }

  $('signIn').disabled = true;
  if ($('loginMessage')) $('loginMessage').textContent = 'Signing in...';

  try {
    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      if ($('loginMessage')) $('loginMessage').textContent = error.message;
      return;
    }

    await requireAdmin();
  } catch (error) {
    if ($('loginMessage')) {
      $('loginMessage').textContent = error.message || 'Sign-in failed.';
    }
  } finally {
    $('signIn').disabled = false;
  }
});

$('password')?.addEventListener('keydown', event => {
  if (event.key === 'Enter') $('signIn')?.click();
});

$('signOut')?.addEventListener('click', async () => {
  if (supabase) await supabase.auth.signOut();
  showLogin();
});

/* ---------- NAVIGATION ---------- */

function showTab(tab) {
  currentTab = tab;

  document.querySelectorAll('.nav').forEach(button => {
    button.classList.toggle('active', button.dataset.tab === tab);
  });

  ['overview', 'products', 'orders'].forEach(name => {
    $(name + 'Tab')?.classList.toggle('hidden', name !== tab);
  });

  if ($('pageTitle')) {
    $('pageTitle').textContent =
      tab.charAt(0).toUpperCase() + tab.slice(1);
  }

  if (tab === 'overview') loadOverview();
  if (tab === 'products') loadProducts();
  if (tab === 'orders') loadOrders();
}

document.querySelectorAll('.nav').forEach(button => {
  button.addEventListener('click', () => showTab(button.dataset.tab));
});

document.querySelectorAll('[data-goto]').forEach(button => {
  button.addEventListener('click', () => showTab(button.dataset.goto));
});

/* ---------- LOAD PRODUCTS ---------- */

async function loadProducts() {
  if (!supabase || !$('productsTable')) return;

  const { data, error } = await supabase
    .from('products')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    $('productsTable').textContent = error.message;
    return;
  }

  if (!data?.length) {
    $('productsTable').innerHTML =
      '<p class="muted">No products yet. Click Add product.</p>';
    return;
  }

  $('productsTable').innerHTML = `
    <table>
      <thead><tr>
        <th>IMAGE</th><th>PRODUCT</th><th>PRICE</th>
        <th>SIZES</th><th>STOCK</th><th>STATUS</th><th>ACTIONS</th>
      </tr></thead>
      <tbody>
        ${data.map(p => {
          const image = productImages(p)[0] || '';
          return `<tr>
            <td>${image
              ? `<img src="${esc(image)}" alt="${esc(p.name)}"
                   style="width:55px;height:65px;object-fit:cover;border-radius:6px">`
              : '-'}</td>
            <td><b>${esc(p.name)}</b></td>
            <td>${money(productPrice(p))}</td>
            <td>${esc(productSizes(p).join(', ') || '-')}</td>
            <td>${productStock(p)}</td>
            <td>${p.active ? 'Published' : 'Draft'}</td>
            <td>
              <button class="table-action" data-edit="${esc(p.id)}">Edit</button>
              <button class="table-action" data-delete="${esc(p.id)}">Delete</button>
            </td>
          </tr>`;
        }).join('')}
      </tbody>
    </table>`;

  document.querySelectorAll('[data-edit]').forEach(button => {
    button.addEventListener('click', () => {
      const product = data.find(p => String(p.id) === button.dataset.edit);
      if (product) openProduct(product);
    });
  });

  document.querySelectorAll('[data-delete]').forEach(button => {
    button.addEventListener('click', async () => {
      const product = data.find(p => String(p.id) === button.dataset.delete);

      if (!product || !confirm(`Delete "${product.name}"?`)) return;

      const { error: deleteError } = await supabase
        .from('products')
        .delete()
        .eq('id', product.id);

      if (deleteError) {
        toast(deleteError.message);
      } else {
        toast('Product deleted.');
        await loadProducts();
        await loadOverview();
      }
    });
  });
}

/* ---------- IMAGE PICKER ---------- */

function resetImagePicker() {
  selectedImageFile = null;

  if ($('pImageFile')) $('pImageFile').value = '';

  if ($('imagePreviewBox')) {
    $('imagePreviewBox').classList.add('hidden');
  }

  if ($('imagePreview')) $('imagePreview').removeAttribute('src');

  if (previewObjectUrl) {
    URL.revokeObjectURL(previewObjectUrl);
    previewObjectUrl = null;
  }
}

function setupImageUploader() {
  const input = $('pImageFile');
  if (!input) return;

  input.addEventListener('change', event => {
    const file = event.target.files?.[0] || null;
    selectedImageFile = null;

    if (previewObjectUrl) {
      URL.revokeObjectURL(previewObjectUrl);
      previewObjectUrl = null;
    }

    if (!file) {
      $('imagePreviewBox')?.classList.add('hidden');
      return;
    }

    const allowed = ['image/jpeg', 'image/png', 'image/webp'];

    if (!allowed.includes(file.type)) {
      toast('Choose a JPG, PNG or WebP image.');
      input.value = '';
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast('Image must be smaller than 5 MB.');
      input.value = '';
      return;
    }

    selectedImageFile = file;
    previewObjectUrl = URL.createObjectURL(file);

    if ($('imagePreview')) $('imagePreview').src = previewObjectUrl;
    $('imagePreviewBox')?.classList.remove('hidden');
  });
}

$('removeImage')?.addEventListener('click', () => resetImagePicker());

/* ---------- UPLOAD IMAGE TO SUPABASE STORAGE ---------- */

async function uploadProductImage(file) {
  if (!file) return null;

  const extension = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp'
  }[file.type];

  if (!extension) throw new Error('Choose a JPG, PNG or WebP image.');
  if (file.size > 5 * 1024 * 1024) {
    throw new Error('Image must be smaller than 5 MB.');
  }

  const path = `${crypto.randomUUID()}.${extension}`;

  const { error } = await supabase.storage
    .from('product-images')
    .upload(path, file, {
      contentType: file.type,
      upsert: false
    });

  if (error) throw error;

  const { data } = supabase.storage
    .from('product-images')
    .getPublicUrl(path);

  return data.publicUrl;
}

/* ---------- OPEN ADD / EDIT FORM ---------- */

async function openProduct(product = null) {
  const form = $('productForm');
  const modal = $('productModal');

  if (!form || !modal) {
    toast('Product form or modal is missing from index.html.');
    return;
  }

  form.reset();
  resetImagePicker();

  if ($('productId')) $('productId').value = product?.id ?? '';
  if ($('modalTitle')) {
    $('modalTitle').textContent = product ? 'Edit product' : 'Add product';
  }

  if ($('pName')) $('pName').value = product?.name || '';
  if ($('pSlug')) $('pSlug').value = product?.slug || '';
  if ($('pDescription')) $('pDescription').value = product?.description || '';
  if ($('pCategory')) {
    $('pCategory').value = product?.category || 'Chikankari Suits';
  }

  if ($('pPrice')) {
    $('pPrice').value = product ? productPrice(product) : '';
  }

  if ($('pCompare')) {
    $('pCompare').value = product ? productComparePrice(product) : '';
  }

  if ($('pSizes')) {
    $('pSizes').value = product
      ? productSizes(product).join(', ')
      : 'S, M, L, XL';
  }

  if ($('pStock')) {
    $('pStock').value = product ? productStock(product) : 0;
  }

  if ($('pActive')) $('pActive').checked = product ? isProductActive(product) : true;
  if ($('productMessage')) $('productMessage').textContent = '';

  // Existing image ko edit ke waqt preview mein dikhayein.
  const oldImage = productImages(product || {})[0];

  if (oldImage && $('imagePreview')) {
    $('imagePreview').src = oldImage;
    $('imagePreviewBox')?.classList.remove('hidden');
  }

  modal.classList.remove('hidden');
}

/* ---------- ADD / CLOSE BUTTONS ---------- */

$('newProduct')?.addEventListener('click', event => {
  event.preventDefault();
  openProduct();
});

$('closeModal')?.addEventListener('click', () => {
  $('productModal')?.classList.add('hidden');
  resetImagePicker();
});

$('cancelProduct')?.addEventListener('click', () => {
  $('productModal')?.classList.add('hidden');
  resetImagePicker();
});

$('pName')?.addEventListener('input', () => {
  const slugField = $('pSlug');

  if (slugField && !$('productId')?.value) {
    slugField.value = slugify($('pName').value);
  }
});

/* ---------- SAVE PRODUCT RECORD ---------- */

async function saveProductRecord(record, id) {
  const productData = {
    slug: record.slug,
    name: record.name,
    description: record.description,
    category: record.category,
    price_paise: Math.round(record.price * 100),
    compare_at_price_paise: record.comparePrice === null
      ? null
      : Math.round(record.comparePrice * 100),
    image_urls: record.imageUrl ? [record.imageUrl] : [],
    sizes: record.sizes,
    stock_by_size: record.stockBySize,
    active: record.active,
    updated_at: new Date().toISOString()
  };

  if (id) {
    return await supabase
      .from('products')
      .update(productData)
      .eq('id', id);
  }

  return await supabase
    .from('products')
    .insert(productData);
}


/* ---------- SAVE PRODUCT FORM ---------- */

$('productForm')?.addEventListener('submit', async event => {
  event.preventDefault();

  if (!supabase) {
    toast('Supabase is not connected.');
    return;
  }

  const form = $('productForm');
  const saveButton = form.querySelector('[type="submit"]');
  const message = $('productMessage');

  if (saveButton) saveButton.disabled = true;
  if (message) message.textContent = 'Saving product...';

  try {
    const name = $('pName')?.value.trim() || '';
    const slug = $('pSlug')?.value.trim() || slugify(name);
    const description = $('pDescription')?.value.trim() || '';
    const category = $('pCategory')?.value.trim() || 'Chikankari Suits';

    const priceText = $('pPrice')?.value ?? '';
    const price = Number(priceText);

    const compareText = $('pCompare')?.value ?? '';
    const comparePrice = compareText === '' ? null : Number(compareText);

    if (!name) throw new Error('Please enter the product name.');
    if (!slug) throw new Error('Please enter a product URL slug.');

    if (priceText === '' || !Number.isFinite(price) || price < 0) {
      throw new Error('Please enter a valid price.');
    }

    if (
      comparePrice !== null &&
      (!Number.isFinite(comparePrice) || comparePrice < 0)
    ) {
      throw new Error('Please enter a valid compare-at price.');
    }

    const sizes = ($('pSizes')?.value || '')
      .split(',')
      .map(size => size.trim())
      .filter(Boolean);

    if (!sizes.length) throw new Error('Please enter at least one size.');

    const stockText = $('pStock')?.value ?? '0';
    const stock = Number(stockText);

    if (!Number.isInteger(stock) || stock < 0) {
      throw new Error('Stock must be a whole number of zero or more.');
    }

    // Keep the current image if editing without choosing a replacement.
    let imageUrl = '';
    const id = $('productId')?.value.trim() || '';

    if (id) {
      const { data, error } = await supabase
        .from('products')
        .select('image_urls')
        .eq('id', id)
        .maybeSingle();

      if (error) throw error;

      imageUrl = Array.isArray(data?.image_urls)
        ? (data.image_urls[0] || '')
        : '';
    }

    if (selectedImageFile) {
      if (message) message.textContent = 'Uploading image...';
      imageUrl = await uploadProductImage(selectedImageFile);
    }

    const record = {
      slug,
      name,
      description,
      category,
      price,
      comparePrice,
      imageUrl,
      sizes,
      // The form currently accepts total stock, not separate stock per size.
      stockBySize: { total: stock },
      active: $('pActive')?.checked ?? true
    };

    if (message) message.textContent = 'Saving product...';

    const { error } = await saveProductRecord(record, id);
    if (error) throw error;

    $('productModal')?.classList.add('hidden');
    resetImagePicker();

    toast(id ? 'Product updated successfully!' : 'Product added successfully!');

    await loadProducts();
    await loadOverview();

  } catch (error) {
    console.error('Save product error:', error);
    if (message) {
      message.textContent = error.message || 'Could not save product.';
    }
  } finally {
    if (saveButton) saveButton.disabled = false;
  }
});

/* ---------- DASHBOARD OVERVIEW ---------- */

async function loadOverview() {
  if (!supabase) return;

  const [productsResult, ordersResult] = await Promise.all([
    supabase.from('products').select('id', {
      count: 'exact',
      head: true
    }),
    supabase.from('orders')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(6)
  ]);

  if (productsResult.error) {
    toast('Products: ' + productsResult.error.message);
    return;
  }

  if ($('productCount')) {
    $('productCount').textContent = productsResult.count ?? 0;
  }

  if (ordersResult.error) {
    if ($('recentOrders')) {
      $('recentOrders').textContent =
        'Could not load orders: ' + ordersResult.error.message;
    }
    if ($('orderCount')) $('orderCount').textContent = '—';
    if ($('pendingCount')) $('pendingCount').textContent = '—';
    return;
  }

  const orders = ordersResult.data || [];

  if ($('orderCount')) $('orderCount').textContent = orders.length;
  if ($('pendingCount')) {
    $('pendingCount').textContent =
      orders.filter(order => order.status === 'pending').length;
  }

  if ($('recentOrders')) {
    $('recentOrders').innerHTML = ordersMarkup(orders, false);
  }
}

/* ---------- ORDERS ---------- */

function ordersMarkup(rows, withActions = false) {
  if (!rows?.length) return '<p class="muted">No orders found yet.</p>';

  return `<table>
    <thead><tr>
      <th>ORDER</th><th>CUSTOMER</th><th>TOTAL</th>
      <th>STATUS</th><th>DATE</th>
      ${withActions ? '<th>UPDATE</th>' : ''}
    </tr></thead>
    <tbody>
      ${rows.map(order => `
        <tr>
          <td>#${esc(order.order_number ?? order.id)}</td>
          <td>${esc(order.customer_name || '-')}</td>
          <td>${money(
            order.total_paise != null
              ? Number(order.total_paise) / 100
              : order.total
          )}</td>
          <td>${esc(order.status || 'pending')}</td>
          <td>${order.created_at
            ? new Date(order.created_at).toLocaleDateString('en-IN')
            : '-'}</td>
          ${withActions ? `<td>
            <select data-status-id="${esc(order.id)}">
              ${statusOptions.map(status => `
                <option value="${status}"
                  ${status === order.status ? 'selected' : ''}>
                  ${status}
                </option>
              `).join('')}
            </select>
            <button class="table-action"
              data-save-status="${esc(order.id)}">Save</button>
          </td>` : ''}
        </tr>
      `).join('')}
    </tbody>
  </table>`;
}

async function loadOrders() {
  if (!supabase || !$('ordersTable')) return;

  const { data, error } = await supabase
    .from('orders')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(200);

  if (error) {
    $('ordersTable').textContent = error.message;
    return;
  }

  $('ordersTable').innerHTML = ordersMarkup(data || [], true);

  document.querySelectorAll('[data-save-status]').forEach(button => {
    button.addEventListener('click', async () => {
      const id = button.dataset.saveStatus;
      const select = document.querySelector(
        `[data-status-id="${CSS.escape(id)}"]`
      );

      if (!select) return;

      const { error: updateError } = await supabase
        .from('orders')
        .update({ status: select.value })
        .eq('id', id);

      if (updateError) {
        toast(updateError.message);
      } else {
        toast('Order status updated.');
        await loadOrders();
      }
    });
  });
}

$('refreshOrders')?.addEventListener('click', loadOrders);

/* ---------- INITIALISE ---------- */

setupImageUploader();

if (supabase) {
  supabase.auth.onAuthStateChange(() => {
    setTimeout(() => requireAdmin(), 0);
  });

  requireAdmin();
}
