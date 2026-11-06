import { initializeApp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js";
import {
  getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword,
  GoogleAuthProvider, signInWithPopup, onAuthStateChanged, signOut, updateProfile
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";
import {
  getDatabase, ref, get, set, update, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-database.js";

const firebaseConfig = {
  apiKey: "AIzaSyAHZFvxIQFb9qf7tcSWMIfyHpNu2fjZ1M",
  authDomain: "ppsync-a0d65.firebaseapp.com",
  databaseURL: "https://ppsync-a0d65-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "ppsync-a0d65",
  storageBucket: "ppsync-a0d65.firebasestorage.app",
  messagingSenderId: "83397572009",
  appId: "1:83397572009:web:4f39a3ee5fc40ca4f580b8",
  measurementId: "G-WTGF427TYP"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getDatabase(app);
const $ = (selector) => document.querySelector(selector);
let allowDemoEntry = false;
let authBusy = false;
let authInitialized = false;

function showMessage(message, isError = false) {
  const el = $("#authMessage");
  if (!el) return;
  el.textContent = message;
  el.style.color = isError ? "#b42318" : "";
}
function friendlyError(error) {
  const messages = {
    "auth/invalid-email": "Please enter a valid email address.",
    "auth/user-not-found": "No account was found for that email. Create a student account first.",
    "auth/wrong-password": "The email or password is incorrect.",
    "auth/invalid-credential": "The email or password is incorrect.",
    "auth/email-already-in-use": "An account already exists for this email. Try signing in.",
    "auth/weak-password": "Choose a password with at least 6 characters.",
    "auth/too-many-requests": "Too many attempts. Please wait a little and try again.",
    "auth/network-request-failed": "Network error. Check your connection and try again.",
    "auth/popup-closed-by-user": "The Google sign-in window was closed before finishing.",
    "auth/popup-blocked": "Your browser blocked the sign-in window. Allow pop-ups for this site and try again.",
    "auth/unauthorized-domain": "This website domain is not authorized in Firebase Authentication settings.",
    "auth/account-exists-with-different-credential": "An account already exists with this email using another sign-in method. Sign in with that method first."
  };
  return messages[error.code] || "Unable to complete sign-in. Check your details and Firebase Authentication settings.";
}
async function saveUserProfile(user, displayName = "") {
  const userRef = ref(db, `users/${user.uid}`);
  const snapshot = await get(userRef);
  const name = displayName || user.displayName || user.email?.split("@")[0] || "PeerSync Student";
  if (!snapshot.exists()) {
    await set(userRef, {
      uid: user.uid,
      displayName: name,
      email: user.email || "",
      role: "student",
      points: 0,
      createdAt: serverTimestamp()
    });
  } else {
    await update(userRef, {
      displayName: user.displayName || snapshot.val().displayName || name,
      email: user.email || snapshot.val().email || "",
      lastLoginAt: serverTimestamp()
    });
  }
  return name;
}
function enterWebsite(name) {
  $("#demoName").value = name;
  $("#demoRole").value = "student";
  allowDemoEntry = true;
  $("#enterBtn").click();
}
async function signIn() {
  if (authBusy) return;
  const email = $("#authEmail").value.trim();
  const password = $("#authPassword").value;
  if (!email || !password) return showMessage("Enter your email and password.", true);
  authBusy = true;
  $("#enterBtn").disabled = true;
  showMessage("Signing in…");
  try {
    const credential = await signInWithEmailAndPassword(auth, email, password);
    const name = await saveUserProfile(credential.user);
    enterWebsite(name);
  } catch (error) {
    showMessage(friendlyError(error), true);
  } finally {
    authBusy = false;
    $("#enterBtn").disabled = false;
  }
}

async function signInWithGoogle() {
  if (authBusy) return;
  authBusy = true;
  $("#googleSignInBtn").disabled = true;
  showMessage("Opening Google sign-in…");
  try {
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: "select_account" });
    const credential = await signInWithPopup(auth, provider);
    const name = await saveUserProfile(credential.user);
    enterWebsite(name);
  } catch (error) {
    console.error("PeerSync Google sign-in error:", error);
    const detail = error.code || error.message || "unknown error";
    showMessage(`${friendlyError(error)} (Details: ${detail})`, true);
  } finally {
    authBusy = false;
    $("#googleSignInBtn").disabled = false;
  }
}

async function createAccount() {
  if (authBusy) return;
  const name = $("#demoName").value.trim();
  const email = $("#authEmail").value.trim();
  const password = $("#authPassword").value;
  if (!name) return showMessage("Enter the name you want shown on your profile.", true);
  if (!email || !password) return showMessage("Enter an email address and password.", true);
  if (password.length < 6) return showMessage("Your password must be at least 6 characters.", true);
  authBusy = true;
  $("#createAccountBtn").disabled = true;
  showMessage("Creating your student account…");
  try {
    const credential = await createUserWithEmailAndPassword(auth, email, password);
    await updateProfile(credential.user, { displayName: name });
    await saveUserProfile(credential.user, name);
    enterWebsite(name);
  } catch (error) {
    showMessage(friendlyError(error), true);
  } finally {
    authBusy = false;
    $("#createAccountBtn").disabled = false;
  }
}

// Capture-phase handlers prevent the old prototype login/logout handlers from bypassing Firebase.
document.addEventListener("click", async (event) => {
  const target = event.target.closest("#enterBtn, #createAccountBtn, #googleSignInBtn, #logoutBtn");
  if (!target) return;
  if (target.id === "enterBtn" && allowDemoEntry) {
    allowDemoEntry = false;
    return;
  }
  event.preventDefault();
  event.stopImmediatePropagation();
  if (target.id === "enterBtn") await signIn();
  if (target.id === "createAccountBtn") await createAccount();
  if (target.id === "googleSignInBtn") await signInWithGoogle();
  if (target.id === "logoutBtn") {
    await signOut(auth);
    $("#app").classList.add("hidden");
    $("#loginScreen").classList.remove("hidden");
    showMessage("You have signed out.");
  }
}, true);

onAuthStateChanged(auth, async (user) => {
  // Restore an existing session only on the initial page load.
  if (authInitialized) return;
  authInitialized = true;
  if (!user) return;
  try {
    const name = await saveUserProfile(user);
    if ($("#loginScreen") && !$("#loginScreen").classList.contains("hidden")) enterWebsite(name);
  } catch (error) {
    showMessage("Signed in, but your profile could not be loaded. Check the Realtime Database rules.", true);
  }
});
