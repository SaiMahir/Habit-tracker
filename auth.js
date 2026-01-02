/**
 * Firebase Authentication Module
 * Handles user authentication, session management, and Firestore user data
 * 
 * Features:
 * - Email/Password login & signup
 * - Password reset via email
 * - User session persistence
 * - Firestore user document creation
 * - Error handling with user-friendly messages
 */

// ========================================
// Firebase SDK Imports (CDN Modular v10+)
// ========================================
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { 
    getAuth, 
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    signOut,
    sendPasswordResetEmail,
    onAuthStateChanged,
    updateProfile
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { 
    getFirestore, 
    doc, 
    setDoc, 
    getDoc,
    serverTimestamp 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// ========================================
// Firebase Configuration
// ========================================
const firebaseConfig = {
    apiKey: "AIzaSyBskAqU-j2lbMLpYuZUBKzxLUGh5jzTQ",
    authDomain: "habit-tracker-a34d0.firebaseapp.com",
    projectId: "habit-tracker-a34d0",
    storageBucket: "habit-tracker-a34d0.appspot.com",
    messagingSenderId: "550617578412",
    appId: "1:550617578412:web:3b12fd2c3bb968c7fc9809"
};

// ========================================
// Initialize Firebase
// ========================================
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// Log connection status
console.log("🔥 Firebase initialized successfully!");

// ========================================
// DOM Elements
// ========================================
const elements = {
    // Forms
    loginForm: document.getElementById('login-form'),
    signupForm: document.getElementById('signup-form'),
    forgotPasswordForm: document.getElementById('forgot-password-form'),
    
    // Login inputs
    loginEmail: document.getElementById('login-email'),
    loginPassword: document.getElementById('login-password'),
    
    // Signup inputs
    signupName: document.getElementById('signup-name'),
    signupEmail: document.getElementById('signup-email'),
    signupPassword: document.getElementById('signup-password'),
    signupConfirmPassword: document.getElementById('signup-confirm-password'),
    
    // Reset password input
    resetEmail: document.getElementById('reset-email'),
    
    // Tabs
    authTabs: document.querySelectorAll('.auth-tab'),
    
    // Message display
    authMessage: document.getElementById('auth-message'),
    
    // Password toggles
    passwordToggles: document.querySelectorAll('.password-toggle'),
    
    // Password strength
    passwordStrengthFill: document.getElementById('password-strength-fill'),
    passwordStrengthText: document.getElementById('password-strength-text'),
    
    // Forgot password link
    forgotPasswordLink: document.getElementById('forgot-password-link'),
    backToLoginBtn: document.getElementById('back-to-login-btn')
};

// ========================================
// Error Messages Map
// ========================================
const errorMessages = {
    'auth/email-already-in-use': 'This email is already registered. Try logging in instead.',
    'auth/invalid-email': 'Please enter a valid email address.',
    'auth/operation-not-allowed': 'Email/password accounts are not enabled.',
    'auth/weak-password': 'Password is too weak. Use at least 6 characters.',
    'auth/user-disabled': 'This account has been disabled.',
    'auth/user-not-found': 'No account found with this email.',
    'auth/wrong-password': 'Incorrect password. Please try again.',
    'auth/invalid-credential': 'Invalid email or password. Please check and try again.',
    'auth/too-many-requests': 'Too many failed attempts. Please try again later.',
    'auth/network-request-failed': 'Network error. Please check your connection.',
    'auth/popup-closed-by-user': 'Sign-in popup was closed before completing.',
    'auth/requires-recent-login': 'Please log in again to complete this action.',
    'default': 'An error occurred. Please try again.'
};

// ========================================
// Utility Functions
// ========================================

/**
 * Display a message to the user
 * @param {string} message - Message text
 * @param {string} type - Message type: 'error', 'success', or 'info'
 */
function showMessage(message, type = 'error') {
    const iconMap = {
        error: '❌',
        success: '✅',
        info: 'ℹ️'
    };
    
    elements.authMessage.className = `auth-message show ${type}`;
    elements.authMessage.innerHTML = `
        <span class="message-icon">${iconMap[type]}</span>
        <span class="message-text">${message}</span>
    `;
    
    // Auto-hide after 5 seconds
    setTimeout(() => {
        elements.authMessage.classList.remove('show');
    }, 5000);
}

/**
 * Get user-friendly error message
 * @param {string} errorCode - Firebase error code
 * @returns {string} User-friendly message
 */
function getErrorMessage(errorCode) {
    return errorMessages[errorCode] || errorMessages['default'];
}

/**
 * Set loading state on a button
 * @param {HTMLElement} button - Button element
 * @param {boolean} loading - Loading state
 */
function setButtonLoading(button, loading) {
    if (loading) {
        button.classList.add('loading');
        button.disabled = true;
    } else {
        button.classList.remove('loading');
        button.disabled = false;
    }
}

/**
 * Check password strength
 * @param {string} password - Password to check
 * @returns {object} Strength info: { strength, text }
 */
function checkPasswordStrength(password) {
    let strength = 0;
    
    if (password.length >= 6) strength++;
    if (password.length >= 8) strength++;
    if (/[A-Z]/.test(password)) strength++;
    if (/[0-9]/.test(password)) strength++;
    if (/[^A-Za-z0-9]/.test(password)) strength++;
    
    if (strength <= 2) {
        return { strength: 'weak', text: 'Weak password' };
    } else if (strength <= 3) {
        return { strength: 'medium', text: 'Medium strength' };
    } else {
        return { strength: 'strong', text: 'Strong password' };
    }
}

/**
 * Update password strength indicator
 * @param {string} password - Password value
 */
function updatePasswordStrength(password) {
    if (!elements.passwordStrengthFill || !elements.passwordStrengthText) return;
    
    if (password.length === 0) {
        elements.passwordStrengthFill.className = 'strength-fill';
        elements.passwordStrengthText.className = 'strength-text';
        elements.passwordStrengthText.textContent = 'Password strength';
        return;
    }
    
    const { strength, text } = checkPasswordStrength(password);
    elements.passwordStrengthFill.className = `strength-fill ${strength}`;
    elements.passwordStrengthText.className = `strength-text ${strength}`;
    elements.passwordStrengthText.textContent = text;
}

/**
 * Switch between auth forms
 * @param {string} formName - Form to show: 'login', 'signup', or 'forgot'
 */
function switchForm(formName) {
    // Hide all forms
    elements.loginForm.classList.remove('active');
    elements.signupForm.classList.remove('active');
    elements.forgotPasswordForm.classList.remove('active');
    
    // Update tabs
    elements.authTabs.forEach(tab => tab.classList.remove('active'));
    
    // Show selected form
    switch (formName) {
        case 'login':
            elements.loginForm.classList.add('active');
            document.querySelector('[data-tab="login"]').classList.add('active');
            break;
        case 'signup':
            elements.signupForm.classList.add('active');
            document.querySelector('[data-tab="signup"]').classList.add('active');
            break;
        case 'forgot':
            elements.forgotPasswordForm.classList.add('active');
            break;
    }
    
    // Hide any messages
    elements.authMessage.classList.remove('show');
}

// ========================================
// Firebase Auth Functions
// ========================================

/**
 * Create a new user document in Firestore
 * @param {object} user - Firebase user object
 * @param {string} displayName - User's display name
 */
async function createUserDocument(user, displayName = '') {
    try {
        const userRef = doc(db, 'users', user.uid);
        
        await setDoc(userRef, {
            uid: user.uid,
            email: user.email,
            displayName: displayName || user.email.split('@')[0],
            createdAt: serverTimestamp(),
            lastLogin: serverTimestamp(),
            settings: {
                theme: 'dark',
                notifications: true
            }
        });
        
        console.log("✅ User document created in Firestore");
    } catch (error) {
        console.error("Error creating user document:", error);
        throw error;
    }
}

/**
 * Update user's last login timestamp
 * @param {string} uid - User ID
 */
async function updateLastLogin(uid) {
    try {
        const userRef = doc(db, 'users', uid);
        await setDoc(userRef, { lastLogin: serverTimestamp() }, { merge: true });
    } catch (error) {
        console.error("Error updating last login:", error);
    }
}

/**
 * Handle user signup
 * @param {Event} e - Form submit event
 */
async function handleSignup(e) {
    e.preventDefault();
    
    const name = elements.signupName.value.trim();
    const email = elements.signupEmail.value.trim();
    const password = elements.signupPassword.value;
    const confirmPassword = elements.signupConfirmPassword.value;
    
    // Validation
    if (!name) {
        showMessage('Please enter your name.', 'error');
        return;
    }
    
    if (password !== confirmPassword) {
        showMessage('Passwords do not match.', 'error');
        return;
    }
    
    if (password.length < 6) {
        showMessage('Password must be at least 6 characters.', 'error');
        return;
    }
    
    const submitBtn = elements.signupForm.querySelector('.auth-btn');
    setButtonLoading(submitBtn, true);
    
    try {
        // Create user with Firebase Auth
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;
        
        // Update display name
        await updateProfile(user, { displayName: name });
        
        // Create user document in Firestore
        await createUserDocument(user, name);
        
        showMessage('Account created successfully! Redirecting...', 'success');
        
        // Redirect to main page after short delay
        setTimeout(() => {
            window.location.href = 'index.html';
        }, 1500);
        
    } catch (error) {
        console.error("Signup error:", error);
        showMessage(getErrorMessage(error.code), 'error');
        setButtonLoading(submitBtn, false);
    }
}

/**
 * Handle user login
 * @param {Event} e - Form submit event
 */
async function handleLogin(e) {
    e.preventDefault();
    
    const email = elements.loginEmail.value.trim();
    const password = elements.loginPassword.value;
    
    if (!email || !password) {
        showMessage('Please enter both email and password.', 'error');
        return;
    }
    
    const submitBtn = elements.loginForm.querySelector('.auth-btn');
    setButtonLoading(submitBtn, true);
    
    try {
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;
        
        // Update last login
        await updateLastLogin(user.uid);
        
        showMessage('Login successful! Redirecting...', 'success');
        
        // Redirect to main page
        setTimeout(() => {
            window.location.href = 'index.html';
        }, 1000);
        
    } catch (error) {
        console.error("Login error:", error);
        showMessage(getErrorMessage(error.code), 'error');
        setButtonLoading(submitBtn, false);
    }
}

/**
 * Handle password reset
 * @param {Event} e - Form submit event
 */
async function handlePasswordReset(e) {
    e.preventDefault();
    
    const email = elements.resetEmail.value.trim();
    
    if (!email) {
        showMessage('Please enter your email address.', 'error');
        return;
    }
    
    const submitBtn = elements.forgotPasswordForm.querySelector('.auth-btn');
    setButtonLoading(submitBtn, true);
    
    try {
        await sendPasswordResetEmail(auth, email);
        showMessage('Password reset email sent! Check your inbox.', 'success');
        
        // Switch back to login after delay
        setTimeout(() => {
            switchForm('login');
        }, 3000);
        
    } catch (error) {
        console.error("Password reset error:", error);
        showMessage(getErrorMessage(error.code), 'error');
    } finally {
        setButtonLoading(submitBtn, false);
    }
}

/**
 * Handle user logout
 */
async function handleLogout() {
    try {
        await signOut(auth);
        window.location.href = 'login.html';
    } catch (error) {
        console.error("Logout error:", error);
    }
}

// ========================================
// Auth State Observer
// ========================================

/**
 * Check if user is already logged in
 * Redirect to main page if authenticated
 */
onAuthStateChanged(auth, (user) => {
    if (user) {
        // User is signed in, redirect to main page if on login page
        if (window.location.pathname.includes('login.html')) {
            console.log("User already logged in, redirecting...");
            window.location.href = 'index.html';
        }
    }
});

// ========================================
// Event Listeners
// ========================================

function initEventListeners() {
    // Tab switching
    elements.authTabs.forEach(tab => {
        tab.addEventListener('click', () => {
            switchForm(tab.dataset.tab);
        });
    });
    
    // Form submissions
    if (elements.loginForm) {
        elements.loginForm.addEventListener('submit', handleLogin);
    }
    
    if (elements.signupForm) {
        elements.signupForm.addEventListener('submit', handleSignup);
    }
    
    if (elements.forgotPasswordForm) {
        elements.forgotPasswordForm.addEventListener('submit', handlePasswordReset);
    }
    
    // Forgot password link
    if (elements.forgotPasswordLink) {
        elements.forgotPasswordLink.addEventListener('click', (e) => {
            e.preventDefault();
            switchForm('forgot');
        });
    }
    
    // Back to login
    if (elements.backToLoginBtn) {
        elements.backToLoginBtn.addEventListener('click', () => {
            switchForm('login');
        });
    }
    
    // Password visibility toggles
    elements.passwordToggles.forEach(toggle => {
        toggle.addEventListener('click', () => {
            const targetId = toggle.dataset.target;
            const input = document.getElementById(targetId);
            
            if (input.type === 'password') {
                input.type = 'text';
                toggle.textContent = '🙈';
            } else {
                input.type = 'password';
                toggle.textContent = '👁️';
            }
        });
    });
    
    // Password strength checker
    if (elements.signupPassword) {
        elements.signupPassword.addEventListener('input', (e) => {
            updatePasswordStrength(e.target.value);
        });
    }
}

// ========================================
// Initialize
// ========================================

document.addEventListener('DOMContentLoaded', () => {
    initEventListeners();
    console.log("🔐 Auth module initialized");
});

// Export for use in other modules
export { auth, db, handleLogout, onAuthStateChanged };
