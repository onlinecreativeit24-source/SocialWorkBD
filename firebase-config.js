/* =========================================================
   SocialWorkBD - Firebase Configuration
   Firebase Authentication + Firestore + Storage
   ========================================================= */

const firebaseConfig = {
  apiKey: "AIzaSyDsqRgRZTKZFvfu0r4UJc8Q5xlS7lBL41c",
  authDomain: "socialworkbd-b1c00.firebaseapp.com",
  projectId: "socialworkbd-b1c00",
  storageBucket: "socialworkbd-b1c00.firebasestorage.app",
  messagingSenderId: "999070456562",
  appId: "1:999070456562:web:67101bb3148b157e67ce6b",
  measurementId: "G-XVBRYV71BZ"
};


/* ---------------------------------------------------------
   Initialize Firebase
--------------------------------------------------------- */

if (typeof firebase === "undefined") {
  console.error(
    "Firebase SDK is not loaded. Please check your Firebase script tags."
  );
} else {

  if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
  }

  /* -------------------------------------------------------
     Firebase Services
  ------------------------------------------------------- */

  window.auth = firebase.auth();

  window.db = firebase.firestore();

  /*
   * Firebase Storage
   *
   * Requires firebase-storage-compat SDK to be loaded
   * before this file.
   */

  if (typeof firebase.storage === "function") {
    window.storage = firebase.storage();
  } else {
    window.storage = null;

    console.warn(
      "Firebase Storage SDK is not loaded. Storage features are disabled."
    );
  }

}


/* ---------------------------------------------------------
   Global Firebase Status
--------------------------------------------------------- */

window.SocialWorkBDFirebase = {
  initialized:
    typeof firebase !== "undefined" &&
    firebase.apps.length > 0,

  projectId: firebaseConfig.projectId,

  auth: window.auth || null,

  db: window.db || null,

  storage: window.storage || null
};
