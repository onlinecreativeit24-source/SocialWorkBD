/* =========================================================
   SocialWorkBD - Firebase Configuration
   ========================================================= */

// Direct Config Object (Aapnar Firebase Console theke pawa key gulo ekhane boshan)
const firebaseConfig = {
  apiKey: "YOUR_FIREBASE_API_KEY",
  authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT_ID.appspot.com",
  messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
  appId: "YOUR_APP_ID",
  measurementId: "YOUR_MEASUREMENT_ID"
};

// Configuration Validate Korar Function
function validateFirebaseConfig() {
  const requiredKeys = [
    'apiKey',
    'authDomain',
    'projectId',
    'storageBucket',
    'messagingSenderId',
    'appId'
  ];

  for (const key of requiredKeys) {
    if (!firebaseConfig[key] || firebaseConfig[key].includes('YOUR_')) {
      console.error(
        `Firebase configuration error: ${key} is missing or has placeholder value. ` +
        'Please update firebase-config.js with your actual Firebase credentials.'
      );
      return false;
    }
  }

  return true;
}

// Firebase Check & Initialization
if (typeof firebase === 'undefined') {
  console.error(
    'Firebase SDK is not loaded. Please check your Firebase script tags in HTML.'
  );
} else {
  if (!validateFirebaseConfig()) {
    console.error(
      'Cannot initialize Firebase due to missing configuration. ' +
      'Application will not function properly.'
    );
  } else {
    // App Initialize Kora
    if (!firebase.apps.length) {
      try {
        firebase.initializeApp(firebaseConfig);
        console.log('Firebase initialized successfully');
      } catch (error) {
        console.error('Firebase initialization error:', error);
      }
    }

    // Global Instances Setup
    window.auth = firebase.auth();
    window.db = firebase.firestore();

    if (typeof firebase.storage === 'function') {
      window.storage = firebase.storage();
    } else {
      window.storage = null;
      console.warn(
        'Firebase Storage SDK is not loaded. Storage features are disabled.'
      );
    }
  }
}

// Global Export Object
window.SocialWorkBDFirebase = {
  initialized:
    typeof firebase !== 'undefined' &&
    firebase.apps.length > 0 &&
    validateFirebaseConfig(),

  projectId: firebaseConfig.projectId,
  auth: window.auth || null,
  db: window.db || null,
  storage: window.storage || null,

  isReady: function () {
    return this.initialized && this.auth && this.db;
  }
};
