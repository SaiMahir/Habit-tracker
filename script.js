/**
 * Habit Tracker Application
 * A modern, feature-rich habit tracking app with localStorage persistence
 * 
 * Features:
 * - Add, edit, and delete habits
 * - Mark habits as complete/incomplete
 * - Progress tracking with animated progress bar
 * - Statistics dashboard
 * - Weekly overview chart
 * - Streak counter
 * - Filter by status (all, pending, completed)
 * - Daily reset at midnight
 * - Data persistence via localStorage
 */

// ========================================
// Constants & Configuration
// ========================================

const STORAGE_KEYS = {
    HABITS: 'habitTracker_habits',
    HISTORY: 'habitTracker_history',
    STREAK: 'habitTracker_streak',
    LAST_DATE: 'habitTracker_lastDate',
    BEST_STREAK: 'habitTracker_bestStreak',
    THEME: 'habitTracker_theme'
};

const DAYS_OF_WEEK = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

// ========================================
// State Management
// ========================================

let habits = [];
let history = {};
let streak = 0;
let currentFilter = 'all';

// ========================================
// DOM Elements
// ========================================

const elements = {
    // Form elements
    habitForm: document.getElementById('habit-form'),
    habitName: document.getElementById('habit-name'),
    habitTime: document.getElementById('habit-time'),
    habitDescription: document.getElementById('habit-description'),
    
    // Display elements
    currentDate: document.getElementById('current-date'),
    streakCount: document.getElementById('streak-count'),
    habitsList: document.getElementById('habits-list'),
    emptyState: document.getElementById('empty-state'),
    
    // Progress elements
    progressFill: document.getElementById('progress-fill'),
    progressPercentage: document.getElementById('progress-percentage'),
    
    // Statistics elements
    totalTasks: document.getElementById('total-tasks'),
    completedTasks: document.getElementById('completed-tasks'),
    pendingTasks: document.getElementById('pending-tasks'),
    completionRate: document.getElementById('completion-rate'),
    
    // Chart elements
    weeklyChart: document.getElementById('weekly-chart'),
    chartLabels: document.getElementById('chart-labels'),
    
    // Filter buttons
    filterButtons: document.querySelectorAll('.filter-btn'),
    
    // Modal elements
    editModal: document.getElementById('edit-modal'),
    editForm: document.getElementById('edit-form'),
    editHabitId: document.getElementById('edit-habit-id'),
    editHabitName: document.getElementById('edit-habit-name'),
    editHabitTime: document.getElementById('edit-habit-time'),
    editHabitDescription: document.getElementById('edit-habit-description'),
    modalClose: document.getElementById('modal-close'),
    cancelEdit: document.getElementById('cancel-edit'),
    
    // Theme toggle
    themeToggle: document.getElementById('theme-toggle')
};

// ========================================
// Utility Functions
// ========================================

/**
 * Generate a unique ID for each habit
 * Uses timestamp + random string for uniqueness
 */
function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

/**
 * Get current date in YYYY-MM-DD format
 * Used as a key for daily habit tracking
 */
function getTodayDate() {
    const today = new Date();
    return today.toISOString().split('T')[0];
}

/**
 * Format date for display in the header
 * Returns formatted date like "Friday, January 2, 2026"
 */
function formatDisplayDate(date) {
    const options = { 
        weekday: 'long', 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
    };
    return new Date(date).toLocaleDateString('en-US', options);
}

/**
 * Format time from 24h to 12h format
 * @param {string} time - Time in HH:MM format
 * @returns {string} Time in h:MM AM/PM format
 */
function formatTime(time) {
    const [hours, minutes] = time.split(':');
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour % 12 || 12;
    return `${displayHour}:${minutes} ${ampm}`;
}

/**
 * Get dates for the last 7 days including today
 * Used for the weekly chart
 */
function getLast7Days() {
    const dates = [];
    for (let i = 6; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        dates.push(date.toISOString().split('T')[0]);
    }
    return dates;
}

// ========================================
// LocalStorage Functions
// ========================================

/**
 * Save all data to localStorage
 * Called after any state change
 */
function saveToLocalStorage() {
    localStorage.setItem(STORAGE_KEYS.HABITS, JSON.stringify(habits));
    localStorage.setItem(STORAGE_KEYS.HISTORY, JSON.stringify(history));
    localStorage.setItem(STORAGE_KEYS.STREAK, JSON.stringify(streak));
    localStorage.setItem(STORAGE_KEYS.LAST_DATE, getTodayDate());
}

/**
 * Load all data from localStorage
 * Called on app initialization
 */
function loadFromLocalStorage() {
    const savedHabits = localStorage.getItem(STORAGE_KEYS.HABITS);
    const savedHistory = localStorage.getItem(STORAGE_KEYS.HISTORY);
    const savedStreak = localStorage.getItem(STORAGE_KEYS.STREAK);
    const lastDate = localStorage.getItem(STORAGE_KEYS.LAST_DATE);
    
    if (savedHabits) {
        habits = JSON.parse(savedHabits);
    }
    
    if (savedHistory) {
        history = JSON.parse(savedHistory);
    }
    
    if (savedStreak) {
        streak = JSON.parse(savedStreak);
    }
    
    // Check if we need to perform a daily reset
    checkDailyReset(lastDate);
}

/**
 * Check if it's a new day and perform reset if needed
 * Preserves historical data while resetting today's completions
 * @param {string} lastDate - Last recorded date from localStorage
 */
function checkDailyReset(lastDate) {
    const today = getTodayDate();
    
    if (lastDate && lastDate !== today) {
        // Save yesterday's completion status to history before reset
        const yesterdayHabits = habits.map(h => ({
            id: h.id,
            name: h.name,
            completed: h.completed
        }));
        
        history[lastDate] = yesterdayHabits;
        
        // Check streak - if all habits were completed yesterday
        const allCompletedYesterday = habits.length > 0 && 
            habits.every(h => h.completed);
        
        if (allCompletedYesterday) {
            streak++;
            // Update best streak if needed
            const bestStreak = parseInt(localStorage.getItem(STORAGE_KEYS.BEST_STREAK) || '0');
            if (streak > bestStreak) {
                localStorage.setItem(STORAGE_KEYS.BEST_STREAK, JSON.stringify(streak));
            }
        } else if (habits.length > 0) {
            // Reset streak if any habit was not completed
            streak = 0;
        }
        
        // Reset all habits for the new day
        habits.forEach(habit => {
            habit.completed = false;
        });
        
        saveToLocalStorage();
    }
}

// ========================================
// Render Functions
// ========================================

/**
 * Update the current date display in the header
 */
function renderDate() {
    elements.currentDate.textContent = formatDisplayDate(new Date());
}

/**
 * Update the streak counter display
 */
function renderStreak() {
    elements.streakCount.textContent = streak;
}

/**
 * Render the habits list based on current filter
 */
function renderHabits() {
    // Filter habits based on current filter selection
    let filteredHabits = [...habits];
    
    if (currentFilter === 'pending') {
        filteredHabits = habits.filter(h => !h.completed);
    } else if (currentFilter === 'completed') {
        filteredHabits = habits.filter(h => h.completed);
    }
    
    // Sort habits by time
    filteredHabits.sort((a, b) => a.time.localeCompare(b.time));
    
    // Show empty state if no habits
    if (habits.length === 0) {
        elements.habitsList.innerHTML = '';
        elements.emptyState.classList.add('show');
        return;
    }
    
    elements.emptyState.classList.remove('show');
    
    // Show message if filter has no results but habits exist
    if (filteredHabits.length === 0) {
        elements.habitsList.innerHTML = `
            <div class="empty-state show">
                <div class="empty-icon">🔍</div>
                <p>No ${currentFilter} habits found.</p>
            </div>
        `;
        return;
    }
    
    // Render each habit item
    elements.habitsList.innerHTML = filteredHabits.map(habit => `
        <div class="habit-item ${habit.completed ? 'completed' : ''}" data-id="${habit.id}">
            <label class="habit-checkbox">
                <input 
                    type="checkbox" 
                    ${habit.completed ? 'checked' : ''} 
                    onchange="toggleHabit('${habit.id}')"
                >
                <span class="checkbox-custom"></span>
            </label>
            <div class="habit-content">
                <div class="habit-header">
                    <span class="habit-name">${escapeHtml(habit.name)}</span>
                    <span class="habit-time">
                        ⏰ ${formatTime(habit.time)}
                    </span>
                </div>
                ${habit.description ? `
                    <p class="habit-description">${escapeHtml(habit.description)}</p>
                ` : ''}
            </div>
            <div class="habit-actions">
                <button class="action-btn edit" onclick="openEditModal('${habit.id}')" title="Edit">
                    ✏️
                </button>
                <button class="action-btn delete" onclick="deleteHabit('${habit.id}')" title="Delete">
                    🗑️
                </button>
            </div>
        </div>
    `).join('');
}

/**
 * Escape HTML to prevent XSS attacks
 * @param {string} text - Text to escape
 * @returns {string} Escaped text
 */
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

/**
 * Update progress bar and percentage display
 */
function renderProgress() {
    const total = habits.length;
    const completed = habits.filter(h => h.completed).length;
    const percentage = total === 0 ? 0 : Math.round((completed / total) * 100);
    
    elements.progressFill.style.width = `${percentage}%`;
    elements.progressPercentage.textContent = `${percentage}%`;
}

/**
 * Update statistics cards
 */
function renderStats() {
    const total = habits.length;
    const completed = habits.filter(h => h.completed).length;
    const pending = total - completed;
    const rate = total === 0 ? 0 : Math.round((completed / total) * 100);
    
    elements.totalTasks.textContent = total;
    elements.completedTasks.textContent = completed;
    elements.pendingTasks.textContent = pending;
    elements.completionRate.textContent = `${rate}%`;
}

/**
 * Render the weekly progress chart
 * Shows completion rates for the last 7 days
 */
function renderWeeklyChart() {
    const last7Days = getLast7Days();
    const today = getTodayDate();
    
    // Calculate completion rates for each day
    const chartData = last7Days.map(date => {
        if (date === today) {
            // Today's data from current habits
            const total = habits.length;
            const completed = habits.filter(h => h.completed).length;
            return {
                date,
                rate: total === 0 ? 0 : Math.round((completed / total) * 100),
                isToday: true
            };
        } else {
            // Historical data
            const dayData = history[date];
            if (dayData && dayData.length > 0) {
                const completed = dayData.filter(h => h.completed).length;
                return {
                    date,
                    rate: Math.round((completed / dayData.length) * 100),
                    isToday: false
                };
            }
            return { date, rate: 0, isToday: false };
        }
    });
    
    // Render chart bars
    elements.weeklyChart.innerHTML = chartData.map(data => `
        <div class="chart-bar-container">
            <div 
                class="chart-bar ${data.isToday ? 'today' : ''}" 
                style="height: ${Math.max(data.rate, 4)}%"
                data-value="${data.rate}%"
            ></div>
        </div>
    `).join('');
    
    // Render chart labels (day names)
    elements.chartLabels.innerHTML = chartData.map(data => {
        const dayName = DAYS_OF_WEEK[new Date(data.date).getDay()];
        return `<span class="chart-label ${data.isToday ? 'today' : ''}">${dayName}</span>`;
    }).join('');
}

/**
 * Main render function - updates all UI components
 */
function render() {
    renderDate();
    renderStreak();
    renderHabits();
    renderProgress();
    renderStats();
    renderWeeklyChart();
}

// ========================================
// Habit CRUD Operations
// ========================================

/**
 * Add a new habit
 * @param {string} name - Habit name
 * @param {string} time - Time in HH:MM format
 * @param {string} description - Optional description
 */
function addHabit(name, time, description = '') {
    const newHabit = {
        id: generateId(),
        name: name.trim(),
        time,
        description: description.trim(),
        completed: false,
        createdAt: new Date().toISOString()
    };
    
    habits.push(newHabit);
    saveToLocalStorage();
    render();
}

/**
 * Toggle habit completion status
 * @param {string} id - Habit ID
 */
function toggleHabit(id) {
    const habit = habits.find(h => h.id === id);
    if (habit) {
        habit.completed = !habit.completed;
        saveToLocalStorage();
        render();
    }
}

/**
 * Delete a habit
 * @param {string} id - Habit ID
 */
function deleteHabit(id) {
    if (confirm('Are you sure you want to delete this habit?')) {
        habits = habits.filter(h => h.id !== id);
        saveToLocalStorage();
        render();
    }
}

/**
 * Update an existing habit
 * @param {string} id - Habit ID
 * @param {object} updates - Object with updated properties
 */
function updateHabit(id, updates) {
    const habit = habits.find(h => h.id === id);
    if (habit) {
        Object.assign(habit, updates);
        saveToLocalStorage();
        render();
    }
}

// ========================================
// Modal Functions
// ========================================

/**
 * Open the edit modal for a specific habit
 * @param {string} id - Habit ID to edit
 */
function openEditModal(id) {
    const habit = habits.find(h => h.id === id);
    if (!habit) return;
    
    elements.editHabitId.value = habit.id;
    elements.editHabitName.value = habit.name;
    elements.editHabitTime.value = habit.time;
    elements.editHabitDescription.value = habit.description || '';
    
    elements.editModal.classList.add('show');
    elements.editHabitName.focus();
}

/**
 * Close the edit modal
 */
function closeEditModal() {
    elements.editModal.classList.remove('show');
    elements.editForm.reset();
}

// ========================================
// Filter Functions
// ========================================

/**
 * Set the current filter and update UI
 * @param {string} filter - Filter type: 'all', 'pending', or 'completed'
 */
function setFilter(filter) {
    currentFilter = filter;
    
    // Update active button state
    elements.filterButtons.forEach(btn => {
        btn.classList.toggle('active', btn.dataset.filter === filter);
    });
    
    renderHabits();
}

// ========================================
// Event Listeners
// ========================================

/**
 * Initialize all event listeners
 */
function initEventListeners() {
    // Add habit form submission
    elements.habitForm.addEventListener('submit', (e) => {
        e.preventDefault();
        
        const name = elements.habitName.value;
        const time = elements.habitTime.value;
        const description = elements.habitDescription.value;
        
        if (name && time) {
            addHabit(name, time, description);
            elements.habitForm.reset();
            elements.habitName.focus();
        }
    });
    
    // Filter buttons
    elements.filterButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            setFilter(btn.dataset.filter);
        });
    });
    
    // Edit modal - close button
    elements.modalClose.addEventListener('click', closeEditModal);
    elements.cancelEdit.addEventListener('click', closeEditModal);
    
    // Edit modal - click outside to close
    elements.editModal.addEventListener('click', (e) => {
        if (e.target === elements.editModal) {
            closeEditModal();
        }
    });
    
    // Edit modal - ESC key to close
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && elements.editModal.classList.contains('show')) {
            closeEditModal();
        }
    });
    
    // Edit form submission
    elements.editForm.addEventListener('submit', (e) => {
        e.preventDefault();
        
        const id = elements.editHabitId.value;
        const name = elements.editHabitName.value.trim();
        const time = elements.editHabitTime.value;
        const description = elements.editHabitDescription.value.trim();
        
        if (name && time) {
            updateHabit(id, { name, time, description });
            closeEditModal();
        }
    });
    
    // Theme toggle
    if (elements.themeToggle) {
        elements.themeToggle.addEventListener('click', toggleTheme);
    }
}

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
// Midnight Reset Check
// ========================================

/**
 * Set up a check for midnight reset
 * This ensures the app resets even if left open overnight
 */
function setupMidnightCheck() {
    // Check every minute if it's a new day
    setInterval(() => {
        const storedDate = localStorage.getItem(STORAGE_KEYS.LAST_DATE);
        const today = getTodayDate();
        
        if (storedDate && storedDate !== today) {
            // It's a new day - reload to trigger reset
            location.reload();
        }
    }, 60000); // Check every minute
}

// ========================================
// App Initialization
// ========================================

/**
 * Initialize the application
 * Loads data, sets up event listeners, and renders the UI
 */
function init() {
    // Load saved data
    loadFromLocalStorage();
    
    // Load theme preference
    loadTheme();
    
    // Set up event listeners
    initEventListeners();
    
    // Initial render
    render();
    
    // Set up midnight check
    setupMidnightCheck();
    
    console.log('Habit Tracker initialized successfully! 🚀');
}

// Start the app when DOM is ready
document.addEventListener('DOMContentLoaded', init);

// Make functions available globally for inline event handlers
window.toggleHabit = toggleHabit;
window.deleteHabit = deleteHabit;
window.openEditModal = openEditModal;
