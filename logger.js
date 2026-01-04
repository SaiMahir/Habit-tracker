/**
 * Production-Ready Logging Utility
 * 
 * Features:
 * - Environment-based logging (development vs production)
 * - Automatic sensitive data masking
 * - Centralized log levels (debug, info, warn, error)
 * - No sensitive data exposure in any environment
 * 
 * SECURITY:
 * - Never logs full user IDs, emails, or credentials
 * - Masks UIDs to first 4 + last 4 characters
 * - Masks emails to show only domain
 * - Removes all sensitive data from error objects
 */

// ========================================
// Environment Detection
// ========================================

/**
 * Detect if running in development or production
 * Production is detected by:
 * - Running on HTTPS (except localhost)
 * - Running on a known production domain
 * - Explicit production flag
 */
const Logger = (function() {
    
    // Detect environment
    const isLocalhost = window.location.hostname === 'localhost' || 
                        window.location.hostname === '127.0.0.1' ||
                        window.location.hostname.startsWith('192.168.');
    
    const isHTTPS = window.location.protocol === 'https:';
    
    // Production if HTTPS and not localhost, or if explicit flag is set
    const isProduction = (isHTTPS && !isLocalhost) || 
                         window.HABIT_TRACKER_PRODUCTION === true;
    
    // Log levels
    const LOG_LEVELS = {
        DEBUG: 0,
        INFO: 1,
        WARN: 2,
        ERROR: 3,
        NONE: 4
    };
    
    // Current log level based on environment
    // Production: Only errors
    // Development: All logs
    let currentLevel = isProduction ? LOG_LEVELS.ERROR : LOG_LEVELS.DEBUG;
    
    // ========================================
    // Sensitive Data Masking
    // ========================================
    
    /**
     * Mask a user ID (UID)
     * Shows first 4 + last 4 characters: "abc1...xyz9"
     * @param {string} uid - Full user ID
     * @returns {string} Masked UID
     */
    function maskUID(uid) {
        if (!uid || typeof uid !== 'string') return '[no-uid]';
        if (uid.length <= 8) return '****';
        return `${uid.substring(0, 4)}...${uid.substring(uid.length - 4)}`;
    }
    
    /**
     * Mask an email address
     * Shows only domain: "***@domain.com"
     * @param {string} email - Full email
     * @returns {string} Masked email
     */
    function maskEmail(email) {
        if (!email || typeof email !== 'string') return '[no-email]';
        const atIndex = email.indexOf('@');
        if (atIndex === -1) return '***';
        return `***@${email.substring(atIndex + 1)}`;
    }
    
    /**
     * Sanitize an error object for logging
     * Removes sensitive fields and returns safe error info
     * @param {Error} error - Error object
     * @returns {object} Sanitized error info
     */
    function sanitizeError(error) {
        if (!error) return { message: 'Unknown error' };
        
        // Only include safe fields
        return {
            code: error.code || 'unknown',
            message: sanitizeMessage(error.message || 'Unknown error'),
            name: error.name || 'Error'
        };
    }
    
    /**
     * Sanitize a message string
     * Removes potential sensitive data patterns
     * @param {string} message - Original message
     * @returns {string} Sanitized message
     */
    function sanitizeMessage(message) {
        if (!message || typeof message !== 'string') return '';
        
        // Remove potential email patterns
        message = message.replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, '[email]');
        
        // Remove potential UID patterns (long alphanumeric strings)
        message = message.replace(/\b[a-zA-Z0-9]{20,}\b/g, '[id]');
        
        // Remove potential JWT tokens
        message = message.replace(/eyJ[a-zA-Z0-9_-]*\.eyJ[a-zA-Z0-9_-]*\.[a-zA-Z0-9_-]*/g, '[token]');
        
        return message;
    }
    
    // ========================================
    // Logging Functions
    // ========================================
    
    /**
     * Debug level logging - Development only
     * @param {string} message - Log message
     * @param {...any} args - Additional arguments (will be sanitized)
     */
    function debug(message, ...args) {
        if (currentLevel > LOG_LEVELS.DEBUG) return;
        console.log(`[DEBUG] ${message}`, ...args.map(sanitizeArg));
    }
    
    /**
     * Info level logging - Development only
     * @param {string} message - Log message
     * @param {...any} args - Additional arguments (will be sanitized)
     */
    function info(message, ...args) {
        if (currentLevel > LOG_LEVELS.INFO) return;
        console.log(`[INFO] ${message}`, ...args.map(sanitizeArg));
    }
    
    /**
     * Warning level logging - Development only
     * @param {string} message - Log message
     * @param {...any} args - Additional arguments (will be sanitized)
     */
    function warn(message, ...args) {
        if (currentLevel > LOG_LEVELS.WARN) return;
        console.warn(`[WARN] ${message}`, ...args.map(sanitizeArg));
    }
    
    /**
     * Error level logging - Always enabled
     * Never exposes sensitive details
     * @param {string} message - Log message
     * @param {Error} [error] - Optional error object
     */
    function error(message, err = null) {
        if (currentLevel > LOG_LEVELS.ERROR) return;
        
        if (err) {
            const safeError = sanitizeError(err);
            console.error(`[ERROR] ${message}`, safeError);
        } else {
            console.error(`[ERROR] ${message}`);
        }
    }
    
    /**
     * Sanitize any argument for safe logging
     * @param {any} arg - Argument to sanitize
     * @returns {any} Sanitized argument
     */
    function sanitizeArg(arg) {
        if (arg === null || arg === undefined) return arg;
        
        if (typeof arg === 'string') {
            return sanitizeMessage(arg);
        }
        
        if (arg instanceof Error) {
            return sanitizeError(arg);
        }
        
        if (typeof arg === 'object') {
            // Don't log complex objects in production
            if (isProduction) return '[object]';
            
            // In development, shallow sanitize
            try {
                const safe = {};
                for (const key of Object.keys(arg)) {
                    const lowerKey = key.toLowerCase();
                    if (lowerKey.includes('password') || 
                        lowerKey.includes('secret') ||
                        lowerKey.includes('token') ||
                        lowerKey.includes('credential')) {
                        safe[key] = '[redacted]';
                    } else if (lowerKey === 'uid' || lowerKey === 'userid') {
                        safe[key] = maskUID(arg[key]);
                    } else if (lowerKey === 'email') {
                        safe[key] = maskEmail(arg[key]);
                    } else {
                        safe[key] = arg[key];
                    }
                }
                return safe;
            } catch {
                return '[object]';
            }
        }
        
        return arg;
    }
    
    // ========================================
    // Auth-Specific Logging Helpers
    // ========================================
    
    /**
     * Log successful authentication
     * @param {string} uid - User ID (will be masked)
     */
    function authSuccess(uid) {
        info(`User authenticated: ${maskUID(uid)}`);
    }
    
    /**
     * Log authentication failure
     * @param {string} errorCode - Firebase error code
     */
    function authFailure(errorCode) {
        warn(`Authentication failed: ${errorCode || 'unknown'}`);
    }
    
    /**
     * Log user action
     * @param {string} action - Action name
     * @param {string} [uid] - Optional user ID (will be masked)
     */
    function userAction(action, uid = null) {
        if (uid) {
            debug(`User action [${maskUID(uid)}]: ${action}`);
        } else {
            debug(`User action: ${action}`);
        }
    }
    
    /**
     * Log database operation
     * @param {string} operation - Operation name (load, save, delete)
     * @param {string} collection - Collection name
     * @param {number} [count] - Optional item count
     */
    function dbOperation(operation, collection, count = null) {
        if (count !== null) {
            debug(`DB ${operation}: ${collection} (${count} items)`);
        } else {
            debug(`DB ${operation}: ${collection}`);
        }
    }
    
    // ========================================
    // Configuration
    // ========================================
    
    /**
     * Set log level manually
     * @param {string} level - 'debug', 'info', 'warn', 'error', 'none'
     */
    function setLevel(level) {
        const levelMap = {
            'debug': LOG_LEVELS.DEBUG,
            'info': LOG_LEVELS.INFO,
            'warn': LOG_LEVELS.WARN,
            'error': LOG_LEVELS.ERROR,
            'none': LOG_LEVELS.NONE
        };
        currentLevel = levelMap[level.toLowerCase()] ?? LOG_LEVELS.DEBUG;
    }
    
    /**
     * Force production mode (disables all but error logs)
     */
    function enableProductionMode() {
        currentLevel = LOG_LEVELS.ERROR;
    }
    
    /**
     * Force development mode (enables all logs)
     */
    function enableDevelopmentMode() {
        currentLevel = LOG_LEVELS.DEBUG;
    }
    
    /**
     * Check if in production mode
     * @returns {boolean}
     */
    function isProductionMode() {
        return isProduction;
    }
    
    // ========================================
    // Public API
    // ========================================
    
    return {
        // Core logging
        debug,
        info,
        warn,
        error,
        
        // Auth helpers
        authSuccess,
        authFailure,
        userAction,
        
        // DB helpers
        dbOperation,
        
        // Masking utilities (for use in other modules)
        maskUID,
        maskEmail,
        sanitizeError,
        
        // Configuration
        setLevel,
        enableProductionMode,
        enableDevelopmentMode,
        isProductionMode,
        
        // Constants
        LOG_LEVELS
    };
})();

// Export globally
window.Logger = Logger;

// Log initialization (only in development)
Logger.info('Logger initialized', { 
    mode: Logger.isProductionMode() ? 'production' : 'development' 
});
