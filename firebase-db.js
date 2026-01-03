/**
 * Firebase Database Service
 * 
 * PURPOSE:
 * ========
 * This module handles all Firestore database operations with USER-SCOPED data.
 * 
 * WHY THIS FIX IS NEEDED:
 * =======================
 * PROBLEM: The previous implementation used localStorage which is browser-local
 * but NOT user-scoped. When multiple users log in on the same browser, they all
 * see the same data because localStorage doesn't know about user identity.
 * 
 * SOLUTION: Use Firebase Firestore with user-specific paths:
 *   - users/{uid}/habits/{habitId}     - Individual habit documents
 *   - users/{uid}/history/{date}       - Daily completion history
 *   - users/{uid}/stats                - User statistics (streak, etc.)
 * 
 * Each user's data is completely isolated. The {uid} is the unique identifier
 * from Firebase Authentication (auth.currentUser.uid).
 * 
 * SECURITY:
 * =========
 * Firestore Security Rules should be set to:
 *   rules_version = '2';
 *   service cloud.firestore {
 *     match /databases/{database}/documents {
 *       match /users/{userId}/{document=**} {
 *         allow read, write: if request.auth != null && request.auth.uid == userId;
 *       }
 *     }
 *   }
 * 
 * This ensures users can ONLY access their own data.
 */

// ========================================
// Wait for Firebase to be initialized
// ========================================

/**
 * Get the current user's UID
 * @returns {string|null} User ID or null if not logged in
 */
function getCurrentUserId() {
    const auth = window.firebaseAuth;
    if (!auth) {
        console.error('❌ Firebase Auth not initialized');
        return null;
    }
    if (!auth.currentUser) {
        console.warn('⚠️ No authenticated user - auth.currentUser is null');
        return null;
    }
    if (!auth.currentUser.uid) {
        console.error('❌ User exists but has no UID');
        return null;
    }
    return auth.currentUser.uid;
}

/**
 * Validate that a user is authenticated before any operation
 * @throws {Error} If no user is authenticated
 */
function requireAuth() {
    const userId = getCurrentUserId();
    if (!userId) {
        throw new Error('Authentication required. Please log in again.');
    }
    return userId;
}

/**
 * Get Firestore database reference
 * @returns {object|null} Firestore instance or null
 */
function getDb() {
    return window.firebaseDb || null;
}

// ========================================
// Firestore Path Helpers
// ========================================

/**
 * Get the user's habits collection path
 * Path: users/{uid}/habits
 */
function getHabitsPath(userId) {
    return `users/${userId}/habits`;
}

/**
 * Get the user's history collection path
 * Path: users/{uid}/history
 */
function getHistoryPath(userId) {
    return `users/${userId}/history`;
}

/**
 * Get the user's stats document path
 * Path: users/${uid}/stats/current
 */
function getStatsPath(userId) {
    return `users/${userId}/stats/current`;
}

// ========================================
// Habit CRUD Operations
// ========================================

/**
 * Load all habits for the current user from Firestore
 * Only loads habits from the user's own collection path
 * 
 * @returns {Promise<Array>} Array of habit objects
 */
async function loadHabitsFromFirestore() {
    const auth = window.firebaseAuth;
    const db = getDb();
    
    // Check user is logged in before making any Firestore calls
    if (!auth || !auth.currentUser || !auth.currentUser.uid) {
        console.error('❌ Cannot load habits: No authenticated user');
        return [];
    }
    
    if (!db) {
        console.error('❌ Cannot load habits: Firestore not initialized');
        return [];
    }
    
    const userId = auth.currentUser.uid;
    
    try {
        const { collection, getDocs } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js');
        
        // Use subcollection path: users/{userId}/habits - naturally filtered by user
        const habitsRef = collection(db, 'users', userId, 'habits');
        const snapshot = await getDocs(habitsRef);
        
        const habits = [];
        snapshot.forEach(doc => {
            const data = doc.data();
            // Double-check: only include habits that belong to this user
            // (the path already ensures this, but this is an extra safety check)
            if (!data.userId || data.userId === userId) {
                habits.push({ id: doc.id, ...data });
            } else {
                console.warn(`⚠️ Skipping habit ${doc.id} - userId mismatch`);
            }
        });
        
        console.log(`✅ Loaded ${habits.length} habits for user ${userId}`);
        return habits;
    } catch (error) {
        console.error('❌ Error loading habits:', error);
        return [];
    }
}

/**
 * Save a single habit to Firestore
 * Saves to user-scoped path and includes userId in document
 * 
 * @param {object} habit - Habit object to save
 * @returns {Promise<string>} The habit ID
 */
async function saveHabitToFirestore(habit) {
    const auth = window.firebaseAuth;
    const db = getDb();
    
    // Check user is logged in before making any Firestore calls
    if (!auth || !auth.currentUser || !auth.currentUser.uid) {
        throw new Error('Authentication required. Please log in again.');
    }
    
    if (!db) {
        throw new Error('Firestore not initialized');
    }
    
    // Validate habit has an ID
    if (!habit.id) {
        throw new Error('Habit must have an ID');
    }
    
    const userId = auth.currentUser.uid;
    
    try {
        const { doc, setDoc } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js');
        
        // Use subcollection path: doc(db, 'users', uid, 'habits', habitId)
        const habitRef = doc(db, 'users', userId, 'habits', habit.id);
        await setDoc(habitRef, {
            ...habit,
            userId: userId, // Store userId in document for extra safety
            updatedAt: new Date().toISOString()
        });
        
        console.log(`✅ Saved habit ${habit.id} for user ${userId}`);
        return habit.id;
    } catch (error) {
        console.error('❌ Error saving habit:', error);
        console.error('   User ID:', userId);
        console.error('   Habit ID:', habit.id);
        throw error;
    }
}

/**
 * Save multiple habits to Firestore (batch operation)
 * 
 * @param {Array} habits - Array of habit objects
 * @returns {Promise<void>}
 */
async function saveAllHabitsToFirestore(habits) {
    const auth = window.firebaseAuth;
    const db = getDb();
    
    // Check user is logged in before making any Firestore calls
    if (!auth || !auth.currentUser || !auth.currentUser.uid) {
        throw new Error('Authentication required. Please log in again.');
    }
    
    if (!db) {
        throw new Error('Firestore not initialized');
    }
    
    const userId = auth.currentUser.uid;
    
    try {
        const { doc, writeBatch } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js');
        
        const batch = writeBatch(db);
        const timestamp = new Date().toISOString();
        
        habits.forEach(habit => {
            if (!habit.id) {
                console.warn('⚠️ Skipping habit without ID');
                return;
            }
            // Use subcollection path: doc(db, 'users', uid, 'habits', habitId)
            const habitRef = doc(db, 'users', userId, 'habits', habit.id);
            batch.set(habitRef, { 
                ...habit, 
                userId: userId, // Store userId in document
                updatedAt: timestamp 
            });
        });
        
        await batch.commit();
        console.log(`✅ Batch saved ${habits.length} habits for user ${userId}`);
    } catch (error) {
        console.error('❌ Error batch saving habits:', error);
        throw error;
    }
}

/**
 * Update a habit in Firestore
 * 
 * @param {string} habitId - Habit ID to update
 * @param {object} updates - Fields to update
 * @returns {Promise<void>}
 */
async function updateHabitInFirestore(habitId, updates) {
    const auth = window.firebaseAuth;
    const db = getDb();
    
    // Check user is logged in before making any Firestore calls
    if (!auth || !auth.currentUser || !auth.currentUser.uid) {
        throw new Error('Authentication required. Please log in again.');
    }
    
    if (!db) {
        throw new Error('Firestore not initialized');
    }
    
    const userId = auth.currentUser.uid;
    
    try {
        const { doc, updateDoc } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js');
        
        // Use subcollection path: doc(db, 'users', uid, 'habits', habitId)
        const habitRef = doc(db, 'users', userId, 'habits', habitId);
        await updateDoc(habitRef, {
            ...updates,
            userId: userId, // Ensure userId stays in document
            updatedAt: new Date().toISOString()
        });
        
        console.log(`✅ Updated habit ${habitId} for user ${userId}`);
    } catch (error) {
        console.error('❌ Error updating habit:', error);
        throw error;
    }
}

/**
 * Delete a habit from Firestore
 * 
 * @param {string} habitId - Habit ID to delete
 * @returns {Promise<void>}
 */
async function deleteHabitFromFirestore(habitId) {
    const auth = window.firebaseAuth;
    const db = getDb();
    
    // Check user is logged in before making any Firestore calls
    if (!auth || !auth.currentUser || !auth.currentUser.uid) {
        throw new Error('Authentication required. Please log in again.');
    }
    
    if (!db) {
        throw new Error('Firestore not initialized');
    }
    
    const userId = auth.currentUser.uid;
    
    try {
        const { doc, deleteDoc } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js');
        
        // Use subcollection path: doc(db, 'users', uid, 'habits', habitId)
        const habitRef = doc(db, 'users', userId, 'habits', habitId);
        await deleteDoc(habitRef);
        
        console.log(`✅ Deleted habit ${habitId} for user ${userId}`);
    } catch (error) {
        console.error('❌ Error deleting habit:', error);
        throw error;
    }
}

// ========================================
// History Operations
// ========================================

/**
 * Load completion history for the current user
 * 
 * @returns {Promise<object>} History object keyed by date
 */
async function loadHistoryFromFirestore() {
    const auth = window.firebaseAuth;
    const db = getDb();
    
    // Check user is logged in before making any Firestore calls
    if (!auth || !auth.currentUser || !auth.currentUser.uid) {
        console.error('❌ Cannot load history: No authenticated user');
        return {};
    }
    
    if (!db) {
        console.error('❌ Cannot load history: Firestore not initialized');
        return {};
    }
    
    const userId = auth.currentUser.uid;
    
    try {
        const { collection, getDocs } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js');
        
        // Use subcollection path: collection(db, 'users', uid, 'history')
        const historyRef = collection(db, 'users', userId, 'history');
        const snapshot = await getDocs(historyRef);
        
        const history = {};
        snapshot.forEach(doc => {
            const data = doc.data();
            // Double-check userId if present
            if (!data.userId || data.userId === userId) {
                history[doc.id] = data.habits || [];
            }
        });
        
        console.log(`✅ Loaded history for ${Object.keys(history).length} days for user ${userId}`);
        return history;
    } catch (error) {
        console.error('❌ Error loading history:', error);
        return {};
    }
}

/**
 * Save daily history to Firestore
 * 
 * @param {string} date - Date string (YYYY-MM-DD)
 * @param {Array} habitRecords - Array of habit completion records
 * @returns {Promise<void>}
 */
async function saveHistoryToFirestore(date, habitRecords) {
    const auth = window.firebaseAuth;
    const db = getDb();
    
    // Check user is logged in before making any Firestore calls
    if (!auth || !auth.currentUser || !auth.currentUser.uid) {
        throw new Error('Authentication required. Please log in again.');
    }
    
    if (!db) {
        throw new Error('Firestore not initialized');
    }
    
    const userId = auth.currentUser.uid;
    
    try {
        const { doc, setDoc } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js');
        
        // Use subcollection path: doc(db, 'users', uid, 'history', date)
        const historyRef = doc(db, 'users', userId, 'history', date);
        await setDoc(historyRef, {
            date: date,
            habits: habitRecords,
            userId: userId, // Store userId in document
            updatedAt: new Date().toISOString()
        });
        
        console.log(`✅ Saved history for ${date} for user ${userId}`);
    } catch (error) {
        console.error('❌ Error saving history:', error);
        throw error;
    }
}

// ========================================
// Stats Operations
// ========================================

/**
 * Load user stats (streak, best streak, etc.)
 * 
 * @returns {Promise<object>} Stats object
 */
async function loadStatsFromFirestore() {
    const auth = window.firebaseAuth;
    const db = getDb();
    
    // Check user is logged in before making any Firestore calls
    if (!auth || !auth.currentUser || !auth.currentUser.uid) {
        console.error('❌ Cannot load stats: No authenticated user');
        return { streak: 0, bestStreak: 0, lastDate: null, totalHabits: 0, totalCompletions: 0 };
    }
    
    if (!db) {
        console.error('❌ Cannot load stats: Firestore not initialized');
        return { streak: 0, bestStreak: 0, lastDate: null, totalHabits: 0, totalCompletions: 0 };
    }
    
    const userId = auth.currentUser.uid;
    
    // Default stats object
    const defaultStats = {
        userId: userId,
        streak: 0,
        bestStreak: 0,
        lastDate: null,
        totalHabits: 0,
        totalCompletions: 0
    };
    
    try {
        const { doc, getDoc, setDoc } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js');
        
        // Use subcollection path: doc(db, 'users', uid, 'stats', 'current')
        const statsRef = doc(db, 'users', userId, 'stats', 'current');
        const snapshot = await getDoc(statsRef);
        
        // Check if stats document exists
        if (snapshot.exists()) {
            const data = snapshot.data();
            // Double-check userId if present
            if (!data.userId || data.userId === userId) {
                console.log(`✅ Loaded user stats for user ${userId}`);
                return data;
            }
        }
        
        // Stats document doesn't exist - create it with default values
        console.log(`📝 Creating default stats document for user ${userId}`);
        await setDoc(statsRef, {
            ...defaultStats,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        });
        console.log(`✅ Default stats document created for user ${userId}`);
        
        return defaultStats;
    } catch (error) {
        console.error('❌ Error loading stats:', error);
        return defaultStats;
    }
}

/**
 * Save user stats to Firestore
 * 
 * @param {object} stats - Stats object with streak, bestStreak, lastDate
 * @returns {Promise<void>}
 */
async function saveStatsToFirestore(stats) {
    const auth = window.firebaseAuth;
    const db = getDb();
    
    // Check user is logged in before making any Firestore calls
    if (!auth || !auth.currentUser || !auth.currentUser.uid) {
        throw new Error('Authentication required. Please log in again.');
    }
    
    if (!db) {
        throw new Error('Firestore not initialized');
    }
    
    const userId = auth.currentUser.uid;
    
    try {
        const { doc, setDoc } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js');
        
        // Use subcollection path: doc(db, 'users', uid, 'stats', 'current')
        const statsRef = doc(db, 'users', userId, 'stats', 'current');
        await setDoc(statsRef, {
            ...stats,
            userId: userId, // Store userId in document
            updatedAt: new Date().toISOString()
        });
        
        console.log(`✅ Saved user stats for user ${userId}`);
    } catch (error) {
        console.error('❌ Error saving stats:', error);
        throw error;
    }
}

// ========================================
// Migration: localStorage to Firestore
// ========================================

/**
 * Migrate existing localStorage data to Firestore for the current user
 * 
 * IMPORTANT: This function has been disabled to prevent cross-user data contamination.
 * The old localStorage keys (habitTracker_habits, etc.) were NOT user-scoped, which means
 * all users on the same browser shared the same data. When a new user signs in, this
 * migration would incorrectly copy the previous user's data to the new user's Firestore.
 * 
 * @returns {Promise<boolean>} Always returns false (migration disabled)
 */
async function migrateLocalStorageToFirestore() {
    const userId = getCurrentUserId();
    if (!userId) return false;
    
    // Check if already migrated for this user
    const migrationKey = `habitTracker_migrated_firestore_${userId}`;
    if (localStorage.getItem(migrationKey)) {
        console.log('📦 Already migrated to Firestore');
        return false;
    }
    
    // CRITICAL FIX: Clear any non-user-scoped localStorage data to prevent
    // cross-user contamination. The old localStorage keys were shared between
    // all users on the same browser, which caused data leaks.
    const oldKeys = [
        'habitTracker_habits',
        'habitTracker_history', 
        'habitTracker_streak',
        'habitTracker_bestStreak',
        'habitTracker_lastDate'
    ];
    
    let hadOldData = false;
    oldKeys.forEach(key => {
        if (localStorage.getItem(key)) {
            hadOldData = true;
            localStorage.removeItem(key);
            console.log(`🗑️ Cleared shared localStorage key: ${key}`);
        }
    });
    
    if (hadOldData) {
        console.warn('⚠️ Cleared non-user-scoped localStorage data to prevent cross-user contamination.');
        console.warn('   Each user now has their own isolated data in Firestore.');
    }
    
    // Mark as "migrated" (really just "cleaned up") for this user
    localStorage.setItem(migrationKey, 'true');
    console.log('✅ User data isolation check complete');
    
    return false;
}

/**
 * Clear all Firestore data for the current user
 * Use this if a user's data was contaminated by the cross-user bug
 * 
 * @returns {Promise<boolean>} True if cleared successfully
 */
async function clearUserFirestoreData() {
    const auth = window.firebaseAuth;
    const db = getDb();
    
    if (!auth || !auth.currentUser || !auth.currentUser.uid) {
        console.error('❌ Cannot clear data: No authenticated user');
        return false;
    }
    
    if (!db) {
        console.error('❌ Cannot clear data: Firestore not initialized');
        return false;
    }
    
    const userId = auth.currentUser.uid;
    
    try {
        const { collection, getDocs, doc, deleteDoc, writeBatch } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js');
        
        console.log(`🗑️ Clearing all data for user ${userId}...`);
        
        // Delete all habits
        const habitsRef = collection(db, 'users', userId, 'habits');
        const habitsSnapshot = await getDocs(habitsRef);
        const batch1 = writeBatch(db);
        habitsSnapshot.forEach(docSnap => {
            batch1.delete(doc(db, 'users', userId, 'habits', docSnap.id));
        });
        await batch1.commit();
        console.log(`✅ Deleted ${habitsSnapshot.size} habits`);
        
        // Delete all history
        const historyRef = collection(db, 'users', userId, 'history');
        const historySnapshot = await getDocs(historyRef);
        const batch2 = writeBatch(db);
        historySnapshot.forEach(docSnap => {
            batch2.delete(doc(db, 'users', userId, 'history', docSnap.id));
        });
        await batch2.commit();
        console.log(`✅ Deleted ${historySnapshot.size} history entries`);
        
        // Delete stats
        const statsRef = doc(db, 'users', userId, 'stats', 'current');
        await deleteDoc(statsRef);
        console.log('✅ Deleted stats');
        
        // Clear migration flag so it runs cleanup again
        const migrationKey = `habitTracker_migrated_firestore_${userId}`;
        localStorage.removeItem(migrationKey);
        
        console.log('✅ All user data cleared successfully');
        return true;
    } catch (error) {
        console.error('❌ Error clearing user data:', error);
        return false;
    }
}

// ========================================
// Export Functions Globally
// ========================================

window.FirebaseDB = {
    // User
    getCurrentUserId,
    
    // Habits
    loadHabitsFromFirestore,
    saveHabitToFirestore,
    saveAllHabitsToFirestore,
    updateHabitInFirestore,
    deleteHabitFromFirestore,
    
    // History
    loadHistoryFromFirestore,
    saveHistoryToFirestore,
    
    // Stats
    loadStatsFromFirestore,
    saveStatsToFirestore,
    
    // Migration/Cleanup
    migrateLocalStorageToFirestore,
    clearUserFirestoreData
};

console.log('🔥 Firebase DB service loaded');
