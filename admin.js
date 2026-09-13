// admin.js
// Gated by a Firebase custom claim (admin: true) — NOT by knowing this URL.
// Anyone can find/guess this page's address; only an account with the admin
// claim set (via backend-rules/set-admin-claim.js, run once by you) can see
// or do anything here. See that file for how to make your own account admin.

import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import {
  getFirestore, collection, query, where, getDocs, doc, updateDoc
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { getFunctions, httpsCallable } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-functions.js";

const app = getApps().length ? getApps()[0] : initializeApp(window.__firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

let isAdmin = false;

onAuthStateChanged(auth, async (user) => {
  const checkingEl = document.getElementById('authChecking');
  const contentEl = document.getElementById('pageContent');

  if (!user) {
    window.location.href = 'login.html?redirect=admin.html';
    return;
  }

  try {
    // Force-refresh the token so a claim set moments ago (e.g. right after
    // running set-admin-claim.js) is picked up without needing to log out/in.
    const tokenResult = await user.getIdTokenResult(true);
    if (tokenResult.claims.admin !== true) {
      checkingEl.innerHTML = `
        This account doesn't have admin access.<br><br>
        <a href="index.html" style="color:var(--navy);font-weight:700;">Return to homepage</a>
      `;
      return;
    }

    isAdmin = true;
    checkingEl.style.display = 'none';
    contentEl.style.display = 'block';
    loadPendingProducts();
    loadApprovedProducts();

  } catch (err) {
    checkingEl.textContent = 'Could not verify admin access. Please try again.';
    console.error(err);
  }
});

function formatN(n){ return '₦' + Number(n).toLocaleString('en-NG'); }

async function loadPendingProducts(){
  const listEl = document.getElementById('pendingProductsList');
  try {
    const q = query(collection(db, 'products'), where('status', '==', 'pending'));
    const snap = await getDocs(q);

    if (snap.empty) {
      listEl.innerHTML = '<div class="empty-note">No pending products right now.</div>';
      return;
    }

    listEl.innerHTML = snap.docs.map(d => {
      const p = d.data();
      const photo = (p.photos && p.photos[0]) || 'https://picsum.photos/seed/pending/100/100';
      return `
        <div class="review-row" id="row-${d.id}">
          <img src="${photo}" alt="">
          <div class="info">
            <div class="name">${p.name}</div>
            <div class="meta">${p.category || 'Uncategorized'} · ${formatN(p.price)} · Qty: ${p.stock} · Seller: ${p.sellerId ? p.sellerId.slice(0,8) : 'unknown'}</div>
          </div>
          <div class="actions">
            <button class="btn-approve" onclick="window.approveProduct('${d.id}')">Approve</button>
            <button class="btn-reject" onclick="window.rejectProduct('${d.id}')">Reject</button>
          </div>
        </div>`;
    }).join('');
  } catch (err) {
    console.error(err);
    listEl.innerHTML = '<div class="empty-note">Could not load pending products.</div>';
  }
}

async function loadApprovedProducts(){
  const listEl = document.getElementById('approvedProductsList');
  try {
    const q = query(collection(db, 'products'), where('status', '==', 'approved'));
    const snap = await getDocs(q);

    if (snap.empty) {
      listEl.innerHTML = '<div class="empty-note">No approved products yet.</div>';
      return;
    }

    listEl.innerHTML = snap.docs.map(d => {
      const p = d.data();
      const photo = (p.photos && p.photos[0]) || 'https://picsum.photos/seed/approved/100/100';
      return `
        <div class="review-row" id="approved-${d.id}">
          <img src="${photo}" alt="">
          <div class="info">
            <div class="name">${p.name} ${p.isFlashSale ? '🔥 Flash Sale' : ''}</div>
            <div class="meta">${formatN(p.price)}</div>
          </div>
          <div class="actions" style="align-items:center;">
            ${p.isFlashSale
              ? `<button class="btn-reject" onclick="window.toggleFlashSale('${d.id}', false, 0)">Remove Flash Sale</button>`
              : `<div class="flash-inputs"><input type="number" id="discount-${d.id}" placeholder="%" min="1" max="90"></div>
                 <button class="btn-flash" onclick="window.setFlashSale('${d.id}')">Make Flash Sale</button>`
            }
          </div>
        </div>`;
    }).join('');
  } catch (err) {
    console.error(err);
    listEl.innerHTML = '<div class="empty-note">Could not load approved products.</div>';
  }
}

window.approveProduct = async function(productId){
  try {
    await updateDoc(doc(db, 'products', productId), { status: 'approved' });
    document.getElementById(`row-${productId}`).remove();
    loadApprovedProducts();
  } catch (err) {
    console.error(err);
    alert('Could not approve this product. Check that your account has the admin claim set.');
  }
};

window.rejectProduct = async function(productId){
  if (!confirm('Reject this product? The vendor will need to resubmit.')) return;
  try {
    await updateDoc(doc(db, 'products', productId), { status: 'rejected' });
    document.getElementById(`row-${productId}`).remove();
  } catch (err) {
    console.error(err);
    alert('Could not reject this product.');
  }
};

window.setFlashSale = async function(productId){
  const input = document.getElementById(`discount-${productId}`);
  const discount = parseInt(input.value, 10);
  if (!discount || discount < 1 || discount > 90) {
    alert('Enter a discount percentage between 1 and 90.');
    return;
  }
  try {
    await updateDoc(doc(db, 'products', productId), { isFlashSale: true, discountPercent: discount });
    loadApprovedProducts();
  } catch (err) {
    console.error(err);
    alert('Could not set flash sale.');
  }
};

window.toggleFlashSale = async function(productId, isFlash, discount){
  try {
    await updateDoc(doc(db, 'products', productId), { isFlashSale: isFlash, discountPercent: discount });
    loadApprovedProducts();
  } catch (err) {
    console.error(err);
    alert('Could not update flash sale status.');
  }
};

window.approveSellerNow = async function(){
  const sellerUid = document.getElementById('sellerUidInput').value.trim();
  const businessName = document.getElementById('sellerNameInput').value.trim();
  const category = document.getElementById('sellerCatInput').value;
  const statusEl = document.getElementById('sellerApproveStatus');

  if (!sellerUid || !businessName) {
    statusEl.style.color = 'var(--red)';
    statusEl.textContent = 'Please enter the seller\\'s UID and business name.';
    return;
  }

  statusEl.style.color = 'var(--ink-soft)';
  statusEl.textContent = 'Approving…';

  try {
    const functions = getFunctions(app);
    const approveSeller = httpsCallable(functions, 'approveSeller');
    await approveSeller({ sellerUid, businessName, category });
    statusEl.style.color = 'var(--green)';
    statusEl.textContent = `✓ ${businessName} approved as a seller.`;
    document.getElementById('sellerUidInput').value = '';
    document.getElementById('sellerNameInput').value = '';
  } catch (err) {
    console.error(err);
    statusEl.style.color = 'var(--red)';
    statusEl.textContent = 'Could not approve seller: ' + (err.message || 'unknown error');
  }
};
