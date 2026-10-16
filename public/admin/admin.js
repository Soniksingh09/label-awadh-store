import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const $ = (id) => document.getElementById(id);

const SUPABASE_URL = window.LABEL_AWADH_SUPABASE_URL;
const SUPABASE_KEY = window.LABEL_AWADH_SUPABASE_KEY;

const configured = Boolean(
  SUPABASE_URL &&
  SUPABASE_URL.startsWith('https://') &&
  SUPABASE_KEY &&
  !SUPABASE_URL.includes('PASTE_') &&
  !SUPABASE_KEY.includes('PASTE_')
);

let supabase = null;
let currentTab = 'overview';
let selectedImageFile = null;
let previewObjectUrl = null;

const statusOptions = [
  'pending',
  'confirmed',
  'processing',
  'shipped',
  'delivered',
  'cancelled'
];

/* ---------- INITIAL CONFIGURATION ---------- */

if (configured) {
  supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

  if ($('connectionState')) {
    $('connectionState').textContent = 'Connected';
  }
} else {
  if ($('connectionState')) {
    $('connectionState').textContent = 'Not connected';
  }

  if ($('setupNotice')) {
    $('setupNotice').classList.remove('hidden');
    $('setupNotice').textContent =
      'Please check the Supabase URL and publishable/anon key in config.js.';
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
  return String(value).replace(/[&<>"']/g, char => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  })[char]);
}

function toast(message) {
  if (!$('toast')) {
    alert(message);
    return;
  }

  $('toast').textContent = message;
  $('toast').classList.add('show');

  setTimeout(() => {
    $('toast').classList.remove('show');
  }, 2800);
}

/* ---------- LOGIN ---------- */

function showLogin(message = '') {
  $('loginPanel')?.classList.remove('hidden');
  $('appPanel')?.classList.add('hidden');
  $('signOut')?.classList.add('hidden');

  if ($('signedEmail')) {
    $('signedEmail').textContent = 'Not signed in';
  }

  if ($('loginMessage')) {
    $('loginMessage').textContent = message;
  }
}

function showApp(email) {
  $('loginPanel')?.classList.add('hidden');
  $('appPanel')?.classList.remove('hidden');
  $('signOut')?.classList.remove('hidden');

  if ($('signedEmail')) {
    $('signedEmail').textContent = email || 'Admin';
  }

  showTab(currentTab);
}

async function requireAdmin() {
  if (!supabase) {
    showLogin('Supabase configuration is missing. Check config.js.');
    return;
  }

  try {
    const {
      data: { session },
      error: sessionError
    } = await supabase.auth.getSession();

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
      $('loginMessage').textContent =
        'Check the Supabase URL and key in config.js.';
    }
    return;
  }

  const email = $('email')?.value.trim();
  const password = $('password')?.value;

  if (!email || !password) {
    $('loginMessage').textContent = 'Enter your email and password.';
    return;
  }

  $('signIn').disabled = true;
  $('loginMessage').textContent = 'Signing in...';

  try {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password
    });

    if (error) {
      $('loginMessage').textContent = error.message;
      return;
    }

    await requireAdmin();
  } catch (error) {
    $('loginMessage').textContent =
      error.message || 'Sign-in failed.';
  } finally {
    $('signIn').disabled = false;
  }
});

$('password')?.addEventListener('keydown', event => {
  if (event.key === 'Enter') {
    $('signIn')?.click();
  }
});

$('signOut')?.addEventListener('click', async () => {
  if (supabase) {
    await supabase.auth.signOut();
  }

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
  button.addEventListener('click', () => {
    showTab(button.dataset.tab);
  });
});

document.querySelectorAll('[data-goto]').forEach(button => {
  button.addEventListener('click', () => {
    showTab(button.dataset.goto);
  });
});

/* ---------- ORDERS ---------- */

function ordersMarkup(rows, withActions = false) {
  if (!rows?.length) {
    return '<p class="muted">No orders found yet.</p>';
  }

  return `<table>
    <thead>
      <tr>
        <th>ORDER</th>
        <th>CUSTOMER</th>
        <th>TOTAL</th>
        <th>STATUS</th>
        <th>DATE</th>
        ${withActions ? '<th>UPDATE</th>' : ''}
      </tr>
    </thead>
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

  if (productsResult.error || ordersResult.error) {
    toast((productsResult.error || ordersResult.error).message);
    return;
  }

  if ($('productCount')) {
    $('productCount').textContent = productsResult.count ?? 0;
  }

  if ($('orderCount')) {
    $('orderCount').textContent = ordersResult.data.length;
  }

  if ($('pendingCount')) {
    $('pendingCount').textContent =
      ordersResult.data.filter(order => order.status === 'pending').length;
  }

  if ($('recentOrders')) {
    $('recentOrders').innerHTML =
      ordersMarkup(ordersResult.data, false);
  }
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

  $('ordersTable').innerHTML = ordersMarkup(data, true);

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
        toast('Order status updated');
        loadOrders();
      }
    });
  });
}

$('refreshOrders')?.addEventListener('click', loadOrders);
/* ---------- PRODUCT HELPERS ---------- */

function productPrice(product) {
  return Number(product?.price) || 0;
}

function productImages(product) {
  return product?.image_url ? [product.image_url] : [];
}

function productSizes(product) {
  if (Array.isArray(product?.sizes)) return product.sizes;

  if (typeof product?.sizes === 'string') {
    return product.sizes
      .split(',')
      .map(size => size.trim())
      .filter(Boolean);
  }

  return [];
}

function isProductActive(product) {
  return Boolean(product?.is_active);
}

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
      '<p class="muted">No products yet. Click Add Product to create one.</p>';
    return;
  }

  $('productsTable').innerHTML = `
    <table>
      <thead>
        <tr>
          <th>IMAGE</th>
          <th>PRODUCT</th>
          <th>PRICE</th>
          <th>SIZES</th>
          <th>STOCK</th>
          <th>STATUS</th>
          <th>ACTIONS</th>
        </tr>
      </thead>
      <tbody>
        ${data.map(product => `
          <tr>
            <td>
              ${product.image_url
                ? `<img src="${esc(product.image_url)}"
                    alt="${esc(product.name)}"
                    style="width:55px;height:65px;object-fit:cover;border-radius:6px">`
                : '-'}
            </td>
            <td><b>${esc(product.name)}</b></td>
            <td>${money(product.price)}</td>
            <td>${esc(productSizes(product).join(', ') || '-')}</td>
            <td>${Number(product.stock) || 0}</td>
            <td>${product.is_active ? 'Published' : 'Draft'}</td>
            <td>
              <button class="table-action"
                data-edit="${esc(product.id)}">Edit</button>
              <button class="table-action"
                data-delete="${esc(product.id)}">Delete</button>
            </td>
          </tr>
        `).join('')}
      </tbody>
    </table>`;

  document.querySelectorAll('[data-edit]').forEach(button => {
    button.addEventListener('click', () => {
      const product = data.find(
        item => String(item.id) === button.dataset.edit
      );
      if (product) openProduct(product);
    });
  });

  document.querySelectorAll('[data-delete]').forEach(button => {
    button.addEventListener('click', async () => {
      const product = data.find(
        item => String(item.id) === button.dataset.delete
      );

      if (!product || !confirm(`Delete "${product.name}"?`)) return;

      const { error: deleteError } = await supabase
        .from('products')
        .delete()
        .eq('id', product.id);

      if (deleteError) {
        toast(deleteError.message);
      } else {
        toast('Product deleted');
        await loadProducts();
      }
    });
  });
}

/* ---------- IMAGE PICKER ---------- */

function setupImageUploader() {
  const imageField = $('pImages');

  if (!imageField || $('pImageFile')) return;

  const wrapper = document.createElement('div');
  wrapper.style.margin = '12px 0';

  wrapper.innerHTML = `
    <label for="pImageFile"
      style="display:block;margin-bottom:8px">
      Choose product image from your computer
    </label>
    <input id="pImageFile" type="file"
      accept="image/jpeg,image/png,image/webp,image/gif">
    <img id="pImagePreview" alt="Image preview"
      style="display:none;width:120px;height:140px;
      object-fit:cover;border-radius:8px;margin-top:10px">
    <p class="muted">Maximum image size: 5 MB.</p>`;

  imageField.parentElement.insertBefore(wrapper, imageField);

  $('pImageFile').addEventListener('change', event => {
    const file = event.target.files?.[0] || null;
    const preview = $('pImagePreview');

    selectedImageFile = null;

    if (previewObjectUrl) {
      URL.revokeObjectURL(previewObjectUrl);
      previewObjectUrl = null;
    }

    if (!file) {
      preview.style.display = 'none';
      preview.removeAttribute('src');
      return;
    }

    if (!['image/jpeg', 'image/png', 'image/webp', 'image/gif']
      .includes(file.type)) {
      toast('Please choose a JPG, PNG, WEBP or GIF image.');
      event.target.value = '';
      preview.style.display = 'none';
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast('Image must be smaller than 5 MB.');
      event.target.value = '';
      preview.style.display = 'none';
      return;
    }

    selectedImageFile = file;
    previewObjectUrl = URL.createObjectURL(file);
    preview.src = previewObjectUrl;
    preview.style.display = 'block';
  });
}

function resetImagePicker() {
  selectedImageFile = null;

  if ($('pImageFile')) $('pImageFile').value = '';

  if ($('pImagePreview')) {
    $('pImagePreview').style.display = 'none';
    $('pImagePreview').removeAttribute('src');
  }

  if (previewObjectUrl) {
    URL.revokeObjectURL(previewObjectUrl);
    previewObjectUrl = null;
  }
}

/* ---------- OPEN ADD / EDIT FORM ---------- */



/* ---------- OPEN ADD / EDIT FORM ---------- */

function openProduct(product = null) {
  const form = $('productForm');
  const modal = $('productModal');

  if (!form || !modal) {
    toast('Product form or modal is missing from index.html.');
    return;
  }

  form.reset();

  if (typeof resetImagePicker === 'function') {
    resetImagePicker();
  }

  if ($('productId')) {
    $('productId').value = product?.id ?? '';
  }

  if ($('modalTitle')) {
    $('modalTitle').textContent = product ? 'Edit product' : 'Add product';
  }

  if ($('pName')) $('pName').value = product?.name || '';

  if ($('pSlug')) {
    $('pSlug').value = product?.slug || '';
  }

  if ($('pDescription')) {
    $('pDescription').value = product?.description || '';
  }

  if ($('pCategory')) {
    $('pCategory').value = product?.category || 'Chikankari Suits';
  }

  if ($('pPrice')) {
    $('pPrice').value = product ? productPrice(product) : '';
  }

  if ($('pCompare')) {
    $('pCompare').value = product?.compare_at_price_paise
      ? Number(product.compare_at_price_paise) / 100
      : '';
  }

  if ($('pSizes')) {
    const sizes = productSizes(product || {});
    $('pSizes').value = product ? sizes.join(', ') : 'S, M, L, XL';
  }

  // HTML mein pImages nahi, pImageFile hai.
  // Existing image URL ko hidden/optional field ho tabhi set karein.
  if ($('pImages')) {
    const urls = product?.image_urls;
    $('pImages').value = Array.isArray(urls)
      ? (urls[0] || '')
      : (product?.image_url || '');
  }

  if ($('pStock')) {
    const stock = product?.stock_by_size;
    $('pStock').value = product
      ? (Number(product.stock) || Number(stock?.total) || 0)
      : '0';
  }

  if ($('pActive')) {
    $('pActive').checked = product
      ? isProductActive(product)
      : true;
  }

  if ($('productMessage')) {
    $('productMessage').textContent = '';
  }

  modal.classList.remove('hidden');
}

/* ---------- ADD PRODUCT BUTTON ---------- */

$('newProduct')?.addEventListener('click', event => {
  event.preventDefault();
  openProduct();
});

/* ---------- CLOSE / CANCEL ---------- */

$('closeModal')?.addEventListener('click', () => {
  $('productModal')?.classList.add('hidden');
  resetImagePicker();
});

$('cancelProduct')?.addEventListener('click', () => {
  $('productModal')?.classList.add('hidden');
  resetImagePicker();
});

/* ---------- AUTO-GENERATE SLUG ---------- */

$('pName')?.addEventListener('input', () => {
  const slugField = $('pSlug');

  if (slugField && !$('productId')?.value) {
    slugField.value = $('pName').value
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
  }
});

/* ---------- UPLOAD IMAGE ---------- */

async function uploadProductImage(file) {
  if (!file) return null;

  const extensions = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
    'image/gif': 'gif'
  };

  const extension = extensions[file.type];

  if (!extension) {
    throw new Error('Choose a JPG, PNG, WEBP or GIF image.');
  }

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

/* ---------- SAVE PRODUCT TO SUPABASE ---------- */

async function saveProductRecord(record, id) {
  const productData = {
    name: record.name,
    description: record.description,
    category: record.category,
    price: record.price,
    image_urls: record.image_url ? [record.image_url] : [],
    sizes: record.sizes,
    stock_by_size: { total: record.stock },
    active: Boolean(record.is_active),
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
    const description = $('pDescription')?.value.trim() || '';
    const category = $('pCategory')?.value.trim() || 'Chikankari Suits';
    const priceText = $('pPrice')?.value ?? '';
    const price = Number(priceText);

    if (!name) {
      throw new Error('Please enter the product name.');
    }

    if (
      priceText === '' ||
      !Number.isFinite(price) ||
      price < 0
    ) {
      throw new Error('Please enter a valid product price.');
    }

    const sizes = ($('pSizes')?.value || '')
      .split(',')
      .map(size => size.trim())
      .filter(Boolean);

    if (!sizes.length) {
      throw new Error('Please enter at least one size.');
    }

    const stockText = $('pStock')?.value ?? '0';
    const stock = Number.parseInt(stockText, 10);

    if (!Number.isInteger(stock) || stock < 0) {
      throw new Error('Stock must be zero or a positive whole number.');
    }

    let imageUrl = '';

    // HTML mein file input ka actual ID pImageFile hai.
    const imageInput = $('pImageFile');
    const selectedFile = imageInput?.files?.[0] || null;

    // Edit karte waqt existing image ko preserve karein.
    const existingProductId = $('productId')?.value.trim() || '';

    if (existingProductId) {
      const existing = await supabase
        .from('products')
        .select('image_urls')
        .eq('id', existingProductId)
        .maybeSingle();

      if (existing.error) throw existing.error;

      const oldImages = existing.data?.image_urls;
      imageUrl = Array.isArray(oldImages) ? (oldImages[0] || '') : '';
    }

    if (selectedFile) {
      if (message) message.textContent = 'Uploading product image...';
      imageUrl = await uploadProductImage(selectedFile);
    }

    const record = {
      name,
      description,
      category,
      price,
      image_url: imageUrl || null,
      sizes,
      stock,
      is_active: $('pActive')?.checked ?? true
    };

    if (message) message.textContent = 'Saving product...';

    const { error } = await saveProductRecord(record, existingProductId);

    if (error) throw error;

    $('productModal')?.classList.add('hidden');
    resetImagePicker();

    toast(
      existingProductId
        ? 'Product updated successfully!'
        : 'Product added successfully!'
    );

    await loadProducts();
    await loadOverview();

  } catch (error) {
    console.error('Save product error:', error);

    if (message) {
      message.textContent =
        error.message || 'Could not save product. Please try again.';
    }
  } finally {
    if (saveButton) saveButton.disabled = false;
  }
});

/* ---------- INITIALISE ---------- */

setupImageUploader();

if (supabase) {
  supabase.auth.onAuthStateChange(() => {
    setTimeout(() => {
      requireAdmin();
    }, 0);
  });

  requireAdmin();
}
