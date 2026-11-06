import { getApp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";
import { getDatabase, ref, onValue, set, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-database.js";

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
};

let stopPostsListener = null;
onAuthStateChanged(auth, (user) => {
  if (stopPostsListener) {
    stopPostsListener();
    stopPostsListener = null;
  }
  if (!user) return;
  stopPostsListener = onValue(ref(db, "community/posts"), (snapshot) => {
    const data = snapshot.val() || {};
    const posts = Object.values(data).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    window.PeerSyncCloud?.receivePosts(posts);
  }, (error) => {
    console.error("PeerSync shared posts listener failed:", error);
  });
});
