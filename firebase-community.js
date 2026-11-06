import { getApp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";
import { getDatabase, ref, onValue, get, set, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-database.js";

const app = getApp();
const auth = getAuth(app);
const db = getDatabase(app);

window.peerSyncPublishPost = async (post) => {
  const user = auth.currentUser;
  if (!user) throw new Error("You must be signed in to publish a post.");
  const postId = String(post.id);
  const sharedPost = {
    ...post,
    authorUid: user.uid,
    author: user.displayName || post.author,
    role: "student",
    createdAt: serverTimestamp()
  };
  await set(ref(db, `community/posts/${postId}`), sharedPost);
  return true;
};

let stopPostsListener = null;
let currentUser = null;

function showSyncError(message) {
  console.error("PeerSync shared posts:", message);
  const toast = document.querySelector("#toast");
  if (toast) {
    toast.textContent = message;
    toast.classList.add("show");
  }
}

function applySnapshot(snapshot) {
  const data = snapshot.val() || {};
  const posts = Object.values(data).sort((a, b) => {
    const timeA = typeof a.createdAt === "number" ? a.createdAt : 0;
    const timeB = typeof b.createdAt === "number" ? b.createdAt : 0;
    return timeB - timeA;
  });
  window.PeerSyncCloud?.receivePosts(posts);
}

async function refreshPosts() {
  if (!currentUser) return;
  try {
    const snapshot = await get(ref(db, "community/posts"));
    applySnapshot(snapshot);
  } catch (error) {
    showSyncError(`Couldn't load shared posts: ${error.code || error.message}. Check that the latest Realtime Database rules are published.`);
  }
}

onAuthStateChanged(auth, (user) => {
  currentUser = user;
  if (stopPostsListener) {
    stopPostsListener();
    stopPostsListener = null;
  }
  if (!user) return;
  stopPostsListener = onValue(ref(db, "community/posts"), applySnapshot, (error) => {
    showSyncError(`Couldn't read shared posts: ${error.code || error.message}. Publish the updated database rules.`);
  });
});

document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") refreshPosts();
});
window.addEventListener("online", refreshPosts);
