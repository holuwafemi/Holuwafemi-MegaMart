// site-auth.js
// Shared across every page. Updates the header "Account" link to reflect
// real Firebase Auth state, and wires up a working logout.
// Requires window.__firebaseConfig to be set before this loads.

import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

const app = getApps().length ? getApps()[0] : initializeApp(window.__firebaseConfig);
const auth = getAuth(app);

function renderAccountLink(user){
  const el = document.getElementById('accountLink');
  if (!el) return;

  if (user) {
    const label = user.email ? user.email.split('@')[0] : 'Account';
    el.innerHTML = `<span class="icon">👤</span>${label}`;
    el.removeAttribute('href');
    el.style.cursor = 'pointer';
    el.onclick = (e) => {
      e.preventDefault();
      if (confirm('Log out of Holuwafemi Mega Store?')) {
        signOut(auth).then(() => window.location.href = 'index.html');
      }
    };
  } else {
    el.innerHTML = `<span class="icon">👤</span>Account`;
    el.setAttribute('href', 'login.html');
    el.onclick = null;
  }
}

onAuthStateChanged(auth, (user) => {
  renderAccountLink(user);
  window.__currentUser = user; // other page scripts (cart, checkout) can read this
  document.dispatchEvent(new CustomEvent('authReady', { detail: { user } }));
});
