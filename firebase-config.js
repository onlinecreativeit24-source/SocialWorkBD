/* =========================================================
   SocialWorkBD - Firebase Configuration
   SECURITY: Using environment variables for sensitive keys
   ========================================================= */

// Function to safely get environment variable
function getEnv(key, defaultValue = '') {
  if (typeof process !== 'undefined' && process.env) {
    return process.env[key] || defaultValue;
  }

  console.warn(`Environment variable ${key} not found`);
  return defaultValue;
}

// Firebase configuration - load from environment variables
const firebaseConfig = {
  apiKey: getEnv('REACT_APP_FIREBASE_API_KEY'),
  authDomain: getEnv('REACT_APP_FIREBASE_AUTH_DOMAIN'),
  projectId: getEnv('REACT_APP_FIREBASE_PROJECT_ID'),
  storageBucket: getEnv('REACT_APP_FIREBASE_STORAGE_BUCKET'),
  messagingSenderId: getEnv('REACT_APP_FIREBASE_MESSAGING_SENDER_ID'),
  appId: getEnv('REACT_APP_FIREBASE_APP_ID'),
  measurementId: getEnv('REACT_APP_FIREBASE_MEASUREMENT_ID')
};

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
    if (!firebaseConfig[key]) {
      console.error(
        `Firebase configuration error: ${key} is missing. ` +
        'Check your .env file and ensure all required variables are set.'
      );
      return false;
    }
  }

  return true;
}

if (typeof firebase === 'undefined') {
  console.error(
    'Firebase SDK is not loaded. Please check your Firebase script tags.'
  );
} else {
  if (!validateFirebaseConfig()) {
    console.error(
      'Cannot initialize Firebase due to missing configuration. ' +
      'Application will not function properly.'
    );
  } else {
    if (!firebase.apps.length) {
      try {
        firebase.initializeApp(firebaseConfig);
        console.log('Firebase initialized successfully');
      } catch (error) {
        console.error('Firebase initialization error:', error);
      }
    }

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

console.warn(
  '⚠️ SocialWorkBD: Ensure your Firebase configuration is loaded from ' +
  'environment variables (.env file), not hardcoded in the source.'
);
