
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const $ = (id) => document.getElementById(id);

const configured =
  window.LABEL_AWADH_SUPABASE_URL?.startsWith('https://') &&
  !window.LABEL_AWADH_SUPABASE_URL.includes('PASTE_') &&
  window.LABEL_AWADH_SUPABASE_KEY &&
  !window.LABEL_AWADH_SUPABASE_KEY.includes('PASTE_');

let supabase = null;
let currentTab = 'overview';
let selectedImageFile = null;
let previewObjectUrl = null;

const statusOptions = [
  'pending', 'confirmed', 'processing',
  'shipped', 'delivered', 'cancelled'
];

if (!configured) {
  if ($('setupNotice')) {
    $('setupNotice').classList.remove('hidden');
    $('setupNotice').innerHTML =
      '<b>Setup required:</b> Check public/admin/config.js. Never use a service_role key here.';
  }

  if ($('connectionState')) {
    $('connectionState').textContent = 'Setup required';
  }
} else {
  supabase = createClient(
    window.LABEL_AWADH_SUPABASE_URL,
    window.LABEL_AWADH_SUPABASE_KEY
  );

  if ($('connectionState')) {
    $('connectionState').textContent = 'Configured';
  }
}

/* ---------- HELPERS ---------- */

function money(value, alreadyPaise = false) {
  const amount = Number(value) || 0;

  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0
  }).format(alreadyPaise ? amount / 100 : amount);
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

  setTimeout(() => {
    $('toast').classList.remove('show');
  }, 2800);
}

/* ---------- NAVIGATION ---------- */

function showTab(tab) {
  currentTab = tab;

  document.querySelectorAll('.nav').forEach(button => {
    button.classList.toggle('active', button.dataset.tab === tab);
  });

  ['overview', 'products', 'orders'].forEach(name => {
    if ($(name + 'Tab')) {
      $(name + 'Tab').classList.toggle('hidden', name !== tab);
    }
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

/* ---------- LOGIN AND ADMIN ACCESS ---------- */

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
  if (!supabase) return;

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

  if (error || !data) {
    await supabase.auth.signOut();

    showLogin(
      'This account has no admin access. Check admin_users.'
    );

    return;
  }

  showApp(session.user.email);
}

$('signIn')?.addEventListener('click', async () => {
  if (!supabase) {
    $('loginMessage').textContent =
      'Please complete Supabase config first.';
    return;
  }

  const email = $('email').value.trim();
  const password = $('password').value;

  if (!email || !password) {
    $('loginMessage').textContent =
      'Enter your email and password.';
    return;
  }

  $('signIn').disabled = true;
  $('loginMessage').textContent = 'Signing in…';

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
  await supabase?.auth.signOut();
  showLogin();
  toast('Signed out');
});

/* ---------- DASHBOARD ---------- */

async function loadOverview() {
  if (!supabase) return;

  const [products, orders] = await Promise.all([
    supabase
      .from('products')
      .select('id', { count: 'exact', head: true }),

    supabase
      .from('orders')
      .select(
        'id,status,order_number,customer_name,total_paise,created_at'
      )
      .order('created_at', { ascending: false })
      .limit(6)
  ]);

  if (products.error || orders.error) {
    toast((products.error || orders.error).message);
    return;
  }

  if ($('productCount')) {
    $('productCount').textContent = products.count ?? 0;
  }

  if ($('orderCount')) {
    $('orderCount').textContent = orders.data.length;
  }

  if ($('pendingCount')) {
    $('pendingCount').textContent =
      orders.data.filter(order => order.status === 'pending').length;
  }

  if ($('recentOrders')) {
    $('recentOrders').innerHTML =
      ordersMarkup(orders.data, false);
  }
}

function ordersMarkup(rows, withActions) {
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
          <td>#${esc(
            order.order_number ?? String(order.id).slice(0, 8)
          )}</td>

          <td>${esc(order.customer_name || '-')}</td>

          <td>${money(order.total_paise, true)}</td>

          <td>
            <span class="pill ${
              order.status === 'delivered' ? 'green' :
              order.status === 'cancelled' ? 'red' : ''
            }">${esc(order.status || 'pending')}</span>
          </td>

          <td>
            ${order.created_at
              ? new Date(order.created_at).toLocaleDateString('en-IN')
              : '-'}
          </td>

          ${withActions ? `<td>
            <select
              aria-label="Update order status"
              data-status-id="${esc(order.id)}">

              ${statusOptions.map(status => `
                <option
                  value="${status}"
                  ${status === order.status ? 'selected' : ''}>
                  ${status}
                </option>
              `).join('')}
            </select>

            <button
              class="table-action"
              data-save-status="${esc(order.id)}">
              Save
            </button>
          </td>` : ''}
        </tr>
      `).join('')}
    </tbody>
  </table>`;
}

async function loadOrders() {
  if (!supabase) return;

  const { data, error } = await supabase
    .from('orders')
    .select(
      'id,order_number,customer_name,total_paise,status,created_at'
    )
    .order('created_at', { ascending: false })
    .limit(200);

  if (error) {
    $('ordersTable').innerHTML =
      `<p class="message">${esc(error.message)}</p>`;
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
        .update({
          status: select.value,
          updated_at: new Date().toISOString()
        })
        .eq('id', id);

      if (updateError) {
        toast(updateError.message);
      } else {
        toast('Order status updated');
        await loadOrders();
      }
    });
  });
}

$('refreshOrders')?.addEventListener('click', loadOrders);

/* ---------- PRODUCT HELPERS ---------- */

function productPrice(product) {
  if (product.price_paise != null) {
    return Number(product.price_paise) / 100;
  }

  return Number(product.price) || 0;
}

function productImages(product) {
  if (Array.isArray(product.image_urls)) {
    return product.image_urls;
  }

  if (product.image_url) {
    return [product.image_url];
  }

  return [];
}

function productSizes(product) {
  if (Array.isArray(product.sizes)) {
    return product.sizes;
  }

  if (typeof product.sizes === 'string') {
    return product.sizes
      .split(',')
      .map(size => size.trim())
      .filter(Boolean);
  }

  return [];
}

function isProductActive(product) {
  return product.active ?? product.is_active ?? false;
}

/* ---------- LOAD PRODUCTS ---------- */

async function loadProducts() {
  if (!supabase) return;

  const { data, error } = await supabase
    .from('products')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    $('productsTable').innerHTML =
      `<p class="message">${esc(error.message)}</p>`;
    return;
  }

  if (!data?.length) {
    $('productsTable').innerHTML =
      '<p class="muted">No products yet. Click “Add product” to create the first one.</p>';
    return;
  }

  $('productsTable').innerHTML = `<table>
    <thead>
      <tr>
        <th>PRODUCT</th>
        <th>PRICE</th>
        <th>SIZES / STOCK</th>
        <th>STATUS</th>
        <th>ACTIONS</th>
      </tr>
    </thead>
    <tbody>
      ${data.map(product => `
        <tr>
          <td>
            <b>${esc(product.name)}</b><br>
            <small class="muted">${esc(product.slug || '')}</small>
          </td>

          <td>${money(productPrice(product))}</td>

          <td>${esc(productSizes(product).join(', ') || '-')}</td>

          <td>
            <span class="pill ${
              isProductActive(product) ? 'green' : 'red'
            }">
              ${isProductActive(product) ? 'Published' : 'Draft'}
            </span>
          </td>

          <td>
            <button
              class="table-action"
              data-edit="${esc(product.id)}">
              Edit
            </button>

            <button
              class="table-action"
              data-delete="${esc(product.id)}">
              Delete
            </button>
          </td>
        </tr>
      `).join('')}
    </tbody>
  </table>`;

  document.querySelectorAll('[data-edit]').forEach(button => {
    button.addEventListener('click', () => {
      openProduct(
        data.find(
          product => String(product.id) === button.dataset.edit
        )
      );
    });
  });

  document.querySelectorAll('[data-delete]').forEach(button => {
    button.addEventListener('click', async () => {
      const product = data.find(
        item => String(item.id) === button.dataset.delete
      );

      if (!product || !confirm(`Delete "${product.name}"?`)) {
        return;
      }

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

/* ---------- IMAGE UPLOADER ---------- */

function setupImageUploader() {
  const textarea = $('pImages');

  if (!textarea || $('pImageFile')) return;

  const wrapper = document.createElement('div');
  wrapper.style.cssText = 'margin:12px 0;';

  wrapper.innerHTML = `
    <label
      for="pImageFile"
      style="display:block;margin-bottom:8px">
      Product image — choose a file (maximum 5 MB)
    </label>

    <input
      id="pImageFile"
      type="file"
      accept="image/jpeg,image/png,image/webp,image/gif"
      style="display:block;max-width:100%;margin-bottom:10px">

    <img
      id="pImagePreview"
      alt="Product image preview"
      style="display:none;width:130px;height:150px;object-fit:cover;border-radius:8px;margin-bottom:10px">

    <p class="muted" style="font-size:12px">
      Select a photo from your computer. It will be uploaded to Supabase Storage when you save the product.
    </p>`;

  textarea.parentElement.insertBefore(wrapper, textarea);

  $('pImageFile').addEventListener('change', event => {
    selectedImageFile = event.target.files?.[0] || null;

    const preview = $('pImagePreview');

    if (previewObjectUrl) {
      URL.revokeObjectURL(previewObjectUrl);
    }

    previewObjectUrl = null;

    if (!selectedImageFile) {
      preview.style.display = 'none';
      preview.removeAttribute('src');
      return;
    }

    if (!selectedImageFile.type.startsWith('image/')) {
      toast('Please choose an image file.');
      selectedImageFile = null;
      event.target.value = '';
      return;
    }

    if (selectedImageFile.size > 5 * 1024 * 1024) {
      toast('Image must be smaller than 5 MB.');
      selectedImageFile = null;
      event.target.value = '';
      return;
    }

    previewObjectUrl = URL.createObjectURL(selectedImageFile);
    preview.src = previewObjectUrl;
    preview.style.display = 'block';
  });
}

function resetImagePicker() {
  selectedImageFile = null;

  if ($('pImageFile')) {
    $('pImageFile').value = '';
  }

  if ($('pImagePreview')) {
    $('pImagePreview').style.display = 'none';
    $('pImagePreview').removeAttribute('src');
  }

  if (previewObjectUrl) {
    URL.revokeObjectURL(previewObjectUrl);
  }

  previewObjectUrl = null;
}

/* ---------- ADD / EDIT PRODUCT ---------- */

function openProduct(product = null) {
  $('productForm').reset();
  resetImagePicker();

  $('productId').value = product?.id ?? '';
  $('modalTitle').textContent = product ? 'Edit product' : 'Add product';

  $('pName').value = product?.name || '';
  $('pSlug').value = product?.slug || '';
  $('pDescription').value = product?.description || '';
  $('pCategory').value = product?.category || 'Chikankari Suits';
  $('pPrice').value = product ? productPrice(product) : '';

  const comparePrice = product?.compare_at_price_paise != null
    ? Number(product.compare_at_price_paise) / 100
    : product?.compare_at_price ?? '';

  $('pCompare').value = comparePrice || '';

  $('pSizes').value = product
    ? productSizes(product).join(', ')
    : 'S, M, L, XL';

  $('pImages').value = product
    ? productImages(product).join('\n')
    : '';

  const stock = product?.stock_by_size || {};

  $('pStock').value = Object.keys(stock).length
    ? Object.entries(stock)
        .map(([size, quantity]) => `${size}:${quantity}`)
        .join(', ')
    : `S:${product?.stock ?? 0}, M:0, L:0, XL:0`;

  $('pActive').checked = product
    ? isProductActive(product)
    : true;

  $('productMessage').textContent = '';
  $('productModal').classList.remove('hidden');
}

$('newProduct')?.addEventListener('click', () => openProduct());

$('closeModal')?.addEventListener('click', () => {
  $('productModal').classList.add('hidden');
  resetImagePicker();
});

$('cancelProduct')?.addEventListener('click', () => {
  $('productModal').classList.add('hidden');
  resetImagePicker();
});

$('pName')?.addEventListener('input', () => {
  if (!$('productId').value) {
    $('pSlug').value = $('pName').value
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
  }
});

/* ---------- UPLOAD IMAGE TO SUPABASE STORAGE ---------- */

async function uploadProductImage(file) {
  const allowedTypes = [
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/gif'
  ];

  if (!allowedTypes.includes(file.type)) {
    throw new Error('Use a JPG, PNG, WEBP or GIF image.');
  }

  if (file.size > 5 * 1024 * 1024) {
    throw new Error('Image must be smaller than 5 MB.');
  }

  const extension = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
    'image/gif': 'gif'
  }[file.type];

  const path = `${crypto.randomUUID()}.${extension}`;

  const { error } = await supabase.storage
    .from('product-images')
    .upload(path, file, {
      upsert: false,
      contentType: file.type
    });

  if (error) {
    if (
      error.message?.toLowerCase().includes('row-level security') ||
      error.message?.toLowerCase().includes('permission')
    ) {
      throw new Error(
        'Image upload permission denied. Check the product-images Storage policies and admin_users entry.'
      );
    }

    throw error;
  }

  const { data } = supabase.storage
    .from('product-images')
    .getPublicUrl(path);

  return data.publicUrl;
}

/* ---------- SAVE PRODUCT: SUPPORT BOTH SCHEMAS ---------- */

async function saveProductRecord(record, id) {
  const images = Array.isArray(record.image_urls)
    ? record.image_urls
    : [];

  const product = {
    name: record.name,
    description: record.description,
    category: record.category,
    price: Number(record.price_paise || 0) / 100,
    image_url: images[0] || null,
    sizes: Array.isArray(record.sizes)
      ? record.sizes.join(', ')
      : String(record.sizes || ''),
    stock: Object.values(record.stock_by_size || {})
      .reduce((sum, value) => sum + (Number(value) || 0), 0),
    is_active: Boolean(record.active)
  };

  if (id) {
    return await supabase
      .from('products')
      .update(product)
      .eq('id', id);
  }

  return await supabase
    .from('products')
    .insert(product);
}
/* ---------- SAVE PRODUCT FORM ---------- */

$('productForm')?.addEventListener('submit', async event => {
  event.preventDefault();

  if (!supabase) return;

  const saveButton = $('productForm')
    .querySelector('[type="submit"]');

  if (saveButton) saveButton.disabled = true;

  $('productMessage').textContent = 'Saving product…';

  try {
    const sizes = $('pSizes').value
      .split(',')
      .map(size => size.trim())
      .filter(Boolean);

    const stock = {};

    $('pStock').value.split(',').forEach(part => {
      const [key, value] = part
        .split(':')
        .map(item => item.trim());

      if (key) {
        stock[key] = Math.max(
          0,
          parseInt(value || '0', 10) || 0
        );
      }
    });

    const price = Math.round(
      Number($('pPrice').value) * 100
    );

    const compare = $('pCompare').value === ''
      ? null
      : Math.round(Number($('pCompare').value) * 100);

    if (compare !== null && compare < price) {
      $('productMessage').textContent =
        'Compare-at price should be equal to or higher than the selling price.';
      return;
    }

    let imageUrls = $('pImages').value
      .split('\n')
      .map(value => value.trim())
      .filter(Boolean);

    // Upload the selected local file first.
    if (selectedImageFile) {
      $('productMessage').textContent = 'Uploading image…';

      const uploadedUrl = await uploadProductImage(
        selectedImageFile
      );

      imageUrls = [uploadedUrl, ...imageUrls];
    }

    const record = {
      slug: $('pSlug').value.trim(),
      name: $('pName').value.trim(),
      description: $('pDescription').value.trim(),
      category: $('pCategory').value.trim(),
      price_paise: price,
      compare_at_price_paise: compare,
      image_urls: [...new Set(imageUrls)],
      sizes,
      stock_by_size: stock,
      active: $('pActive').checked,
      updated_at: new Date().toISOString()
    };

    const id = $('productId').value;

    const result = await saveProductRecord(record, id);

    if (result.error) {
      $('productMessage').textContent =
        result.error.message;
      return;
    }

    $('productModal').classList.add('hidden');
    resetImagePicker();

    toast(id ? 'Product updated' : 'Product added');

    await loadProducts();
  } catch (error) {
    $('productMessage').textContent =
      error.message || 'Could not save the product.';
  } finally {
    if (saveButton) saveButton.disabled = false;
  }
});

/* ---------- INITIALISE ---------- */

setupImageUploader();

if (supabase) {
  supabase.auth.onAuthStateChange(() => {
    setTimeout(requireAdmin, 0);
  });

  requireAdmin();
}
