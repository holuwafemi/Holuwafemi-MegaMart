// add-product.js
// Real backend wiring for the seller "Add Product" page.
// Requires window.__firebaseConfig to be set in add-product.html before this loads.

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import {
  getAuth, onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import {
  getFirestore, doc, getDoc, collection, addDoc, updateDoc, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import {
  getStorage, ref, uploadBytes, getDownloadURL
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-storage.js";

const app = initializeApp(window.__firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

let currentUser = null;
let uploadedFiles = []; // real File objects, used for upload
let uploadedPreviews = []; // object URLs, used for on-screen preview only

// ─────────────────────────────────────────────
// AUTH GATE
// This is what actually stops a shared link from being useful to a
// random person: the page content stays hidden until we confirm the
// signed-in user has an approved seller record in Firestore.
// ─────────────────────────────────────────────
onAuthStateChanged(auth, async (user) => {
  const checkingEl = document.getElementById('authChecking');
  const contentEl = document.getElementById('pageContent');

  if (!user) {
    // Not logged in at all — send them to login, then back here after.
    window.location.href = 'login.html?redirect=add-product.html';
    return;
  }

  try {
    const sellerDoc = await getDoc(doc(db, 'sellers', user.uid));
    if (!sellerDoc.exists() || sellerDoc.data().status !== 'approved') {
      checkingEl.innerHTML = `
        You don't have an approved seller account yet.<br><br>
        <a href="index.html" style="color:var(--navy);font-weight:700;">Return to homepage</a>
        — or use "Sell on Holuwafemi" to start the application.
      `;
      return;
    }

    // Approved seller — reveal the form.
    currentUser = user;
    document.getElementById('sellerWelcome').textContent =
      `Listing as ${sellerDoc.data().businessName || 'your store'} — new listings go into review before going live.`;
    checkingEl.style.display = 'none';
    contentEl.style.display = 'block';
    initUploadZoneDragEvents();

  } catch (err) {
    checkingEl.textContent = 'Could not verify your seller access. Please try again shortly.';
    console.error(err);
  }
});

function initUploadZoneDragEvents(){
  const zone = document.getElementById('uploadZone');
  ['dragover', 'dragleave', 'drop'].forEach(evt => {
    zone.addEventListener(evt, e => {
      e.preventDefault();
      zone.classList.toggle('dragover', evt === 'dragover');
      if (evt === 'drop') handleFiles(e.dataTransfer.files);
    });
  });
}

function handleFiles(fileList){
  const remaining = 5 - uploadedFiles.length;
  const files = Array.from(fileList).slice(0, remaining);
  files.forEach(file => {
    if (!file.type.startsWith('image/')) return;
    uploadedFiles.push(file);
    uploadedPreviews.push(URL.createObjectURL(file));
  });
  renderPhotos();
}

function renderPhotos(){
  const grid = document.getElementById('photoGrid');
  grid.innerHTML = uploadedPreviews.map((src, i) => `
    <div class="photo-slot ${i === 0 ? 'main-tag' : ''}">
      <img src="${src}">
      <div class="rm" onclick="window.removePhoto(${i})">✕</div>
    </div>
  `).join('');
}

function removePhoto(i){
  uploadedFiles.splice(i, 1);
  uploadedPreviews.splice(i, 1);
  renderPhotos();
}

async function submitProduct(){
  if (!currentUser) return;

  const name = document.getElementById('fName').value.trim();
  const category = document.getElementById('fCategory').value;
  const brand = document.getElementById('fBrand').value.trim();
  const price = parseFloat(document.getElementById('fPrice').value);
  const stock = parseInt(document.getElementById('fStock').value, 10);
  const description = document.getElementById('fDescription').value.trim();

  if (uploadedFiles.length === 0) { alert('Please add at least one product photo.'); return; }
  if (!name || !price || !stock) { alert('Please fill in product name, price, and stock quantity.'); return; }

  const submitBtn = document.getElementById('submitBtn');
  submitBtn.disabled = true;
  submitBtn.textContent = 'Uploading photos…';

  try {
    // 1. Create the Firestore doc first so we have a productId for the storage path.
    const productRef = await addDoc(collection(db, 'products'), {
      sellerId: currentUser.uid,
      name, category, brand, price, stock, description,
      status: 'pending',        // seller can never set this to "approved" themselves
      isFlashSale: false,       // admin-only field — see firestore.rules
      discountPercent: 0,
      photos: [],
      createdAt: serverTimestamp()
    });

    // 2. Upload each photo to Storage under this seller's own folder.
    const photoUrls = [];
    for (let i = 0; i < uploadedFiles.length; i++) {
      submitBtn.textContent = `Uploading photo ${i + 1} of ${uploadedFiles.length}…`;
      const fileRef = ref(storage, `products/${currentUser.uid}/${productRef.id}/${i}.jpg`);
      await uploadBytes(fileRef, uploadedFiles[i]);
      photoUrls.push(await getDownloadURL(fileRef));
    }

    // 3. Attach the photo URLs to the product doc.
    await updateDoc(productRef, { photos: photoUrls });

    submitBtn.textContent = 'Submitted!';
    alert('Your product has been submitted for review. You\'ll be notified once approved.');
    window.location.href = 'index.html';

  } catch (err) {
    console.error(err);
    alert('Something went wrong submitting your product. Please try again.');
    submitBtn.disabled = false;
    submitBtn.textContent = 'Submit for Review';
  }
}

// Expose the handlers this page's inline onclick= attributes call.
window.handleFiles = handleFiles;
window.removePhoto = removePhoto;
window.submitProduct = submitProduct;
