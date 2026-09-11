// products-loader.js
// Loads real products from Firestore into any grid on the page that has
// a [data-product-grid] attribute. Falls back to leaving existing static
// demo cards in place if Firestore config hasn't been filled in yet, so
// the mockup still looks fine before you connect your real project.

import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import {
  getFirestore, collection, query, where, orderBy, limit, getDocs
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

function isConfigured(){
  return window.__firebaseConfig && window.__firebaseConfig.apiKey !== "REPLACE_ME";
}

function formatNaira(n){
  return '₦' + Number(n).toLocaleString('en-NG');
}

function cardHtml(p){
  const photo = (p.photos && p.photos[0]) || `https://picsum.photos/seed/${p.id}/400/400`;
  return `
    <div class="pcard" onclick="window.location='product.html?id=${p.id}'" style="cursor:pointer">
      <div class="imgwrap"><img loading="lazy" src="${photo}" alt="${p.name}"></div>
      <div class="name">${p.name}</div>
      <div class="price-row"><span class="price">${formatNaira(p.price)}</span></div>
    </div>
  `;
}

async function loadGrid(el){
  if (!isConfigured()) return; // leave static demo cards as-is

  const app = getApps().length ? getApps()[0] : initializeApp(window.__firebaseConfig);
  const db = getFirestore(app);

  const mode = el.dataset.productGrid; // "select" | "shop" | "category"
  const urlParams = new URLSearchParams(window.location.search);
  const rawCat = el.dataset.category || urlParams.get('cat') || null;
  const catFilter = (rawCat === 'select') ? null : rawCat;
  const useSelectMode = mode === 'select' || rawCat === 'select';
  const max = parseInt(el.dataset.limit || '10', 10);

  let q;
  const productsRef = collection(db, 'products');

  if (useSelectMode) {
    // Newest approved products first — used on homepage, or shop.html?cat=select
    q = query(productsRef, where('status', '==', 'approved'), orderBy('createdAt', 'desc'), limit(max));
  } else if (catFilter) {
    q = query(productsRef, where('status', '==', 'approved'), where('category', '==', catFilter), limit(max));
  } else {
    q = query(productsRef, where('status', '==', 'approved'), limit(max));
  }

  try {
    const snap = await getDocs(q);
    if (snap.empty) return; // no approved products yet — leave demo cards visible

    el.innerHTML = snap.docs.map(d => cardHtml({ id: d.id, ...d.data() })).join('');
  } catch (err) {
    console.error('Could not load products:', err);
    // leave existing demo cards in place on error
  }
}

document.querySelectorAll('[data-product-grid]').forEach(loadGrid);
