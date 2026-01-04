/**
 * Firebase Configuration - Single Source of Truth
 * 
 * SECURITY NOTES:
 * 1. This API key is designed to be public (Firebase client SDK requirement)
 * 2. Security is enforced via:
 *    - Firebase Security Rules (server-side)
 *    - Firebase App Check (recommended - enable in Firebase Console)
 *    - API Key Restrictions (set in Google Cloud Console)
 * 
 * IMPORTANT: Restrict your API key in Google Cloud Console:
 * 1. Go to: https://console.cloud.google.com/apis/credentials
 * 2. Select your API key
 * 3. Under "Application restrictions", select "HTTP referrers"
 * 4. Add your production domain(s)
 * 5. Under "API restrictions", select "Restrict key" and enable only:
 *    - Firebase Auth API
 *    - Cloud Firestore API
 *    - Identity Toolkit API
 */

const firebaseConfig = {
    apiKey: "AIzaSyBskaqU-j2lbMlPyUuZUBKzxlUzGh5jzTQ",
    authDomain: "habit-tracker-a34d0.firebaseapp.com",
    projectId: "habit-tracker-a34d0",
    storageBucket: "habit-tracker-a34d0.firebasestorage.app",
    messagingSenderId: "550617578412",
    appId: "1:550617578412:web:3b12fd2c3bb968c7fc9809",
    measurementId: "G-9LBX0LDEJD"
};

// Freeze configuration to prevent runtime modification
Object.freeze(firebaseConfig);

// Export for use in modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = firebaseConfig;
}

// Make available globally for inline scripts
window.FIREBASE_CONFIG = firebaseConfig;
