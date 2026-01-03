/**
 * Weekly View - Habit Tracker
 * 
 * This page displays habits organized by day of the week.
 * Users can select any day (Mon-Sun) to view habits scheduled for that day.
 * 
 * Key Features:
 * - Day selector tabs for navigating between days
 * - Displays habits filtered by dayOfWeek === selectedDay
 * - Weekly summary showing habit counts per day
 * - Read-only view (editing redirects to home page)
 * 
 * DATA ISOLATION:
 * - Uses Firebase Firestore with user-scoped paths
 * - Data loaded only after authentication
 * - Each user sees only their own habits
 */

// ========================================
// Constants
// ========================================

const STORAGE_KEYS = {
    THEME: 'habitTracker_theme', // Theme stays in localStorage (not sensitive)
    SELECTED_DAY: 'habitTracker_weeklySelectedDay' // UI preference, not sensitive
};

// Day constants - 0 = Sunday, 6 = Saturday
const DAYS_OF_WEEK = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const DAY_NAMES_FULL = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

// ========================================
// State
// ========================================

/**
 * All habits loaded from Firestore (user-scoped)
 * Each habit has: id, groupId, dayOfWeek, name, time, description, completed
 */
let habits = [];

/**
 * Currently selected day index (0-6)
 * Defaults to today
 */
let selectedDay = new Date().getDay();

/**
 * Data loaded flag
 */
let isDataLoaded = false;

/**
 * Currently selected habit for modal actions
 */
let selectedHabitId = null;

// ========================================
// DOM Elements
// ========================================

const elements = {
    dayTabs: document.getElementById('day-tabs'),
    selectedDayTitle: document.getElementById('selected-day-title'),
    habitCount: document.getElementById('habit-count'),
    habitsList: document.getElementById('habits-list'),
    emptyState: document.getElementById('empty-state'),
    weeklySummary: document.getElementById('weekly-summary'),
    themeToggle: document.getElementById('theme-toggle'),
    // Modal elements
    modal: document.getElementById('habit-actions-modal'),
    modalClose: document.getElementById('modal-close'),
    modalHabitName: document.getElementById('modal-habit-name'),
    modalEditBtn: document.getElementById('modal-edit-btn'),
    modalDeleteBtn: document.getElementById('modal-delete-btn'),
    modalDeleteAllBtn: document.getElementById('modal-delete-all-btn')
};

// ========================================
// Utility Functions
// ========================================

/**
 * Get today's day index (0 = Sunday)
 */
function getTodayIndex() {
    return new Date().getDay();
}

/**
 * Format time from 24h to 12h format
 */
function formatTime(time) {
    if (!time) return '';
    const [hours, minutes] = time.split(':');
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour % 12 || 12;
    return `${displayHour}:${minutes} ${ampm}`;
}

/**
 * Escape HTML to prevent XSS
 */
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

/**
 * Get habits for a specific day
 * @param {number} dayIndex - Day of week (0-6)
 * @returns {Array} Habits for that day
 */
function getHabitsForDay(dayIndex) {
    return habits.filter(h => h.dayOfWeek === dayIndex);
}

/**
 * Get which days a habit group covers
 * @param {string} groupId - The group ID
 * @returns {Array<number>} Array of day indices
 */
function getGroupDays(groupId) {
    if (!groupId) return [];
    return habits
        .filter(h => h.groupId === groupId)
        .map(h => h.dayOfWeek)
        .sort((a, b) => a - b);
}

// ========================================
// Data Loading
// ========================================

/**
 * Load habits from Firestore (user-scoped)
 * CRITICAL: Only called after authentication is confirmed
 */
async function loadHabitsFromFirestore() {
    if (!window.FirebaseDB) {
        console.error('❌ FirebaseDB not loaded');
        return;
    }
    
    const userId = window.FirebaseDB.getCurrentUserId();
    if (!userId) {
        console.warn('⚠️ No authenticated user, cannot load habits');
        return;
    }
    
    console.log(`📅 Loading habits for user: ${userId}`);
    
    try {
        habits = await window.FirebaseDB.loadHabitsFromFirestore();
        isDataLoaded = true;
        console.log(`✅ Loaded ${habits.length} total habits`);
    } catch (error) {
        console.error('❌ Error loading habits:', error);
    }
}

/**
 * Load the last selected day from localStorage (UI preference, not sensitive)
 */
function loadSelectedDay() {
    const saved = localStorage.getItem(STORAGE_KEYS.SELECTED_DAY);
    if (saved !== null) {
        selectedDay = parseInt(saved);
    } else {
        // Default to today
        selectedDay = getTodayIndex();
    }
}

/**
 * Save the selected day to localStorage
 */
function saveSelectedDay() {
    localStorage.setItem(STORAGE_KEYS.SELECTED_DAY, selectedDay.toString());
}

// ========================================
// Render Functions
// ========================================

/**
 * Render the day selector tabs
 * Shows all 7 days with the selected day highlighted
 * Today's day gets a special indicator
 */
function renderDayTabs() {
    const todayIndex = getTodayIndex();
    
    elements.dayTabs.innerHTML = DAYS_OF_WEEK.map((day, index) => {
        const isSelected = index === selectedDay;
        const isToday = index === todayIndex;
        const habitCount = getHabitsForDay(index).length;
        
        return `
            <button 
                class="day-tab ${isSelected ? 'selected' : ''} ${isToday ? 'today' : ''}"
                data-day="${index}"
                onclick="selectDay(${index})"
            >
                <span class="day-tab-name">${day}</span>
                ${isToday ? '<span class="today-dot"></span>' : ''}
                <span class="day-tab-count">${habitCount}</span>
            </button>
        `;
    }).join('');
}

/**
 * Render the selected day title and habit count
 */
function renderSelectedDayInfo() {
    const dayHabits = getHabitsForDay(selectedDay);
    const isToday = selectedDay === getTodayIndex();
    
    // Update title with day name and "Today" indicator
    let title = DAY_NAMES_FULL[selectedDay];
    if (isToday) {
        title += ' <span class="today-badge">Today</span>';
    }
    elements.selectedDayTitle.innerHTML = title;
    
    // Update habit count
    const count = dayHabits.length;
    elements.habitCount.textContent = `${count} habit${count !== 1 ? 's' : ''}`;
}

/**
 * Render habits for the selected day
 * Uses the same card style as the home page
 */
function renderHabits() {
    const dayHabits = getHabitsForDay(selectedDay);
    
    // Sort by time
    dayHabits.sort((a, b) => (a.time || '').localeCompare(b.time || ''));
    
    // Show empty state if no habits
    if (dayHabits.length === 0) {
        elements.habitsList.innerHTML = '';
        elements.emptyState.classList.add('show');
        return;
    }
    
    elements.emptyState.classList.remove('show');
    
    // Render habit cards
    elements.habitsList.innerHTML = dayHabits.map(habit => {
        // Check if habit is part of a group (repeats on multiple days)
        const groupDays = habit.groupId ? getGroupDays(habit.groupId) : [habit.dayOfWeek];
        const isGrouped = groupDays.length > 1;
        const otherDays = groupDays.filter(d => d !== selectedDay);
        
        // Build group indicator
        let groupIndicator = '';
        if (isGrouped) {
            const otherDayNames = otherDays.map(d => DAYS_OF_WEEK[d]).join(', ');
            groupIndicator = `
                <span class="habit-group-indicator" title="Also on: ${otherDayNames}">
                    📅 +${otherDays.length} day${otherDays.length > 1 ? 's' : ''}
                </span>
            `;
        }
        
        // Note: In weekly view, we show completion status but don't allow toggling
        // (completion is day-specific and managed on home page)
        const isToday = selectedDay === getTodayIndex();
        const completedClass = isToday && habit.completed ? 'completed' : '';
        
        return `
            <div class="habit-item ${completedClass}" data-id="${habit.id}">
                <div class="habit-day-indicator">
                    <span class="habit-time-badge">⏰ ${formatTime(habit.time)}</span>
                </div>
                <div class="habit-content">
                    <div class="habit-header">
                        <span class="habit-name">${escapeHtml(habit.name)}</span>
                        ${groupIndicator}
                    </div>
                    ${habit.description ? `
                        <p class="habit-description">${escapeHtml(habit.description)}</p>
                    ` : ''}
                </div>
                <div class="habit-actions">
                    <button class="action-btn edit" onclick="openHabitModal('${habit.id}')" title="Edit/Delete">
                        ✏️
                    </button>
                </div>
            </div>
        `;
    }).join('');
}

/**
 * Render the weekly summary grid
 * Shows a mini card for each day with habit count and preview
 */
function renderWeeklySummary() {
    const todayIndex = getTodayIndex();
    
    elements.weeklySummary.innerHTML = DAYS_OF_WEEK.map((day, index) => {
        const dayHabits = getHabitsForDay(index);
        const count = dayHabits.length;
        const isToday = index === todayIndex;
        const isSelected = index === selectedDay;
        
        // Get first few habit names for preview
        const preview = dayHabits
            .slice(0, 3)
            .map(h => h.name)
            .join(', ');
        const hasMore = count > 3;
        
        return `
            <div 
                class="summary-card ${isToday ? 'today' : ''} ${isSelected ? 'selected' : ''} ${count === 0 ? 'empty' : ''}"
                onclick="selectDay(${index})"
            >
                <div class="summary-card-header">
                    <span class="summary-day-name">${DAY_NAMES_FULL[index]}</span>
                    ${isToday ? '<span class="today-indicator">Today</span>' : ''}
                </div>
                <div class="summary-count">${count}</div>
                <div class="summary-label">habit${count !== 1 ? 's' : ''}</div>
                ${count > 0 ? `
                    <div class="summary-preview">
                        ${escapeHtml(preview)}${hasMore ? '...' : ''}
                    </div>
                ` : `
                    <div class="summary-preview empty">No habits</div>
                `}
            </div>
        `;
    }).join('');
}

/**
 * Main render function - updates all UI components
 */
function render() {
    renderDayTabs();
    renderSelectedDayInfo();
    renderHabits();
    renderWeeklySummary();
}

// ========================================
// Event Handlers
// ========================================

/**
 * Handle day selection from tabs or summary cards
 * @param {number} dayIndex - Day index (0-6)
 */
function selectDay(dayIndex) {
    selectedDay = dayIndex;
    saveSelectedDay();
    render();
    
    // Scroll habits section into view on mobile
    elements.habitsList.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// Make selectDay globally available for onclick handlers
window.selectDay = selectDay;

// ========================================
// Theme Functions
// ========================================

/**
 * Toggle between light and dark theme
 */
function toggleTheme() {
    const currentTheme = document.documentElement.getAttribute('data-theme');
    const newTheme = currentTheme === 'light' ? 'dark' : 'light';
    
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem(STORAGE_KEYS.THEME, newTheme);
    updateThemeIcon(newTheme);
}

/**
 * Load saved theme preference
 */
function loadTheme() {
    const savedTheme = localStorage.getItem(STORAGE_KEYS.THEME);
    if (savedTheme) {
        document.documentElement.setAttribute('data-theme', savedTheme);
        updateThemeIcon(savedTheme);
    }
}

/**
 * Update theme toggle button icon
 */
function updateThemeIcon(theme) {
    if (elements.themeToggle) {
        elements.themeToggle.textContent = theme === 'light' ? '☀️' : '🌙';
    }
}

// ========================================
// Event Listeners
// ========================================

function initEventListeners() {
    // Theme toggle
    if (elements.themeToggle) {
        elements.themeToggle.addEventListener('click', toggleTheme);
    }
    
    // Keyboard navigation for day tabs
    document.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowLeft') {
            // Previous day
            selectDay((selectedDay - 1 + 7) % 7);
        } else if (e.key === 'ArrowRight') {
            // Next day
            selectDay((selectedDay + 1) % 7);
        }
    });
}

// ========================================
// Initialization
// ========================================

/**
 * Initialize the weekly view UI (called on DOMContentLoaded)
 */
function init() {
    loadSelectedDay();
    loadTheme();
    initEventListeners();
    initModalListeners();
    // Data loading happens via initWeeklyData() after auth
    console.log('📅 Weekly View UI initialized, waiting for auth...');
}

/**
 * Initialize weekly data (called from weekly.html after auth confirmed)
 * This ensures data is loaded ONLY for authenticated users
 */
window.initWeeklyData = async function() {
    console.log('🔐 User authenticated, loading weekly data...');
    await loadHabitsFromFirestore();
    render();
    
    // Load and display streak in header
    if (typeof loadStatsFromFirestore === 'function') {
        const stats = await loadStatsFromFirestore();
        if (typeof updateHeaderStreak === 'function') {
            updateHeaderStreak(stats.streak || 0);
        }
    }
};

// ========================================
// Modal Functions
// ========================================

/**
 * Open the habit actions modal
 */
function openHabitModal(habitId) {
    const habit = habits.find(h => h.id === habitId);
    if (!habit) return;
    
    selectedHabitId = habitId;
    
    // Update modal content
    if (elements.modalHabitName) {
        elements.modalHabitName.textContent = habit.name;
    }
    
    // Show/hide "Delete All Days" button for grouped habits
    const groupHabits = habit.groupId ? habits.filter(h => h.groupId === habit.groupId) : [];
    if (elements.modalDeleteAllBtn) {
        if (groupHabits.length > 1) {
            elements.modalDeleteAllBtn.style.display = 'flex';
            elements.modalDeleteAllBtn.innerHTML = `<span>🗑️</span> Delete All ${groupHabits.length} Days`;
        } else {
            elements.modalDeleteAllBtn.style.display = 'none';
        }
    }
    
    // Show modal
    if (elements.modal) {
        elements.modal.classList.add('show');
    }
}

/**
 * Close the habit actions modal
 */
function closeHabitModal() {
    if (elements.modal) {
        elements.modal.classList.remove('show');
    }
    selectedHabitId = null;
}

/**
 * Delete a single habit
 */
async function deleteHabit(habitId) {
    const habit = habits.find(h => h.id === habitId);
    if (!habit) return;
    
    const dayName = DAY_NAMES_FULL[habit.dayOfWeek];
    
    if (confirm(`Delete "${habit.name}" from ${dayName}?`)) {
        try {
            // Remove from local state
            habits = habits.filter(h => h.id !== habitId);
            
            // Delete from Firestore
            if (window.FirebaseDB) {
                await window.FirebaseDB.deleteHabitFromFirestore(habitId);
            }
            
            console.log(`✅ Deleted habit ${habitId}`);
            render();
            closeHabitModal();
        } catch (error) {
            console.error('❌ Error deleting habit:', error);
            alert('Error deleting habit. Please try again.');
        }
    }
}

/**
 * Delete all habits in a group (all days)
 */
async function deleteHabitGroup(habitId) {
    const habit = habits.find(h => h.id === habitId);
    if (!habit || !habit.groupId) return;
    
    const groupHabits = habits.filter(h => h.groupId === habit.groupId);
    const dayNames = groupHabits.map(h => DAYS_OF_WEEK[h.dayOfWeek]).join(', ');
    
    if (confirm(`Delete "${habit.name}" from all ${groupHabits.length} days (${dayNames})?`)) {
        try {
            // Remove all group habits from local state
            const groupIds = groupHabits.map(h => h.id);
            habits = habits.filter(h => !groupIds.includes(h.id));
            
            // Delete all from Firestore
            if (window.FirebaseDB) {
                for (const h of groupHabits) {
                    await window.FirebaseDB.deleteHabitFromFirestore(h.id);
                }
            }
            
            console.log(`✅ Deleted ${groupHabits.length} habits in group`);
            render();
            closeHabitModal();
        } catch (error) {
            console.error('❌ Error deleting habit group:', error);
            alert('Error deleting habits. Please try again.');
        }
    }
}

/**
 * Initialize modal event listeners
 */
function initModalListeners() {
    // Close button
    if (elements.modalClose) {
        elements.modalClose.addEventListener('click', closeHabitModal);
    }
    
    // Click outside to close
    if (elements.modal) {
        elements.modal.addEventListener('click', (e) => {
            if (e.target === elements.modal) {
                closeHabitModal();
            }
        });
    }
    
    // Edit button - go to home page
    if (elements.modalEditBtn) {
        elements.modalEditBtn.addEventListener('click', () => {
            window.location.href = 'index.html';
        });
    }
    
    // Delete button - delete this day only
    if (elements.modalDeleteBtn) {
        elements.modalDeleteBtn.addEventListener('click', () => {
            if (selectedHabitId) {
                deleteHabit(selectedHabitId);
            }
        });
    }
    
    // Delete all days button
    if (elements.modalDeleteAllBtn) {
        elements.modalDeleteAllBtn.addEventListener('click', () => {
            if (selectedHabitId) {
                deleteHabitGroup(selectedHabitId);
            }
        });
    }
    
    // ESC key to close
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && elements.modal?.classList.contains('show')) {
            closeHabitModal();
        }
    });
}

// Make functions available globally
window.openHabitModal = openHabitModal;

// Start the app when DOM is ready
document.addEventListener('DOMContentLoaded', init);
