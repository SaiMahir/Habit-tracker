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
    sendEmailVerification,
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
    apiKey: "AIzaSyBskaqU-j2lbMlPyUuZUBKzxlUzGh5jzTQ",
    authDomain: "habit-tracker-a34d0.firebaseapp.com",
    projectId: "habit-tracker-a34d0",
    storageBucket: "habit-tracker-a34d0.firebasestorage.app",
    messagingSenderId: "550617578412",
    appId: "1:550617578412:web:3b12fd2c3bb968c7fc9809",
    measurementId: "G-9LBX0LDEJD"
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
    authTabsContainer: document.querySelector('.auth-tabs'),
    
    // Message display
    authMessage: document.getElementById('auth-message'),
    
    // Password toggles
    passwordToggles: document.querySelectorAll('.password-toggle'),
    
    // Password strength
    passwordStrengthFill: document.getElementById('password-strength-fill'),
    passwordStrengthText: document.getElementById('password-strength-text'),
    
    // Forgot password link
    forgotPasswordLink: document.getElementById('forgot-password-link'),
    backToLoginBtn: document.getElementById('back-to-login-btn'),
    
    // Verification screen elements
    verificationSentScreen: document.getElementById('verification-sent-screen'),
    verificationEmailDisplay: document.getElementById('verification-email-display'),
    resendEmailBtn: document.getElementById('resend-email-btn'),
    resendTimer: document.getElementById('resend-timer'),
    backToLoginFromVerify: document.getElementById('back-to-login-from-verify'),
    
    // Other elements to hide/show
    authDivider: document.querySelector('.auth-divider'),
    socialLogin: document.querySelector('.social-login')
};

// ========================================
// Error Messages Map
// ========================================
const errorMessages = {
    'auth/email-already-in-use': 'This email is already registered. Try logging in instead.',
    'auth/invalid-email': 'Please enter a valid email address.',
    'auth/operation-not-allowed': 'Email/password sign-in is not enabled. Please contact support.',
    'auth/weak-password': 'Password is too weak. Use at least 6 characters with letters and numbers.',
    'auth/user-disabled': 'This account has been disabled. Please contact support.',
    'auth/user-not-found': 'No account found with this email.',
    'auth/wrong-password': 'Incorrect password. Please try again.',
    'auth/invalid-credential': 'Invalid email or password. Please check and try again.',
    'auth/too-many-requests': 'Too many failed attempts. Please try again later.',
    'auth/network-request-failed': 'Network error. Please check your internet connection.',
    'auth/popup-closed-by-user': 'Sign-in popup was closed before completing.',
    'auth/requires-recent-login': 'Please log in again to complete this action.',
    'auth/invalid-api-key': 'Configuration error. Please contact support.',
    'auth/app-deleted': 'Authentication service unavailable.',
    'auth/expired-action-code': 'This link has expired. Please request a new one.',
    'auth/invalid-action-code': 'This link is invalid. Please request a new one.',
    'auth/missing-email': 'Please enter your email address.',
    'auth/missing-password': 'Please enter your password.',
    'auth/internal-error': 'An internal error occurred. Please try again.',
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

// ========================================
// Verification Screen State
// ========================================
let verificationState = {
    email: '',
    password: '',
    resendCooldown: 0,
    cooldownTimer: null
};

/**
 * Show the verification email sent screen
 * @param {string} email - User's email address
 * @param {string} password - User's password (for resend)
 */
function showVerificationScreen(email, password = '') {
    // Store credentials for resend
    verificationState.email = email;
    verificationState.password = password;
    localStorage.setItem('pendingVerificationEmail', email);
    
    // Update display email
    if (elements.verificationEmailDisplay) {
        elements.verificationEmailDisplay.textContent = email;
    }
    
    // Hide all forms and tabs
    elements.loginForm.classList.remove('active');
    elements.signupForm.classList.remove('active');
    elements.forgotPasswordForm.classList.remove('active');
    elements.authMessage.classList.remove('show');
    
    // Hide tabs, divider, and social login
    if (elements.authTabsContainer) elements.authTabsContainer.style.display = 'none';
    if (elements.authDivider) elements.authDivider.style.display = 'none';
    if (elements.socialLogin) elements.socialLogin.style.display = 'none';
    
    // Show verification screen
    elements.verificationSentScreen.classList.add('show');
    
    // Start resend cooldown (60 seconds)
    startResendCooldown(60);
}

/**
 * Hide the verification screen and return to login
 */
function hideVerificationScreen() {
    // Hide verification screen
    elements.verificationSentScreen.classList.remove('show');
    
    // Show tabs, divider, and social login
    if (elements.authTabsContainer) elements.authTabsContainer.style.display = 'flex';
    if (elements.authDivider) elements.authDivider.style.display = 'flex';
    if (elements.socialLogin) elements.socialLogin.style.display = 'flex';
    
    // Clear cooldown timer
    if (verificationState.cooldownTimer) {
        clearInterval(verificationState.cooldownTimer);
        verificationState.cooldownTimer = null;
    }
    
    // Switch to login form
    switchForm('login');
    
    // Pre-fill email
    if (verificationState.email && elements.loginEmail) {
        elements.loginEmail.value = verificationState.email;
    }
}

/**
 * Start the resend button cooldown timer
 * @param {number} seconds - Cooldown duration in seconds
 */
function startResendCooldown(seconds) {
    verificationState.resendCooldown = seconds;
    
    // Disable resend button
    if (elements.resendEmailBtn) {
        elements.resendEmailBtn.disabled = true;
        updateResendButtonText();
    }
    
    // Clear existing timer
    if (verificationState.cooldownTimer) {
        clearInterval(verificationState.cooldownTimer);
    }
    
    // Start countdown
    verificationState.cooldownTimer = setInterval(() => {
        verificationState.resendCooldown--;
        updateResendButtonText();
        
        if (verificationState.resendCooldown <= 0) {
            clearInterval(verificationState.cooldownTimer);
            verificationState.cooldownTimer = null;
            elements.resendEmailBtn.disabled = false;
        }
    }, 1000);
}

/**
 * Update the resend button text based on cooldown state
 */
function updateResendButtonText() {
    if (!elements.resendEmailBtn || !elements.resendTimer) return;
    
    const btnText = elements.resendEmailBtn.querySelector('.btn-text');
    
    if (verificationState.resendCooldown > 0) {
        elements.resendTimer.textContent = `(${verificationState.resendCooldown}s)`;
        if (btnText) btnText.textContent = 'Resend Email';
    } else {
        elements.resendTimer.textContent = '';
        if (btnText) btnText.textContent = 'Resend Email';
    }
}

/**
 * Handle resend verification email from the new screen
 */
async function handleResendFromScreen() {
    const email = verificationState.email || localStorage.getItem('pendingVerificationEmail');
    const password = verificationState.password;
    
    if (!email) {
        showMessage('Unable to resend. Please sign up again.', 'error');
        return;
    }
    
    // Set loading state
    if (elements.resendEmailBtn) {
        elements.resendEmailBtn.classList.add('loading');
        elements.resendEmailBtn.disabled = true;
    }
    
    try {
        if (!password) {
            showMessage('Session expired. Please sign up again or log in to resend verification.', 'info');
            if (elements.resendEmailBtn) {
                elements.resendEmailBtn.classList.remove('loading');
            }
            return;
        }
        
        // Sign in temporarily to resend verification
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;
        
        if (user.emailVerified) {
            showMessage('Your email is already verified! You can now log in.', 'success');
            await signOut(auth);
            setTimeout(() => hideVerificationScreen(), 1500);
            return;
        }
        
        // Send verification email
        await sendEmailVerification(user);
        await signOut(auth);
        
        showMessage('Verification email sent! Please check your inbox.', 'success');
        
        // Start new cooldown
        startResendCooldown(60);
        
    } catch (error) {
        console.error('❌ Resend verification error:', error.code, error.message);
        showMessage(getErrorMessage(error.code), 'error');
    } finally {
        if (elements.resendEmailBtn) {
            elements.resendEmailBtn.classList.remove('loading');
        }
    }
}

/**
 * Show email verification message with resend button (legacy - kept for compatibility)
 * @param {string} email - User's email address
 */
function showVerificationMessage(email) {
    // Store email for resend functionality
    localStorage.setItem('pendingVerificationEmail', email);
    
    // Create or show verification banner
    let verificationBanner = document.getElementById('verification-banner');
    
    if (!verificationBanner) {
        verificationBanner = document.createElement('div');
        verificationBanner.id = 'verification-banner';
        verificationBanner.className = 'verification-banner';
        verificationBanner.innerHTML = `
            <div class="verification-content">
                <span class="verification-icon">📧</span>
                <div class="verification-text">
                    <strong>Verify your email</strong>
                    <p>A verification link was sent to <strong>${email}</strong></p>
                </div>
            </div>
            <button type="button" class="resend-btn" id="resend-verification-btn">
                <span class="resend-text">Resend Email</span>
                <span class="resend-loader"></span>
            </button>
        `;
        
        // Insert after the auth message
        const authMessage = document.getElementById('auth-message');
        if (authMessage) {
            authMessage.parentNode.insertBefore(verificationBanner, authMessage.nextSibling);
        }
        
        // Add resend click handler
        document.getElementById('resend-verification-btn').addEventListener('click', handleResendVerification);
    } else {
        // Update email in existing banner
        verificationBanner.querySelector('.verification-text p strong').textContent = email;
    }
    
    verificationBanner.classList.add('show');
}

/**
 * Handle resend verification email
 */
async function handleResendVerification() {
    const email = localStorage.getItem('pendingVerificationEmail');
    const password = elements.loginPassword?.value || elements.signupPassword?.value;
    
    if (!email) {
        showMessage('Please enter your email and try again.', 'error');
        return;
    }
    
    const resendBtn = document.getElementById('resend-verification-btn');
    resendBtn.classList.add('loading');
    resendBtn.disabled = true;
    
    try {
        // We need to temporarily sign in to resend verification
        if (!password) {
            showMessage('Please enter your password to resend verification email.', 'info');
            resendBtn.classList.remove('loading');
            resendBtn.disabled = false;
            return;
        }
        
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;
        
        if (user.emailVerified) {
            showMessage('Your email is already verified! You can now log in.', 'success');
            document.getElementById('verification-banner')?.classList.remove('show');
            await signOut(auth);
            return;
        }
        
        await sendEmailVerification(user);
        await signOut(auth);
        
        showMessage('Verification email sent! Please check your inbox.', 'success');
        
        // Disable button for 60 seconds to prevent spam
        resendBtn.innerHTML = '<span class="resend-text">Sent! Wait 60s</span>';
        let countdown = 60;
        const countdownInterval = setInterval(() => {
            countdown--;
            resendBtn.innerHTML = `<span class="resend-text">Wait ${countdown}s</span>`;
            if (countdown <= 0) {
                clearInterval(countdownInterval);
                resendBtn.innerHTML = `
                    <span class="resend-text">Resend Email</span>
                    <span class="resend-loader"></span>
                `;
                resendBtn.disabled = false;
            }
        }, 1000);
        
    } catch (error) {
        console.error('❌ Resend verification error:', error.code, error.message);
        showMessage(getErrorMessage(error.code), 'error');
        resendBtn.disabled = false;
    } finally {
        resendBtn.classList.remove('loading');
    }
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
        
        // Create default stats document at users/{userId}/stats/current
        const statsRef = doc(db, 'users', user.uid, 'stats', 'current');
        await setDoc(statsRef, {
            userId: user.uid,
            streak: 0,
            bestStreak: 0,
            lastDate: null,
            totalHabits: 0,
            totalCompletions: 0,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
        });
        
        console.log("✅ Default stats document created in Firestore");
        
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
    
    if (!email) {
        showMessage('Please enter your email address.', 'error');
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
        console.log('🔄 Creating user account...');
        
        // Create user with Firebase Auth
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;
        
        console.log('✅ User created:', user.uid);
        
        // Update display name
        await updateProfile(user, { displayName: name });
        console.log('✅ Profile updated with name:', name);
        
        // Send email verification
        await sendEmailVerification(user);
        console.log('✅ Verification email sent to:', email);
        
        // Create user document in Firestore
        await createUserDocument(user, name);
        console.log('✅ Firestore document created');
        
        // Sign out the user so they must verify email first
        await signOut(auth);
        
        // Show verification sent screen (new UI)
        showVerificationScreen(email, password);
        
        setButtonLoading(submitBtn, false);
        
    } catch (error) {
        console.error('❌ Signup error:', error);
        console.error('Error code:', error.code);
        console.error('Error message:', error.message);
        console.error('Full error object:', JSON.stringify(error, null, 2));
        
        // Show detailed error for debugging
        const errorMsg = error.code 
            ? getErrorMessage(error.code) 
            : `Error: ${error.message || 'Unknown error occurred'}`;
        showMessage(errorMsg, 'error');
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
        console.log('🔄 Logging in...');
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;
        
        console.log('✅ User authenticated:', user.uid);
        
        // Check if email is verified
        if (!user.emailVerified) {
            console.log('⚠️ Email not verified');
            await signOut(auth);
            showVerificationScreen(email, password);
            showMessage('Please verify your email before logging in.', 'info');
            setButtonLoading(submitBtn, false);
            return;
        }
        
        // Update last login
        await updateLastLogin(user.uid);
        console.log('✅ Last login updated');
        
        showMessage('Login successful! Redirecting...', 'success');
        
        // Redirect to main page
        setTimeout(() => {
            window.location.href = 'index.html';
        }, 1000);
        
    } catch (error) {
        console.error('❌ Login error:', error.code, error.message);
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
 * Redirect to main page if authenticated and verified
 */
onAuthStateChanged(auth, (user) => {
    if (user && user.emailVerified) {
        // User is signed in and verified, redirect to main page if on login page
        if (window.location.pathname.includes('login.html')) {
            console.log("✅ User already logged in and verified, redirecting...");
            window.location.href = 'index.html';
        }
    } else if (user && !user.emailVerified) {
        console.log("⚠️ User exists but email not verified");
        // Don't redirect, let them verify first
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
    
    // Verification screen - Resend email button
    if (elements.resendEmailBtn) {
        elements.resendEmailBtn.addEventListener('click', handleResendFromScreen);
    }
    
    // Verification screen - Back to login button
    if (elements.backToLoginFromVerify) {
        elements.backToLoginFromVerify.addEventListener('click', hideVerificationScreen);
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
