/* =========================================================
   SocialWorkBD - Firebase Configuration (browser / plain HTML)

   NOTE: Firebase *web* config values are public identifiers, not secrets.
   They are meant to be in client code. Real protection comes from
   firestore.rules + Authentication "Authorized domains".
   (The old version read process.env, which does not exist in a plain
   browser page, so Firebase never initialized -> app/no-app error.)
   ========================================================= */
(function () {
  "use strict";

  var firebaseConfig = {
    apiKey: "AIzaSyDsqRgRZTKZFvfu0r4UJc8Q5xlS7lBL41c",
    authDomain: "socialworkbd-b1c00.firebaseapp.com",
    projectId: "socialworkbd-b1c00",
    storageBucket: "socialworkbd-b1c00.firebasestorage.app",
    messagingSenderId: "999070456562",
    appId: "1:999070456562:web:67101bb3148b157e67ce6b",
    measurementId: "G-XVBRYV71BZ"
  };

  if (typeof firebase === "undefined") {
    console.error("Firebase SDK is not loaded. Add the firebase-app/auth/firestore script tags BEFORE firebase-config.js");
    window.SocialWorkBDFirebase = { initialized: false, isReady: function () { return false; } };
    return;
  }

  try {
    if (!firebase.apps.length) firebase.initializeApp(firebaseConfig);
  } catch (e) {
    console.error("Firebase initialization error:", e);
  }

  window.auth = typeof firebase.auth === "function" ? firebase.auth() : null;
  window.db = typeof firebase.firestore === "function" ? firebase.firestore() : null;
  window.storage = typeof firebase.storage === "function" ? firebase.storage() : null;

  window.SocialWorkBDFirebase = {
    initialized: firebase.apps.length > 0,
    projectId: firebaseConfig.projectId,
    auth: window.auth,
    db: window.db,
    storage: window.storage,
    isReady: function () { return this.initialized && !!this.auth && !!this.db; }
  };
})();
