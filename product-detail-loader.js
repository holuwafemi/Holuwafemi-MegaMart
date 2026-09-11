// product-detail-loader.js
// If the page URL has ?id=<productId> and Firestore is configured, replace
// the static demo content with the real product. Otherwise the page keeps
// showing its built-in demo product untouched.

import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getFirestore, doc, getDoc } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

function isConfigured(){
  return window.__firebaseConfig && window.__firebaseConfig.apiKey !== "REPLACE_ME";
}

function formatNaira(n){
  return '₦' + Number(n).toLocaleString('en-NG');
}

async function loadProduct(){
  const params = new URLSearchParams(window.location.search);
  const id = params.get('id');
  if (!id || !isConfigured()) return; // keep static demo content

  const app = getApps().length ? getApps()[0] : initializeApp(window.__firebaseConfig);
  const db = getFirestore(app);

  try {
    const snap = await getDoc(doc(db, 'products', id));
    if (!snap.exists()) return;
    const p = snap.data();

    document.getElementById('pdName').textContent = p.name;
    document.getElementById('pdBreadcrumbName').textContent = p.name;
    document.getElementById('pdBrandTag').textContent = p.brand ? `${p.brand} · Sold by Holuwafemi Mega Store` : 'Sold by Holuwafemi Mega Store';
    document.getElementById('pdPrice').textContent = formatNaira(p.price);

    // Vendor products don't have a "was" discounted price unless flagged by admin as a flash sale
    if (p.isFlashSale && p.discountPercent > 0) {
      const originalPrice = Math.round(p.price / (1 - p.discountPercent / 100));
      document.getElementById('pdWas').textContent = formatNaira(originalPrice);
      document.getElementById('pdOff').textContent = `-${p.discountPercent}%`;
    } else {
      document.getElementById('pdWas').style.display = 'none';
      document.getElementById('pdOff').style.display = 'none';
    }

    document.getElementById('pdStock').textContent = p.stock > 0
      ? `✓ In stock — ${p.stock} available`
      : '✗ Out of stock';
    document.getElementById('pdStockNote').textContent = p.stock > 0 && p.stock < 15
      ? `Only ${p.stock} left`
      : '';

    if (p.photos && p.photos.length > 0) {
      document.getElementById('mainImg').src = p.photos[0];
      document.getElementById('pdThumbs').innerHTML = p.photos.map((url, i) => `
        <div class="thumb ${i === 0 ? 'active' : ''}" onclick="window.setMainFromUrl && window.setMainFromUrl('${url}', this)">
          <img src="${url}">
        </div>
      `).join('');
      window.setMainFromUrl = (url, el) => {
        document.getElementById('mainImg').src = url;
        document.querySelectorAll('#pdThumbs .thumb').forEach(t => t.classList.remove('active'));
        el.classList.add('active');
      };
    }

    document.getElementById('tab-desc').textContent = p.description || 'No description provided.';

  } catch (err) {
    console.error('Could not load product:', err);
    // leave static demo content in place on error
  }
}

loadProduct();
