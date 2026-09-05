// ==========================================
// SocialWorkBD - Firebase Configuration
// ==========================================

const firebaseConfig = {
  apiKey: "AIzaSyDsqRgRZTKZFvfu0rUJc8Q5xlS7lBL41c",
  authDomain: "socialworkbd-b1c00.firebaseapp.com",
  projectId: "socialworkbd-b1c00",
  storageBucket: "socialworkbd-b1c00.firebasestorage.app",
  messagingSenderId: "999070456562",
  appId: "1:999070456562:web:67101bb3148b157e67ce6b",
  measurementId: "G-XVBRYV71BZ"
};

if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}

window.auth = firebase.auth();
window.db = firebase.firestore();
