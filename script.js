/**
 * Habit Tracker Application - Firestore User-Scoped Architecture
 * 
 * DATA ISOLATION FIX:
 * ====================
 * This version uses Firebase Firestore with user-scoped paths to ensure
 * each user's data is completely isolated.
 * 
 * WHY DATA WAS SHARED BEFORE:
 * - Previous version used localStorage which is browser-local, not user-scoped
 * - All users on same browser shared the same localStorage keys
 * - No authentication check before reading/writing data
 * 
 * HOW THIS FIX WORKS:
 * - All data operations use Firestore with path: users/{uid}/...
 * - {uid} comes from auth.currentUser.uid (unique per user)
 * - Data only loads AFTER authentication is confirmed
 * - Firestore Security Rules prevent cross-user access
 * 
 * DATA STRUCTURE:
 * - users/{uid}/habits/{habitId}    - Individual habits
 * - users/{uid}/history/{date}      - Daily completion logs
 * - users/{uid}/stats/current       - Streak and statistics
 */

// ========================================
// Constants & Configuration
// ========================================

const STORAGE_KEYS = {
    THEME: 'habitTracker_theme' // Theme is OK in localStorage (not sensitive)
};

const DAYS_OF_WEEK = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const DAY_NAMES_FULL = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

// ========================================
// State Management
// ========================================

let habits = [];
let history = {};
let streak = 0;
let bestStreak = 0;
let lastDate = null;
let currentFilter = 'all';
let isDataLoaded = false;
let currentUserId = null;

// Form state
let addFormDayConfigs = {};
let addFormSelectedDay = null;
let editingGroupId = null;
let editingHabitId = null;

// ========================================
// DOM Elements
// ========================================

// Elements object - populated after DOM is ready
let elements = {};

function initElements() {
    elements = {
        habitForm: document.getElementById('habit-form'),
        habitName: document.getElementById('habit-name'),
        habitTime: document.getElementById('habit-time'),
        habitDescription: document.getElementById('habit-description'),
        currentDate: document.getElementById('current-date'),
        streakCount: document.getElementById('streak-count'),
        habitsList: document.getElementById('habits-list'),
        emptyState: document.getElementById('empty-state'),
        progressFill: document.getElementById('progress-fill'),
        progressPercentage: document.getElementById('progress-percentage'),
        totalTasks: document.getElementById('total-tasks'),
        completedTasks: document.getElementById('completed-tasks'),
        pendingTasks: document.getElementById('pending-tasks'),
        completionRate: document.getElementById('completion-rate'),
        weeklyChart: document.getElementById('weekly-chart'),
        chartLabels: document.getElementById('chart-labels'),
        filterButtons: document.querySelectorAll('.filter-btn'),
        editModal: document.getElementById('edit-modal'),
        editForm: document.getElementById('edit-form'),
        editHabitId: document.getElementById('edit-habit-id'),
        editHabitName: document.getElementById('edit-habit-name'),
        editHabitTime: document.getElementById('edit-habit-time'),
        editHabitDescription: document.getElementById('edit-habit-description'),
        modalClose: document.getElementById('modal-close'),
        cancelEdit: document.getElementById('cancel-edit'),
        themeToggle: document.getElementById('theme-toggle')
    };
    console.log('✅ DOM elements initialized');
    console.log('   habitForm:', elements.habitForm ? 'FOUND' : 'NOT FOUND');
    console.log('   habitName:', elements.habitName ? 'FOUND' : 'NOT FOUND');
}

// ========================================
// Utility Functions
// ========================================

function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

function getTodayDate() {
    return new Date().toISOString().split('T')[0];
}

function getTodayDayIndex() {
    return new Date().getDay();
}

function getDayIndexFromDate(dateStr) {
    return new Date(dateStr + 'T00:00:00').getDay();
}

function formatDisplayDate(date) {
    const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    return new Date(date).toLocaleDateString('en-US', options);
}

function formatTime(time) {
    if (!time) return '';
    const [hours, minutes] = time.split(':');
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour % 12 || 12;
    return `${displayHour}:${minutes} ${ampm}`;
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

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
// Habit Query Functions
// ========================================

function getTodaysHabits() {
    const todayIndex = getTodayDayIndex();
    return habits.filter(h => h.dayOfWeek === todayIndex);
}

function getHabitsByGroup(groupId) {
    if (!groupId) return [];
    return habits.filter(h => h.groupId === groupId);
}

function getGroupDays(groupId) {
    return habits
        .filter(h => h.groupId === groupId)
        .map(h => h.dayOfWeek)
        .sort((a, b) => a - b);
}

// ========================================
// Firebase Data Operations
// ========================================

/**
 * Load all user data from Firestore
 * CRITICAL: Only called after authentication is confirmed
 */
async function loadFromFirestore() {
    if (!window.FirebaseDB) {
        console.error('❌ FirebaseDB not loaded');
        return;
    }
    
    currentUserId = window.FirebaseDB.getCurrentUserId();
    if (!currentUserId) {
        console.log('⚠️ No authenticated user, cannot load data');
        return;
    }
    
    console.log(`📂 Loading data for user: ${currentUserId}`);
    
    try {
        // First, check if we need to migrate localStorage data
        await window.FirebaseDB.migrateLocalStorageToFirestore();
        
        // Load habits
        habits = await window.FirebaseDB.loadHabitsFromFirestore();
        
        // Load history
        history = await window.FirebaseDB.loadHistoryFromFirestore();
        
        // Load stats
        const stats = await window.FirebaseDB.loadStatsFromFirestore();
        streak = stats.streak || 0;
        bestStreak = stats.bestStreak || 0;
        lastDate = stats.lastDate;
        
        // Check for daily reset
        await checkDailyReset();
        
        isDataLoaded = true;
        console.log('✅ User data loaded successfully');
        
        // Render the UI
        render();
    } catch (error) {
        console.error('❌ Error loading data:', error);
    }
}

/**
 * Save all data to Firestore
 */
async function saveToFirestore() {
    if (!window.FirebaseDB || !currentUserId) {
        console.warn('⚠️ Cannot save: no user authenticated');
        return;
    }
    
    try {
        // Save all habits
        await window.FirebaseDB.saveAllHabitsToFirestore(habits);
        
        // Save stats
        await window.FirebaseDB.saveStatsToFirestore({
            streak,
            bestStreak,
            lastDate: getTodayDate()
        });
        
        console.log('✅ Data saved to Firestore');
    } catch (error) {
        console.error('❌ Error saving data:', error);
    }
}

/**
 * Check for daily reset and handle streak
 */
async function checkDailyReset() {
    const today = getTodayDate();
    
    if (lastDate && lastDate !== today) {
        console.log('🔄 New day detected, performing reset...');
        
        // Get yesterday's day index
        const yesterdayIndex = getDayIndexFromDate(lastDate);
        
        // Get habits that were active yesterday
        const yesterdayHabits = habits.filter(h => h.dayOfWeek === yesterdayIndex);
        
        // Save yesterday's completion to history
        if (yesterdayHabits.length > 0) {
            const yesterdayRecord = yesterdayHabits.map(h => ({
                id: h.id,
                groupId: h.groupId,
                name: h.name,
                completed: h.completed
            }));
            
            history[lastDate] = yesterdayRecord;
            await window.FirebaseDB.saveHistoryToFirestore(lastDate, yesterdayRecord);
            
            // Calculate streak
            const allCompletedYesterday = yesterdayHabits.every(h => h.completed);
            
            if (allCompletedYesterday) {
                streak++;
                if (streak > bestStreak) {
                    bestStreak = streak;
                }
            } else {
                streak = 0;
            }
        }
        
        // Reset completion status for all habits
        habits.forEach(habit => {
            habit.completed = false;
        });
        
        lastDate = today;
        await saveToFirestore();
    }
}

// ========================================
// Render Functions
// ========================================

function renderDate() {
    if (elements.currentDate) {
        elements.currentDate.textContent = formatDisplayDate(new Date());
    }
}

function renderStreak() {
    if (elements.streakCount) {
        elements.streakCount.textContent = streak;
    }
}

function renderHabits() {
    if (!elements.habitsList) {
        console.error('❌ habitsList element not found!');
        return;
    }
    
    console.log('🎨 renderHabits called');
    console.log('   Total habits in state:', habits.length);
    console.log('   Today day index:', getTodayDayIndex());
    console.log('   All habits:', habits);
    
    let todaysHabits = getTodaysHabits();
    console.log('   Todays habits:', todaysHabits.length);
    
    if (currentFilter === 'pending') {
        todaysHabits = todaysHabits.filter(h => !h.completed);
    } else if (currentFilter === 'completed') {
        todaysHabits = todaysHabits.filter(h => h.completed);
    }
    
    todaysHabits.sort((a, b) => (a.time || '').localeCompare(b.time || ''));
    
    const allTodaysHabits = getTodaysHabits();
    if (allTodaysHabits.length === 0) {
        elements.habitsList.innerHTML = '';
        if (elements.emptyState) elements.emptyState.classList.add('show');
        return;
    }
    
    if (elements.emptyState) elements.emptyState.classList.remove('show');
    
    if (todaysHabits.length === 0) {
        elements.habitsList.innerHTML = `
            <div class="empty-state show">
                <div class="empty-icon">🔍</div>
                <p>No ${currentFilter} habits found for today.</p>
            </div>
        `;
        return;
    }
    
    elements.habitsList.innerHTML = todaysHabits.map(habit => {
        const groupDays = habit.groupId ? getGroupDays(habit.groupId) : [habit.dayOfWeek];
        const isGrouped = groupDays.length > 1;
        const groupIndicator = isGrouped 
            ? `<span class="habit-group-indicator" title="Active on: ${groupDays.map(d => DAYS_OF_WEEK[d]).join(', ')}">
                📅 ${groupDays.length} days
               </span>`
            : '';
        
        return `
            <div class="habit-item ${habit.completed ? 'completed' : ''}" data-id="${habit.id}">
                <label class="habit-checkbox">
                    <input type="checkbox" ${habit.completed ? 'checked' : ''} 
                        onchange="toggleHabit('${habit.id}')">
                    <span class="checkbox-custom"></span>
                </label>
                <div class="habit-content">
                    <div class="habit-header">
                        <span class="habit-name">${escapeHtml(habit.name)}</span>
                        <span class="habit-time">⏰ ${formatTime(habit.time)}</span>
                        ${groupIndicator}
                    </div>
                    ${habit.description ? `<p class="habit-description">${escapeHtml(habit.description)}</p>` : ''}
                </div>
                <div class="habit-actions">
                    <button class="action-btn edit" onclick="openEditModal('${habit.id}')" title="Edit">✏️</button>
                    <button class="action-btn delete" onclick="deleteHabit('${habit.id}')" title="Delete">🗑️</button>
                </div>
            </div>
        `;
    }).join('');
}

function renderProgress() {
    const todaysHabits = getTodaysHabits();
    const total = todaysHabits.length;
    const completed = todaysHabits.filter(h => h.completed).length;
    const percentage = total === 0 ? 0 : Math.round((completed / total) * 100);
    
    if (elements.progressFill) elements.progressFill.style.width = `${percentage}%`;
    if (elements.progressPercentage) elements.progressPercentage.textContent = `${percentage}%`;
}

function renderStats() {
    const todaysHabits = getTodaysHabits();
    const total = todaysHabits.length;
    const completed = todaysHabits.filter(h => h.completed).length;
    const pending = total - completed;
    const rate = total === 0 ? 0 : Math.round((completed / total) * 100);
    
    if (elements.totalTasks) elements.totalTasks.textContent = total;
    if (elements.completedTasks) elements.completedTasks.textContent = completed;
    if (elements.pendingTasks) elements.pendingTasks.textContent = pending;
    if (elements.completionRate) elements.completionRate.textContent = `${rate}%`;
}

function renderWeeklyChart() {
    if (!elements.weeklyChart || !elements.chartLabels) return;
    
    const last7Days = getLast7Days();
    const today = getTodayDate();
    
    const chartData = last7Days.map(date => {
        const dayIndex = getDayIndexFromDate(date);
        
        if (date === today) {
            const todaysHabits = habits.filter(h => h.dayOfWeek === dayIndex);
            const total = todaysHabits.length;
            const completed = todaysHabits.filter(h => h.completed).length;
            return { date, rate: total === 0 ? 0 : Math.round((completed / total) * 100), isToday: true };
        } else {
            const dayData = history[date];
            if (dayData && dayData.length > 0) {
                const completed = dayData.filter(h => h.completed).length;
                return { date, rate: Math.round((completed / dayData.length) * 100), isToday: false };
            }
            return { date, rate: 0, isToday: false };
        }
    });
    
    elements.weeklyChart.innerHTML = chartData.map(data => `
        <div class="chart-bar-container">
            <div class="chart-bar ${data.isToday ? 'today' : ''}" 
                style="height: ${Math.max(data.rate, 4)}%" data-value="${data.rate}%"></div>
        </div>
    `).join('');
    
    elements.chartLabels.innerHTML = chartData.map(data => {
        const dayName = DAYS_OF_WEEK[new Date(data.date).getDay()];
        return `<span class="chart-label ${data.isToday ? 'today' : ''}">${dayName}</span>`;
    }).join('');
}

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

async function addHabits(dayConfigs) {
    console.log('📝 addHabits called with:', dayConfigs);
    
    const days = Object.keys(dayConfigs).map(Number);
    if (days.length === 0) {
        console.warn('⚠️ No days provided');
        return;
    }
    
    const groupId = days.length > 1 ? generateId() : null;
    
    const newHabits = days.map(dayIndex => {
        const config = dayConfigs[dayIndex];
        return {
            id: generateId(),
            groupId: groupId,
            dayOfWeek: dayIndex,
            name: config.name.trim(),
            time: config.time || '09:00',
            description: (config.description || '').trim(),
            completed: false,
            createdAt: new Date().toISOString()
        };
    });
    
    console.log('📝 Creating habits:', newHabits);
    
    // Add to local state FIRST
    habits.push(...newHabits);
    console.log('📝 Added to local state. Total habits:', habits.length);
    
    // Render immediately so user sees the habit
    render();
    console.log('✅ Habit added locally!');
    
    // Try to save to Firestore (non-blocking for UI)
    try {
        if (window.FirebaseDB) {
            for (const habit of newHabits) {
                await window.FirebaseDB.saveHabitToFirestore(habit);
            }
            console.log('✅ Habits synced to Firestore');
        }
    } catch (error) {
        console.warn('⚠️ Could not sync to Firestore (ad blocker?):', error.message);
        // Don't rollback - keep habit locally, it will sync when Firestore is available
    }
}

async function toggleHabit(id) {
    const habit = habits.find(h => h.id === id);
    if (habit) {
        habit.completed = !habit.completed;
        await window.FirebaseDB.updateHabitInFirestore(id, { completed: habit.completed });
        render();
    }
}

async function deleteHabit(id) {
    const habit = habits.find(h => h.id === id);
    if (!habit) return;
    
    const groupHabits = habit.groupId ? getHabitsByGroup(habit.groupId) : [];
    
    if (groupHabits.length > 1) {
        const dayName = DAY_NAMES_FULL[habit.dayOfWeek];
        if (confirm(`This habit repeats on ${groupHabits.length} days.\n\nClick OK to delete only ${dayName}'s version.`)) {
            habits = habits.filter(h => h.id !== id);
            await window.FirebaseDB.deleteHabitFromFirestore(id);
            render();
        }
    } else {
        if (confirm('Are you sure you want to delete this habit?')) {
            habits = habits.filter(h => h.id !== id);
            await window.FirebaseDB.deleteHabitFromFirestore(id);
            render();
        }
    }
}

async function updateHabit(id, updates) {
    const habit = habits.find(h => h.id === id);
    if (habit) {
        Object.assign(habit, updates);
        await window.FirebaseDB.updateHabitInFirestore(id, updates);
        render();
    }
}

// ========================================
// Modal Functions
// ========================================

function openEditModal(id) {
    const habit = habits.find(h => h.id === id);
    if (!habit) return;
    
    editingHabitId = id;
    editingGroupId = habit.groupId;
    
    elements.editHabitId.value = habit.id;
    elements.editHabitName.value = habit.name;
    elements.editHabitTime.value = habit.time;
    elements.editHabitDescription.value = habit.description || '';
    
    const dayName = DAY_NAMES_FULL[habit.dayOfWeek];
    const modalTitle = document.querySelector('#edit-modal .modal-header h3');
    if (modalTitle) {
        modalTitle.textContent = `Edit Habit (${dayName})`;
    }
    
    updateEditModalGroupInfo(habit);
    elements.editModal.classList.add('show');
    elements.editHabitName.focus();
}

function updateEditModalGroupInfo(habit) {
    let groupInfo = document.getElementById('edit-group-info');
    if (!groupInfo) {
        groupInfo = document.createElement('div');
        groupInfo.id = 'edit-group-info';
        groupInfo.className = 'edit-group-info';
        elements.editForm.insertBefore(groupInfo, elements.editForm.firstChild);
    }
    
    if (habit.groupId) {
        const groupHabits = getHabitsByGroup(habit.groupId);
        const days = groupHabits.map(h => DAYS_OF_WEEK[h.dayOfWeek]).join(', ');
        groupInfo.innerHTML = `
            <div class="group-info-banner">
                <span class="group-info-icon">📅</span>
                <span class="group-info-text">This habit repeats on: <strong>${days}</strong></span>
            </div>
            <p class="group-info-note">Editing only affects ${DAY_NAMES_FULL[habit.dayOfWeek]}.</p>
        `;
        groupInfo.style.display = 'block';
    } else {
        groupInfo.style.display = 'none';
    }
}

function closeEditModal() {
    elements.editModal.classList.remove('show');
    elements.editForm.reset();
    editingHabitId = null;
    editingGroupId = null;
    
    const modalTitle = document.querySelector('#edit-modal .modal-header h3');
    if (modalTitle) modalTitle.textContent = 'Edit Habit';
}

function openGroupEditModal(groupId) {
    const groupHabits = getHabitsByGroup(groupId);
    alert(`This habit appears on ${groupHabits.length} days:\n` +
        groupHabits.map(h => `• ${DAY_NAMES_FULL[h.dayOfWeek]}: ${h.name} at ${formatTime(h.time)}`).join('\n'));
}

// ========================================
// Day Selector Functions
// ========================================

function initAddFormDaySelector() {
    const daySelector = document.querySelector('#habit-form .day-selector');
    if (!daySelector) return;
    
    daySelector.querySelectorAll('.day-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const dayIndex = parseInt(btn.dataset.day);
            toggleDaySelection(dayIndex);
        });
    });
}

function toggleDaySelection(dayIndex) {
    const dayBtn = document.querySelector(`#habit-form .day-btn[data-day="${dayIndex}"]`);
    if (!dayBtn) return;
    
    if (addFormDayConfigs[dayIndex]) {
        delete addFormDayConfigs[dayIndex];
        dayBtn.classList.remove('selected', 'has-config');
        if (addFormSelectedDay === dayIndex) {
            addFormSelectedDay = null;
            hideDayConfigPanel();
        }
    } else {
        addFormSelectedDay = dayIndex;
        addFormDayConfigs[dayIndex] = {
            name: elements.habitName.value || '',
            time: elements.habitTime.value || '',
            description: elements.habitDescription.value || ''
        };
        dayBtn.classList.add('selected');
        showDayConfigPanel(dayIndex);
    }
    
    updateDaySelectorDisplay();
}

function showDayConfigPanel(dayIndex) {
    const panel = document.getElementById('day-config-panel');
    if (!panel) return;
    
    const config = addFormDayConfigs[dayIndex] || {
        name: elements.habitName.value || '',
        time: elements.habitTime.value || '',
        description: elements.habitDescription.value || ''
    };
    
    const titleEl = panel.querySelector('.day-config-title');
    if (titleEl) titleEl.textContent = `${DAY_NAMES_FULL[dayIndex]} Settings`;
    
    const nameInput = document.getElementById('day-config-name');
    const timeInput = document.getElementById('day-config-time');
    const descInput = document.getElementById('day-config-description');
    
    if (nameInput) nameInput.value = config.name;
    if (timeInput) timeInput.value = config.time;
    if (descInput) descInput.value = config.description;
    
    panel.dataset.dayIndex = dayIndex;
    panel.style.display = 'block';
}

function hideDayConfigPanel() {
    const panel = document.getElementById('day-config-panel');
    if (panel) {
        panel.style.display = 'none';
        delete panel.dataset.dayIndex;
    }
}

function saveDayConfig() {
    const panel = document.getElementById('day-config-panel');
    if (!panel) return;
    
    const dayIndex = parseInt(panel.dataset.dayIndex);
    if (isNaN(dayIndex)) return;
    
    addFormDayConfigs[dayIndex] = {
        name: document.getElementById('day-config-name')?.value || '',
        time: document.getElementById('day-config-time')?.value || '',
        description: document.getElementById('day-config-description')?.value || ''
    };
    
    const dayBtn = document.querySelector(`#habit-form .day-btn[data-day="${dayIndex}"]`);
    if (dayBtn) dayBtn.classList.add('has-config');
    
    updateDaySelectorDisplay();
    hideDayConfigPanel();
}

function updateDaySelectorDisplay() {
    const selectedDays = Object.keys(addFormDayConfigs).map(Number);
    const summaryEl = document.getElementById('selected-days-summary');
    
    if (summaryEl) {
        if (selectedDays.length === 0) {
            summaryEl.textContent = 'No days selected - habit will be added for today only';
        } else if (selectedDays.length === 7) {
            summaryEl.textContent = 'Every day';
        } else {
            const dayNames = selectedDays.sort((a, b) => a - b).map(d => DAYS_OF_WEEK[d]);
            summaryEl.textContent = `Selected: ${dayNames.join(', ')}`;
        }
    }
    
    document.querySelectorAll('#habit-form .day-btn').forEach(btn => {
        const dayIndex = parseInt(btn.dataset.day);
        btn.classList.toggle('selected', addFormDayConfigs[dayIndex] !== undefined);
    });
}

function resetAddFormDaySelector() {
    addFormDayConfigs = {};
    addFormSelectedDay = null;
    hideDayConfigPanel();
    updateDaySelectorDisplay();
    
    document.querySelectorAll('#habit-form .day-btn').forEach(btn => {
        btn.classList.remove('selected', 'has-config');
    });
}

// ========================================
// Add Habit Accordion Functions
// ========================================

/**
 * Initialize the Add Habit collapsible accordion
 * 
 * HOW IT WORKS:
 * - The accordion starts collapsed (max-height: 0, opacity: 0)
 * - Clicking the header toggles the 'expanded' class on the section
 * - CSS transitions handle the smooth height/opacity animation
 * - When expanded, the color scheme changes to neon green via CSS
 * 
 * WHY THIS APPROACH:
 * - Pure CSS transitions are smooth and performant
 * - The 'expanded' class controls both animation and color theme
 * - Keyboard accessible via tabindex and keydown listener
 */
function initAddHabitAccordion() {
    const section = document.getElementById('add-habit-section');
    const header = document.getElementById('add-habit-header');
    
    if (!section || !header) return;
    
    // Click handler
    header.addEventListener('click', () => {
        toggleAddHabitAccordion();
    });
    
    // Keyboard accessibility (Enter or Space to toggle)
    header.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            toggleAddHabitAccordion();
        }
    });
}

/**
 * Toggle the Add Habit accordion open/closed
 */
function toggleAddHabitAccordion() {
    const section = document.getElementById('add-habit-section');
    const header = document.getElementById('add-habit-header');
    
    if (!section) return;
    
    const isExpanded = section.classList.toggle('expanded');
    
    // Update ARIA attribute for accessibility
    if (header) {
        header.setAttribute('aria-expanded', isExpanded.toString());
    }
    
    // Focus the first input when expanded
    if (isExpanded) {
        setTimeout(() => {
            const firstInput = document.getElementById('habit-name');
            if (firstInput) firstInput.focus();
        }, 300); // Wait for animation to complete
    }
}

/**
 * Collapse the Add Habit accordion (used after form submission)
 */
function collapseAddHabitAccordion() {
    const section = document.getElementById('add-habit-section');
    const header = document.getElementById('add-habit-header');
    
    if (section) {
        section.classList.remove('expanded');
    }
    if (header) {
        header.setAttribute('aria-expanded', 'false');
    }
}

// ========================================
// Filter Functions
// ========================================

function setFilter(filter) {
    currentFilter = filter;
    elements.filterButtons.forEach(btn => {
        btn.classList.toggle('active', btn.dataset.filter === filter);
    });
    renderHabits();
}

// ========================================
// Event Listeners
// ========================================

function initEventListeners() {
    // Initialize Add Habit accordion
    initAddHabitAccordion();
    
    initAddFormDaySelector();
    
    const saveConfigBtn = document.getElementById('save-day-config');
    if (saveConfigBtn) saveConfigBtn.addEventListener('click', saveDayConfig);
    
    const closeConfigBtn = document.getElementById('close-day-config');
    if (closeConfigBtn) closeConfigBtn.addEventListener('click', hideDayConfigPanel);
    
    if (elements.habitForm) {
        console.log('✅ Form found, attaching submit handler');
        elements.habitForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            console.log('📝 Form submitted!');
            
            // Auto-save any open day config panel
            const panel = document.getElementById('day-config-panel');
            if (panel && panel.style.display !== 'none' && panel.dataset.dayIndex) {
                saveDayConfig();
            }
            
            const name = elements.habitName.value.trim();
            const time = elements.habitTime.value;
            const description = elements.habitDescription.value.trim().substring(0, 60);
            
            // Enforce character limits
            const trimmedName = name.substring(0, 30);
            
            console.log('📝 Form values:', { name: trimmedName, time, description });
            console.log('📝 Day configs:', addFormDayConfigs);
            
            const selectedDays = Object.keys(addFormDayConfigs);
            
            // Check for duplicate habit name
            const existingHabit = habits.find(h => h.name.toLowerCase() === trimmedName.toLowerCase());
            if (existingHabit) {
                const confirmAdd = confirm(`A habit named "${trimmedName}" already exists. Do you want to add another habit with the same name?`);
                if (!confirmAdd) {
                    return;
                }
            }
            
            try {
                if (selectedDays.length === 0) {
                    // No days selected - use main form for today
                    if (!trimmedName) {
                        alert('Please enter a habit name.');
                        return;
                    }
                    const finalTime = time || '09:00';
                    const todayConfig = { [getTodayDayIndex()]: { name: trimmedName, time: finalTime, description } };
                    await addHabits(todayConfig);
                } else {
                    // Fill in missing values from main form
                    selectedDays.forEach(day => {
                        if (!addFormDayConfigs[day].name) addFormDayConfigs[day].name = trimmedName;
                        if (!addFormDayConfigs[day].time) addFormDayConfigs[day].time = time || '09:00';
                        if (!addFormDayConfigs[day].description) addFormDayConfigs[day].description = description;
                        // Enforce limits on day configs too
                        if (addFormDayConfigs[day].name) addFormDayConfigs[day].name = addFormDayConfigs[day].name.substring(0, 30);
                        if (addFormDayConfigs[day].description) addFormDayConfigs[day].description = addFormDayConfigs[day].description.substring(0, 60);
                    });
                    
                    // Filter configs that have a name
                    const validConfigs = {};
                    selectedDays.forEach(day => {
                        if (addFormDayConfigs[day].name) {
                            validConfigs[day] = addFormDayConfigs[day];
                        }
                    });
                    
                    if (Object.keys(validConfigs).length === 0) {
                        alert('Please enter a habit name.');
                        return;
                    }
                    
                    await addHabits(validConfigs);
                }
                
                elements.habitForm.reset();
                resetAddFormDaySelector();
                collapseAddHabitAccordion();
            } catch (error) {
                console.error('❌ Form submission error:', error);
                alert('Error adding habit: ' + error.message);
            }
        });
    } else {
        console.error('❌ habit-form element not found!');
    }
    
    elements.filterButtons.forEach(btn => {
        btn.addEventListener('click', () => setFilter(btn.dataset.filter));
    });
    
    if (elements.modalClose) elements.modalClose.addEventListener('click', closeEditModal);
    if (elements.cancelEdit) elements.cancelEdit.addEventListener('click', closeEditModal);
    if (elements.editModal) {
        elements.editModal.addEventListener('click', (e) => {
            if (e.target === elements.editModal) closeEditModal();
        });
    }
    
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && elements.editModal?.classList.contains('show')) {
            closeEditModal();
        }
    });
    
    if (elements.editForm) {
        elements.editForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const id = elements.editHabitId.value;
            const name = elements.editHabitName.value.trim();
            const time = elements.editHabitTime.value;
            const description = elements.editHabitDescription.value.trim();
            
            if (name && time) {
                await updateHabit(id, { name, time, description });
                closeEditModal();
            }
        });
    }
    
    if (elements.themeToggle) {
        elements.themeToggle.addEventListener('click', toggleTheme);
    }
}

// ========================================
// Theme Functions
// ========================================

function toggleTheme() {
    const currentTheme = document.documentElement.getAttribute('data-theme');
    const newTheme = currentTheme === 'light' ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem(STORAGE_KEYS.THEME, newTheme);
    updateThemeIcon(newTheme);
}

function loadTheme() {
    const savedTheme = localStorage.getItem(STORAGE_KEYS.THEME);
    if (savedTheme) {
        document.documentElement.setAttribute('data-theme', savedTheme);
        updateThemeIcon(savedTheme);
    }
}

function updateThemeIcon(theme) {
    if (elements.themeToggle) {
        elements.themeToggle.textContent = theme === 'light' ? '☀️' : '🌙';
    }
}

// ========================================
// App Initialization
// ========================================

/**
 * Initialize the app - WAITS for authentication
 * Data is NOT loaded until user is authenticated
 */
async function init() {
    console.log('🚀 Initializing Habit Tracker...');
    
    // CRITICAL: Initialize DOM elements first
    initElements();
    
    loadTheme();
    initEventListeners();
    renderDate();
    
    // Wait for Firebase to be ready and user to be authenticated
    // The actual data loading happens when onAuthStateChanged fires in index.html
    // and calls window.initHabitData()
    
    console.log('⏳ Waiting for authentication...');
}

/**
 * Called from index.html after user is authenticated
 * This ensures data is loaded ONLY for authenticated users
 */
window.initHabitData = async function() {
    console.log('🔐 User authenticated, loading data...');
    await loadFromFirestore();
};

// Start when DOM is ready
document.addEventListener('DOMContentLoaded', init);

// Global exports
window.toggleHabit = toggleHabit;
window.deleteHabit = deleteHabit;
window.openEditModal = openEditModal;
window.openGroupEditModal = openGroupEditModal;

// Navigation
const statsLink = document.getElementById('statsLink');
if (statsLink) {
    statsLink.addEventListener('click', () => {
        window.location.href = './stats.html';
    });
}
