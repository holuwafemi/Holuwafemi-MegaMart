// login.js
// Real Firebase Authentication for customer/seller login and signup.
// Requires window.__firebaseConfig to be set in login.html before this loads.

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import {
  getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword,
  sendPasswordResetEmail, onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import {
  getFirestore, doc, setDoc, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

const app = initializeApp(window.__firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// Where to send the user after a successful login — e.g. login.html?redirect=add-product.html
const params = new URLSearchParams(window.location.search);
const redirectTo = params.get('redirect') || 'index.html';

// If already logged in, don't show the login form at all — go straight to redirect target.
onAuthStateChanged(auth, (user) => {
  if (user) window.location.href = redirectTo;
});

function setError(elId, message){
  const el = document.getElementById(elId);
  el.textContent = message;
  el.style.display = message ? 'block' : 'none';
}

async function doLogin(){
  setError('loginError', '');
  const email = document.getElementById('loginEmail').value.trim();
  const password = document.getElementById('loginPassword').value;

  if (!email || !password) {
    setError('loginError', 'Please enter your email and password.');
    return;
  }

  const btn = document.getElementById('loginBtn');
  btn.disabled = true;
  btn.textContent = 'Logging in…';

  try {
    await signInWithEmailAndPassword(auth, email, password);
    window.location.href = redirectTo;
  } catch (err) {
    setError('loginError', friendlyAuthError(err.code));
    btn.disabled = false;
    btn.textContent = 'Log In';
  }
}

async function doSignup(){
  setError('signupError', '');
  const name = document.getElementById('signupName').value.trim();
  const phone = document.getElementById('signupPhone').value.trim();
  const email = document.getElementById('signupEmail').value.trim();
  const password = document.getElementById('signupPassword').value;

  if (!name || !phone || !email || !password) {
    setError('signupError', 'Please fill in all fields.');
    return;
  }
  if (password.length < 6) {
    setError('signupError', 'Password must be at least 6 characters.');
    return;
  }

  const btn = document.getElementById('signupBtn');
  btn.disabled = true;
  btn.textContent = 'Creating account…';

  try {
    const cred = await createUserWithEmailAndPassword(auth, email, password);

    // This creates a CUSTOMER profile only. It does NOT create a seller record —
    // sellers are only ever added via the approveSeller Cloud Function after
    // manual vetting (see backend-rules/functions-seller-approval.js). Signing
    // up here does not grant access to add-product.html.
    await setDoc(doc(db, 'users', cred.user.uid), {
      name, phone, email,
      createdAt: serverTimestamp()
    });

    window.location.href = redirectTo;
  } catch (err) {
    setError('signupError', friendlyAuthError(err.code));
    btn.disabled = false;
    btn.textContent = 'Create Account';
  }
}

async function doResetPassword(){
  const email = document.getElementById('loginEmail').value.trim();
  if (!email) {
    setError('loginError', 'Enter your email above first, then click "Forgot password?" again.');
    return;
  }
  try {
    await sendPasswordResetEmail(auth, email);
    setError('loginError', '');
    alert('Password reset email sent to ' + email);
  } catch (err) {
    setError('loginError', friendlyAuthError(err.code));
  }
}

function friendlyAuthError(code){
  const map = {
    'auth/invalid-email': 'That email address looks invalid.',
    'auth/user-not-found': 'No account found with that email.',
    'auth/wrong-password': 'Incorrect password.',
    'auth/invalid-credential': 'Incorrect email or password.',
    'auth/email-already-in-use': 'An account already exists with that email.',
    'auth/weak-password': 'Password is too weak — use at least 6 characters.',
  };
  return map[code] || 'Something went wrong. Please try again.';
}

window.doLogin = doLogin;
window.doSignup = doSignup;
window.doResetPassword = doResetPassword;
