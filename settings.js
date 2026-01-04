/**
 * Settings Module
 * Handles user settings including username and password changes
 * 
 * Features:
 * - Change username (display name)
 * - Change password with re-authentication
 * - Form validation
 * - Error handling with user-friendly messages
 */

// Get Logger instance (must be available globally from logger.js)
function getLogger() {
    return window.Logger || {
        debug: () => {},
        info: () => {},
        warn: () => {},
        error: (msg, err) => console.error(msg, err),
        authSuccess: () => {},
        authFailure: () => {},
        dbOperation: () => {}
    };
}

// ========================================
// Settings Modal Functions
// ========================================

/**
 * Initialize settings module
 * Call this after DOM is loaded and Firebase is initialized
 */
function initSettings() {
    const settingsBtn = document.getElementById('settings-btn');
    const settingsModal = document.getElementById('settings-modal');
    const settingsClose = document.getElementById('settings-close');
    const settingsCancel = document.getElementById('settings-cancel');
    const usernameForm = document.getElementById('username-form');
    const passwordForm = document.getElementById('password-form');
    const settingsTabs = document.querySelectorAll('.settings-tab');
    
    if (!settingsBtn || !settingsModal) {
        getLogger().warn('Settings elements not found in DOM');
        return;
    }
    
    // Open settings modal
    settingsBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        openSettingsModal();
    });
    
    // Close modal handlers
    settingsClose?.addEventListener('click', closeSettingsModal);
    settingsCancel?.addEventListener('click', closeSettingsModal);
    
    // Close on backdrop click
    settingsModal.addEventListener('click', (e) => {
        if (e.target === settingsModal) {
            closeSettingsModal();
        }
    });
    
    // Close on Escape key
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && settingsModal.classList.contains('show')) {
            closeSettingsModal();
        }
    });
    
    // Tab switching
    settingsTabs.forEach(tab => {
        tab.addEventListener('click', () => {
            const targetTab = tab.dataset.tab;
            switchSettingsTab(targetTab);
        });
    });
    
    // Form submissions
    usernameForm?.addEventListener('submit', handleUsernameChange);
    passwordForm?.addEventListener('submit', handlePasswordChange);
    
    // Password visibility toggles
    const passwordToggles = document.querySelectorAll('.settings-password-toggle');
    passwordToggles.forEach(toggle => {
        toggle.addEventListener('click', () => {
            const targetId = toggle.dataset.target;
            const input = document.getElementById(targetId);
            if (input) {
                if (input.type === 'password') {
                    input.type = 'text';
                    toggle.textContent = '🙈';
                } else {
                    input.type = 'password';
                    toggle.textContent = '👁️';
                }
            }
        });
    });
    
    // Real-time password validation
    const newPassword = document.getElementById('new-password');
    const confirmNewPassword = document.getElementById('confirm-new-password');
    
    newPassword?.addEventListener('input', () => {
        updatePasswordStrengthIndicator(newPassword.value);
        validatePasswordMatch();
    });
    
    confirmNewPassword?.addEventListener('input', validatePasswordMatch);
    
    getLogger().info('Settings module initialized');
}

/**
 * Open settings modal
 */
function openSettingsModal() {
    const settingsModal = document.getElementById('settings-modal');
    const userDropdown = document.getElementById('user-dropdown');
    const currentUsernameInput = document.getElementById('new-username');
    
    // Close dropdown
    userDropdown?.classList.remove('show');
    
    // Pre-fill current username
    const auth = window.firebaseAuth;
    if (auth?.currentUser) {
        const currentName = auth.currentUser.displayName || auth.currentUser.email.split('@')[0];
        if (currentUsernameInput) {
            currentUsernameInput.value = currentName;
        }
    }
    
    // Clear password fields
    clearPasswordForm();
    
    // Clear any previous messages
    hideSettingsMessage();
    
    // Show modal
    settingsModal?.classList.add('show');
    document.body.style.overflow = 'hidden';
    
    // Focus first input
    setTimeout(() => {
        currentUsernameInput?.focus();
    }, 100);
}

/**
 * Close settings modal
 */
function closeSettingsModal() {
    const settingsModal = document.getElementById('settings-modal');
    settingsModal?.classList.remove('show');
    document.body.style.overflow = '';
    
    // Reset forms
    clearPasswordForm();
    hideSettingsMessage();
}

/**
 * Switch between settings tabs
 */
function switchSettingsTab(tabName) {
    const tabs = document.querySelectorAll('.settings-tab');
    const contents = document.querySelectorAll('.settings-tab-content');
    
    tabs.forEach(tab => {
        tab.classList.toggle('active', tab.dataset.tab === tabName);
    });
    
    contents.forEach(content => {
        content.classList.toggle('active', content.id === `${tabName}-tab`);
    });
    
    // Clear messages when switching tabs
    hideSettingsMessage();
}

/**
 * Clear password form fields
 */
function clearPasswordForm() {
    const currentPassword = document.getElementById('current-password');
    const newPassword = document.getElementById('new-password');
    const confirmNewPassword = document.getElementById('confirm-new-password');
    const strengthFill = document.getElementById('settings-strength-fill');
    const strengthText = document.getElementById('settings-strength-text');
    const matchIndicator = document.getElementById('password-match-indicator');
    
    if (currentPassword) currentPassword.value = '';
    if (newPassword) newPassword.value = '';
    if (confirmNewPassword) confirmNewPassword.value = '';
    
    // Reset password inputs to hidden state
    [currentPassword, newPassword, confirmNewPassword].forEach(input => {
        if (input) input.type = 'password';
    });
    
    // Reset toggle icons
    document.querySelectorAll('.settings-password-toggle').forEach(toggle => {
        toggle.textContent = '👁️';
    });
    
    // Reset strength indicator
    if (strengthFill) strengthFill.className = 'strength-fill';
    if (strengthText) {
        strengthText.className = 'strength-text';
        strengthText.textContent = 'Password strength';
    }
    
    // Reset match indicator
    if (matchIndicator) {
        matchIndicator.className = 'password-match-indicator';
        matchIndicator.textContent = '';
    }
}

// ========================================
// Message Display
// ========================================

/**
 * Show settings message
 */
function showSettingsMessage(message, type = 'error') {
    const messageEl = document.getElementById('settings-message');
    if (!messageEl) return;
    
    const iconMap = {
        error: '❌',
        success: '✅',
        info: 'ℹ️'
    };
    
    messageEl.className = `settings-message show ${type}`;
    messageEl.innerHTML = `
        <span class="message-icon">${iconMap[type]}</span>
        <span class="message-text">${message}</span>
    `;
    
    // Auto-hide success messages after 3 seconds
    if (type === 'success') {
        setTimeout(() => {
            hideSettingsMessage();
        }, 3000);
    }
}

/**
 * Hide settings message
 */
function hideSettingsMessage() {
    const messageEl = document.getElementById('settings-message');
    if (messageEl) {
        messageEl.classList.remove('show');
    }
}

// ========================================
// Password Validation
// ========================================

/**
 * Check password strength
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
 */
function updatePasswordStrengthIndicator(password) {
    const strengthFill = document.getElementById('settings-strength-fill');
    const strengthText = document.getElementById('settings-strength-text');
    
    if (!strengthFill || !strengthText) return;
    
    if (password.length === 0) {
        strengthFill.className = 'strength-fill';
        strengthText.className = 'strength-text';
        strengthText.textContent = 'Password strength';
        return;
    }
    
    const { strength, text } = checkPasswordStrength(password);
    strengthFill.className = `strength-fill ${strength}`;
    strengthText.className = `strength-text ${strength}`;
    strengthText.textContent = text;
}

/**
 * Validate password match
 */
function validatePasswordMatch() {
    const newPassword = document.getElementById('new-password');
    const confirmNewPassword = document.getElementById('confirm-new-password');
    const matchIndicator = document.getElementById('password-match-indicator');
    
    if (!newPassword || !confirmNewPassword || !matchIndicator) return;
    
    if (confirmNewPassword.value.length === 0) {
        matchIndicator.className = 'password-match-indicator';
        matchIndicator.textContent = '';
        return;
    }
    
    if (newPassword.value === confirmNewPassword.value) {
        matchIndicator.className = 'password-match-indicator match';
        matchIndicator.textContent = '✓ Passwords match';
    } else {
        matchIndicator.className = 'password-match-indicator no-match';
        matchIndicator.textContent = '✗ Passwords do not match';
    }
}

// ========================================
// Form Handlers
// ========================================

/**
 * Handle username change
 */
async function handleUsernameChange(e) {
    e.preventDefault();
    
    const newUsernameInput = document.getElementById('new-username');
    const submitBtn = document.getElementById('save-username-btn');
    const newUsername = newUsernameInput?.value.trim();
    
    if (!newUsername) {
        showSettingsMessage('Please enter a username.', 'error');
        return;
    }
    
    if (newUsername.length < 2) {
        showSettingsMessage('Username must be at least 2 characters.', 'error');
        return;
    }
    
    if (newUsername.length > 50) {
        showSettingsMessage('Username must be less than 50 characters.', 'error');
        return;
    }
    
    // Set loading state
    setButtonLoading(submitBtn, true);
    
    try {
        const auth = window.firebaseAuth;
        const db = window.firebaseDb;
        
        if (!auth?.currentUser) {
            showSettingsMessage('You must be logged in to change your username.', 'error');
            setButtonLoading(submitBtn, false);
            return;
        }
        
        // Import Firebase functions
        const { updateProfile } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js');
        const { doc, setDoc } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js');
        
        // Update Firebase Auth profile
        await updateProfile(auth.currentUser, { displayName: newUsername });
        
        // Update Firestore user document
        const userRef = doc(db, 'users', auth.currentUser.uid);
        await setDoc(userRef, { displayName: newUsername }, { merge: true });
        
        // Update UI elements
        updateUIWithNewUsername(newUsername);
        
        showSettingsMessage('Username updated successfully!', 'success');
        
        getLogger().dbOperation('update', 'username');
        
        // Close modal after success
        setTimeout(() => {
            closeSettingsModal();
        }, 1500);
        
    } catch (error) {
        getLogger().error('Username update error', error);
        showSettingsMessage(getSettingsErrorMessage(error.code || error.message), 'error');
    } finally {
        setButtonLoading(submitBtn, false);
    }
}

/**
 * Handle password change
 */
async function handlePasswordChange(e) {
    e.preventDefault();
    
    const currentPasswordInput = document.getElementById('current-password');
    const newPasswordInput = document.getElementById('new-password');
    const confirmNewPasswordInput = document.getElementById('confirm-new-password');
    const submitBtn = document.getElementById('save-password-btn');
    
    const currentPassword = currentPasswordInput?.value;
    const newPassword = newPasswordInput?.value;
    const confirmNewPassword = confirmNewPasswordInput?.value;
    
    // Validation
    if (!currentPassword) {
        showSettingsMessage('Please enter your current password.', 'error');
        return;
    }
    
    if (!newPassword) {
        showSettingsMessage('Please enter a new password.', 'error');
        return;
    }
    
    if (newPassword.length < 6) {
        showSettingsMessage('New password must be at least 6 characters.', 'error');
        return;
    }
    
    if (newPassword !== confirmNewPassword) {
        showSettingsMessage('New passwords do not match.', 'error');
        return;
    }
    
    if (currentPassword === newPassword) {
        showSettingsMessage('New password must be different from current password.', 'error');
        return;
    }
    
    // Set loading state
    setButtonLoading(submitBtn, true);
    
    try {
        const auth = window.firebaseAuth;
        
        if (!auth?.currentUser) {
            showSettingsMessage('You must be logged in to change your password.', 'error');
            setButtonLoading(submitBtn, false);
            return;
        }
        
        // Import Firebase functions
        const { 
            EmailAuthProvider, 
            reauthenticateWithCredential, 
            updatePassword 
        } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js');
        
        // Re-authenticate user
        const credential = EmailAuthProvider.credential(
            auth.currentUser.email,
            currentPassword
        );
        
        await reauthenticateWithCredential(auth.currentUser, credential);
        getLogger().authSuccess('re-authentication');
        
        // Update password
        await updatePassword(auth.currentUser, newPassword);
        getLogger().authSuccess('password-change');
        
        showSettingsMessage('Password updated successfully!', 'success');
        
        // Clear form
        clearPasswordForm();
        
        // Close modal after success
        setTimeout(() => {
            closeSettingsModal();
        }, 1500);
        
    } catch (error) {
        getLogger().authFailure('password-change', error);
        showSettingsMessage(getSettingsErrorMessage(error.code || error.message), 'error');
    } finally {
        setButtonLoading(submitBtn, false);
    }
}

// ========================================
// Utility Functions
// ========================================

/**
 * Set button loading state
 */
function setButtonLoading(button, loading) {
    if (!button) return;
    
    if (loading) {
        button.classList.add('loading');
        button.disabled = true;
    } else {
        button.classList.remove('loading');
        button.disabled = false;
    }
}

/**
 * Update UI elements with new username
 */
function updateUIWithNewUsername(newUsername) {
    // Update dropdown name
    const dropdownName = document.getElementById('dropdown-name');
    if (dropdownName) {
        dropdownName.textContent = newUsername;
    }
    
    // Update user initial in avatar
    const userInitial = document.getElementById('user-initial');
    if (userInitial) {
        userInitial.textContent = newUsername.charAt(0).toUpperCase();
    }
    
    // Update global user name if exists
    if (window.currentUserName !== undefined) {
        window.currentUserName = newUsername;
    }
    
    // Update header greeting if function exists
    if (typeof window.updateHeaderGreeting === 'function') {
        window.updateHeaderGreeting();
    }
}

/**
 * Get user-friendly error message
 */
function getSettingsErrorMessage(errorCode) {
    const errorMessages = {
        'auth/wrong-password': 'Current password is incorrect.',
        'auth/invalid-credential': 'Current password is incorrect.',
        'auth/weak-password': 'New password is too weak. Use at least 6 characters.',
        'auth/requires-recent-login': 'Please log out and log in again before changing your password.',
        'auth/too-many-requests': 'Too many attempts. Please try again later.',
        'auth/network-request-failed': 'Network error. Please check your internet connection.',
        'auth/user-not-found': 'User not found. Please log in again.',
        'auth/invalid-email': 'Invalid email address.',
        'default': 'An error occurred. Please try again.'
    };
    
    return errorMessages[errorCode] || errorMessages['default'];
}

// ========================================
// Export for global access
// ========================================

window.initSettings = initSettings;
window.openSettingsModal = openSettingsModal;
window.closeSettingsModal = closeSettingsModal;
