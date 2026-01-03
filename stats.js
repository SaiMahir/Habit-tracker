/**
 * Statistics Page JavaScript
 * Handles data visualization and statistics calculations
 * 
 * Features:
 * - Weekly and Monthly statistics views
 * - Animated bar charts
 * - Streak visualization calendar
 * - Week vs Previous Week comparison
 * - Individual habit breakdown
 * - Animated number counters
 * 
 * DATA ISOLATION:
 * - Uses Firebase Firestore with user-scoped paths
 * - Data loaded only after authentication
 * - Each user sees only their own statistics
 */

// ========================================
// Constants & Configuration
// ========================================

const STORAGE_KEYS = {
    THEME: 'habitTracker_theme' // Theme stays in localStorage (not sensitive)
};

const DAYS_OF_WEEK = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// ========================================
// State Management
// ========================================

let habits = [];
let history = {};
let streak = 0;
let bestStreak = 0;
let currentPeriod = 'week';
let isDataLoaded = false;

// ========================================
// DOM Elements
// ========================================

const elements = {
    // Period tabs
    periodTabs: document.querySelectorAll('.period-tab'),
    periodTitle: document.getElementById('period-title'),
    
    // Streak elements
    currentStreak: document.getElementById('current-streak'),
    bestStreak: document.getElementById('best-streak'),
    
    // Overview stats
    totalTasksStat: document.getElementById('total-tasks-stat'),
    completedStat: document.getElementById('completed-stat'),
    completionRateStat: document.getElementById('completion-rate-stat'),
    bestDayStat: document.getElementById('best-day-stat'),
    bestDayRate: document.getElementById('best-day-rate'),
    
    // Trends
    totalTrend: document.getElementById('total-trend'),
    completedTrend: document.getElementById('completed-trend'),
    rateTrend: document.getElementById('rate-trend'),
    
    // Chart
    completionChart: document.getElementById('completion-chart'),
    chartXLabels: document.getElementById('chart-x-labels'),
    
    // Highlights
    highlightBestDay: document.getElementById('highlight-best-day'),
    highlightBestRate: document.getElementById('highlight-best-rate'),
    highlightWorstDay: document.getElementById('highlight-worst-day'),
    highlightWorstRate: document.getElementById('highlight-worst-rate'),
    highlightAvgRate: document.getElementById('highlight-avg-rate'),
    
    // Streak calendar
    streakCalendar: document.getElementById('streak-calendar'),
    perfectDays: document.getElementById('perfect-days'),
    activeDays: document.getElementById('active-days'),
    
    // Comparison
    thisWeekRate: document.getElementById('this-week-rate'),
    lastWeekRate: document.getElementById('last-week-rate'),
    thisWeekBar: document.getElementById('this-week-bar'),
    lastWeekBar: document.getElementById('last-week-bar'),
    comparisonSummary: document.getElementById('comparison-summary'),
    
    // Breakdown
    habitsBreakdown: document.getElementById('habits-breakdown'),
    breakdownEmpty: document.getElementById('breakdown-empty'),
    
    // Theme toggle
    themeToggle: document.getElementById('theme-toggle')
};

// ========================================
// Utility Functions
// ========================================

/**
 * Get current date in YYYY-MM-DD format
 */
function getTodayDate() {
    return new Date().toISOString().split('T')[0];
}

/**
 * Get array of dates for the last N days
 * @param {number} days - Number of days to get
 * @returns {string[]} Array of date strings
 */
function getLastNDays(days) {
    const dates = [];
    for (let i = days - 1; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        dates.push(date.toISOString().split('T')[0]);
    }
    return dates;
}

/**
 * Get date range for current month
 * @returns {string[]} Array of date strings for current month
 */
function getCurrentMonthDates() {
    const today = new Date();
    const year = today.getFullYear();
    const month = today.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const currentDay = today.getDate();
    
    const dates = [];
    for (let day = 1; day <= currentDay; day++) {
        const date = new Date(year, month, day);
        dates.push(date.toISOString().split('T')[0]);
    }
    return dates;
}

/**
 * Format date for display
 * @param {string} dateStr - Date string in YYYY-MM-DD format
 * @returns {string} Formatted date
 */
function formatDate(dateStr) {
    const date = new Date(dateStr);
    return `${MONTHS[date.getMonth()]} ${date.getDate()}`;
}

/**
 * Get day name from date
 * @param {string} dateStr - Date string
 * @returns {string} Day name (e.g., "Mon")
 */
function getDayName(dateStr) {
    const date = new Date(dateStr);
    return DAYS_OF_WEEK[date.getDay()];
}

/**
 * Get completion stats for a specific date
 * @param {string} date - Date string
 * @returns {object} Object with total, completed, and rate
 */
function getDateStats(date) {
    const today = getTodayDate();
    
    if (date === today) {
        // Use current habits data for today
        const total = habits.length;
        const completed = habits.filter(h => h.completed).length;
        return {
            total,
            completed,
            rate: total === 0 ? 0 : Math.round((completed / total) * 100)
        };
    } else {
        // Use historical data
        const dayData = history[date];
        if (dayData && dayData.length > 0) {
            const completed = dayData.filter(h => h.completed).length;
            return {
                total: dayData.length,
                completed,
                rate: Math.round((completed / dayData.length) * 100)
            };
        }
        return { total: 0, completed: 0, rate: 0 };
    }
}

// ========================================
// Firestore Data Functions
// ========================================

/**
 * Load data from Firestore (user-scoped)
 * CRITICAL: Only called after authentication is confirmed
 */
async function loadFromFirestore() {
    if (!window.FirebaseDB) {
        console.error('❌ FirebaseDB not loaded');
        return;
    }
    
    const userId = window.FirebaseDB.getCurrentUserId();
    if (!userId) {
        console.warn('⚠️ No authenticated user, cannot load stats');
        return;
    }
    
    console.log(`📊 Loading statistics for user: ${userId}`);
    
    try {
        // Load habits
        habits = await window.FirebaseDB.loadHabitsFromFirestore();
        
        // Load history
        history = await window.FirebaseDB.loadHistoryFromFirestore();
        
        // Load stats
        const stats = await window.FirebaseDB.loadStatsFromFirestore();
        streak = stats.streak || 0;
        bestStreak = stats.bestStreak || 0;
        
        // Update best streak if current is higher
        if (streak > bestStreak) {
            bestStreak = streak;
            await window.FirebaseDB.saveStatsToFirestore({
                ...stats,
                bestStreak: bestStreak
            });
        }
        
        isDataLoaded = true;
        console.log('✅ Statistics data loaded');
        
        // Render the UI
        render();
    } catch (error) {
        console.error('❌ Error loading statistics:', error);
    }
}

/**
 * Load theme preference
 */
function loadTheme() {
    const savedTheme = localStorage.getItem(STORAGE_KEYS.THEME);
    if (savedTheme) {
        document.documentElement.setAttribute('data-theme', savedTheme);
        updateThemeIcon(savedTheme);
    }
}

/**
 * Update theme toggle icon
 */
function updateThemeIcon(theme) {
    if (elements.themeToggle) {
        elements.themeToggle.textContent = theme === 'light' ? '☀️' : '🌙';
    }
}

// ========================================
// Animation Functions
// ========================================

/**
 * Animate a counter from 0 to target value
 * @param {HTMLElement} element - Element to animate
 * @param {number} target - Target value
 * @param {number} duration - Animation duration in ms
 * @param {string} suffix - Optional suffix (e.g., "%")
 */
function animateCounter(element, target, duration = 1000, suffix = '') {
    const start = 0;
    const startTime = performance.now();
    
    function update(currentTime) {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);
        
        // Easing function for smooth animation
        const easeOutQuart = 1 - Math.pow(1 - progress, 4);
        const current = Math.round(start + (target - start) * easeOutQuart);
        
        element.textContent = current + suffix;
        
        if (progress < 1) {
            requestAnimationFrame(update);
        }
    }
    
    requestAnimationFrame(update);
}

// ========================================
// Statistics Calculation Functions
// ========================================

/**
 * Calculate statistics for a given date range
 * @param {string[]} dates - Array of date strings
 * @returns {object} Statistics object
 */
function calculateStats(dates) {
    let totalTasks = 0;
    let totalCompleted = 0;
    let bestDay = { date: null, rate: -1 };
    let worstDay = { date: null, rate: 101 };
    let daysWithData = 0;
    
    dates.forEach(date => {
        const stats = getDateStats(date);
        
        if (stats.total > 0) {
            totalTasks += stats.total;
            totalCompleted += stats.completed;
            daysWithData++;
            
            if (stats.rate > bestDay.rate) {
                bestDay = { date, rate: stats.rate };
            }
            
            if (stats.rate < worstDay.rate) {
                worstDay = { date, rate: stats.rate };
            }
        }
    });
    
    const overallRate = totalTasks === 0 ? 0 : Math.round((totalCompleted / totalTasks) * 100);
    const avgRate = daysWithData === 0 ? 0 : Math.round(totalCompleted / daysWithData);
    
    return {
        totalTasks,
        totalCompleted,
        overallRate,
        avgRate: Math.round(overallRate),
        bestDay,
        worstDay: worstDay.date ? worstDay : { date: null, rate: 0 },
        daysWithData
    };
}

/**
 * Calculate week comparison data
 * @returns {object} Comparison data
 */
function calculateWeekComparison() {
    const thisWeekDates = getLastNDays(7);
    const lastWeekDates = [];
    
    for (let i = 13; i >= 7; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        lastWeekDates.push(date.toISOString().split('T')[0]);
    }
    
    const thisWeekStats = calculateStats(thisWeekDates);
    const lastWeekStats = calculateStats(lastWeekDates);
    
    return {
        thisWeek: thisWeekStats.overallRate,
        lastWeek: lastWeekStats.overallRate,
        difference: thisWeekStats.overallRate - lastWeekStats.overallRate
    };
}

// ========================================
// Render Functions
// ========================================

/**
 * Render streak information
 */
function renderStreak() {
    animateCounter(elements.currentStreak, streak, 800);
    animateCounter(elements.bestStreak, bestStreak, 800);
    
    // Update header streak badge
    if (typeof updateHeaderStreak === 'function') {
        updateHeaderStreak(streak);
    }
}

/**
 * Render overview statistics
 */
function renderOverview() {
    const dates = currentPeriod === 'week' ? getLastNDays(7) : getCurrentMonthDates();
    const stats = calculateStats(dates);
    
    // Update period title
    elements.periodTitle.textContent = currentPeriod === 'week' ? 'Weekly' : 'Monthly';
    
    // Animate counters
    animateCounter(elements.totalTasksStat, stats.totalTasks, 800);
    animateCounter(elements.completedStat, stats.totalCompleted, 800);
    animateCounter(elements.completionRateStat, stats.overallRate, 800);
    
    // Best day
    if (stats.bestDay.date) {
        elements.bestDayStat.textContent = getDayName(stats.bestDay.date);
        elements.bestDayRate.textContent = `${stats.bestDay.rate}% completion`;
    } else {
        elements.bestDayStat.textContent = '--';
        elements.bestDayRate.textContent = 'No data';
    }
    
    // Update highlights
    if (stats.bestDay.date) {
        elements.highlightBestDay.textContent = formatDate(stats.bestDay.date);
        elements.highlightBestRate.textContent = `${stats.bestDay.rate}%`;
    }
    
    if (stats.worstDay.date) {
        elements.highlightWorstDay.textContent = formatDate(stats.worstDay.date);
        elements.highlightWorstRate.textContent = `${stats.worstDay.rate}%`;
    }
    
    elements.highlightAvgRate.textContent = `${stats.avgRate}%`;
}

/**
 * Render the completion chart
 */
function renderChart() {
    const dates = currentPeriod === 'week' ? getLastNDays(7) : getCurrentMonthDates();
    const today = getTodayDate();
    const maxHeight = 180; // Max bar height in pixels
    
    // Find max total for scaling
    let maxTotal = 0;
    dates.forEach(date => {
        const stats = getDateStats(date);
        if (stats.total > maxTotal) maxTotal = stats.total;
    });
    
    if (maxTotal === 0) maxTotal = 1; // Prevent division by zero
    
    // Render chart bars
    elements.completionChart.innerHTML = dates.map((date, index) => {
        const stats = getDateStats(date);
        const completedHeight = stats.total === 0 ? 0 : (stats.completed / maxTotal) * maxHeight;
        const pendingHeight = stats.total === 0 ? 0 : ((stats.total - stats.completed) / maxTotal) * maxHeight;
        const isToday = date === today;
        
        return `
            <div class="chart-bar-wrapper">
                <div class="chart-bar-stack">
                    <div class="bar-tooltip">${stats.completed}/${stats.total} (${stats.rate}%)</div>
                    <div class="bar-pending" style="height: ${pendingHeight}px"></div>
                    <div class="bar-completed ${isToday ? 'today' : ''}" style="height: ${completedHeight}px"></div>
                </div>
            </div>
        `;
    }).join('');
    
    // Render X-axis labels
    elements.chartXLabels.innerHTML = dates.map(date => {
        const isToday = date === today;
        const label = currentPeriod === 'week' ? getDayName(date) : new Date(date).getDate();
        return `<span class="x-label ${isToday ? 'today' : ''}">${label}</span>`;
    }).join('');
    
    // Animate bars after a short delay
    setTimeout(() => {
        document.querySelectorAll('.bar-completed, .bar-pending').forEach(bar => {
            bar.style.opacity = '1';
        });
    }, 100);
}

/**
 * Render streak calendar
 */
function renderStreakCalendar() {
    const dates = getLastNDays(28); // Last 4 weeks
    const today = getTodayDate();
    let perfectDays = 0;
    let activeDays = 0;
    
    elements.streakCalendar.innerHTML = dates.map(date => {
        const stats = getDateStats(date);
        const isToday = date === today;
        let className = 'calendar-day';
        
        if (stats.total > 0) {
            activeDays++;
            if (stats.rate === 100) {
                className += ' completed';
                perfectDays++;
            } else if (stats.rate > 0) {
                className += ' partial';
            }
        }
        
        if (isToday) className += ' today';
        
        return `<div class="${className}" title="${formatDate(date)}: ${stats.rate}%">${new Date(date).getDate()}</div>`;
    }).join('');
    
    // Update stats
    animateCounter(elements.perfectDays, perfectDays, 600);
    animateCounter(elements.activeDays, activeDays, 600);
}

/**
 * Render week comparison
 */
function renderComparison() {
    const comparison = calculateWeekComparison();
    
    elements.thisWeekRate.textContent = `${comparison.thisWeek}%`;
    elements.lastWeekRate.textContent = `${comparison.lastWeek}%`;
    
    // Animate bars
    setTimeout(() => {
        elements.thisWeekBar.style.width = `${comparison.thisWeek}%`;
        elements.lastWeekBar.style.width = `${comparison.lastWeek}%`;
    }, 200);
    
    // Update summary message
    const summaryEl = elements.comparisonSummary;
    const diff = comparison.difference;
    
    if (diff > 0) {
        summaryEl.className = 'comparison-summary positive';
        summaryEl.innerHTML = `
            <span class="summary-icon">📈</span>
            <span class="summary-text">Great job! You're ${diff}% better than last week!</span>
        `;
    } else if (diff < 0) {
        summaryEl.className = 'comparison-summary negative';
        summaryEl.innerHTML = `
            <span class="summary-icon">💪</span>
            <span class="summary-text">Keep pushing! You were ${Math.abs(diff)}% higher last week.</span>
        `;
    } else {
        summaryEl.className = 'comparison-summary';
        summaryEl.innerHTML = `
            <span class="summary-icon">🎯</span>
            <span class="summary-text">Consistent! Same performance as last week.</span>
        `;
    }
}

/**
 * Render individual habits breakdown
 * 
 * AGGREGATION LOGIC:
 * - Habits are grouped by groupId (habits that repeat on multiple days)
 * - Standalone habits (no groupId) are treated individually
 * - For each group/standalone habit:
 *   - totalScheduledDays = number of days the habit was scheduled to appear
 *   - totalCompletedDays = number of days the habit was marked completed
 *   - completionPercentage = (totalCompletedDays / totalScheduledDays) * 100
 * 
 * This ensures each conceptual habit appears ONCE with ONE overall percentage,
 * not separate entries for each day of the week.
 */
function renderHabitsBreakdown() {
    if (habits.length === 0) {
        elements.habitsBreakdown.innerHTML = '';
        elements.breakdownEmpty.classList.add('show');
        return;
    }
    
    elements.breakdownEmpty.classList.remove('show');
    
    const dates = currentPeriod === 'week' ? getLastNDays(7) : getCurrentMonthDates();
    const today = getTodayDate();
    
    // ========================================
    // Step 1: Group habits by groupId
    // ========================================
    // Habits with the same groupId are the same conceptual habit on different days
    // Habits without groupId are standalone (appear only on one day)
    
    const habitGroups = {};
    
    habits.forEach(habit => {
        // Use groupId as key, or habit.id for standalone habits
        const groupKey = habit.groupId || `standalone_${habit.id}`;
        
        if (!habitGroups[groupKey]) {
            habitGroups[groupKey] = {
                groupId: habit.groupId,
                name: habit.name, // Use the first habit's name as the group name
                habits: [],       // All habit instances in this group
                dayIndices: []    // Which days of week this habit is scheduled
            };
        }
        
        habitGroups[groupKey].habits.push(habit);
        habitGroups[groupKey].dayIndices.push(habit.dayOfWeek);
    });
    
    // ========================================
    // Step 2: Calculate aggregated stats for each group
    // ========================================
    
    const groupStats = Object.values(habitGroups).map(group => {
        let totalScheduledDays = 0;
        let totalCompletedDays = 0;
        
        // For each date in the selected period
        dates.forEach(date => {
            // Get which day of week this date falls on (0=Sun, 6=Sat)
            const dateObj = new Date(date + 'T00:00:00');
            const dayOfWeek = dateObj.getDay();
            
            // Check if this group has a habit scheduled for this day of week
            const scheduledHabit = group.habits.find(h => h.dayOfWeek === dayOfWeek);
            
            if (!scheduledHabit) {
                // This group doesn't have a habit on this day - skip
                return;
            }
            
            // This day counts as a scheduled day
            totalScheduledDays++;
            
            // Check if it was completed
            if (date === today) {
                // Check current habit state
                if (scheduledHabit.completed) {
                    totalCompletedDays++;
                }
            } else {
                // Check history for this date
                const dayData = history[date];
                if (dayData) {
                    // Look for this habit in history by ID
                    const histHabit = dayData.find(h => h.id === scheduledHabit.id);
                    if (histHabit && histHabit.completed) {
                        totalCompletedDays++;
                    }
                    // Also check by groupId in case habit IDs changed
                    if (!histHabit && group.groupId) {
                        const histByGroup = dayData.find(h => h.groupId === group.groupId);
                        if (histByGroup && histByGroup.completed) {
                            totalCompletedDays++;
                        }
                    }
                }
            }
        });
        
        // Calculate completion percentage
        const rate = totalScheduledDays === 0 ? 0 : Math.round((totalCompletedDays / totalScheduledDays) * 100);
        
        // Get readable list of days this habit is scheduled
        const dayNames = [...new Set(group.dayIndices)]
            .sort((a, b) => a - b)
            .map(d => DAYS_OF_WEEK[d])
            .join(', ');
        
        return {
            name: group.name,
            groupId: group.groupId,
            completedCount: totalCompletedDays,
            totalCount: totalScheduledDays,
            rate: rate,
            scheduledDays: dayNames,
            isGrouped: group.habits.length > 1
        };
    });
    
    // ========================================
    // Step 3: Sort by completion rate and render
    // ========================================
    
    groupStats.sort((a, b) => b.rate - a.rate);
    
    elements.habitsBreakdown.innerHTML = groupStats.map(stat => {
        // Show day indicator for grouped habits
        const daysBadge = stat.isGrouped 
            ? `<span class="breakdown-days-badge" title="Scheduled on: ${stat.scheduledDays}">📅 ${stat.scheduledDays}</span>`
            : '';
        
        return `
            <div class="breakdown-item">
                <div class="breakdown-icon">📌</div>
                <div class="breakdown-info">
                    <div class="breakdown-name">${escapeHtml(stat.name)}</div>
                    <div class="breakdown-meta">
                        ${stat.completedCount}/${stat.totalCount} days completed
                        ${daysBadge}
                    </div>
                </div>
                <div class="breakdown-progress">
                    <div class="breakdown-bar">
                        <div class="breakdown-fill" style="width: ${stat.rate}%"></div>
                    </div>
                    <div class="breakdown-rate">${stat.rate}%</div>
                </div>
            </div>
        `;
    }).join('');
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
 * Main render function
 */
function render() {
    renderStreak();
    renderOverview();
    renderChart();
    renderStreakCalendar();
    renderComparison();
    renderHabitsBreakdown();
}

// ========================================
// Event Listeners
// ========================================

/**
 * Initialize event listeners
 */
function initEventListeners() {
    // Period tabs
    elements.periodTabs.forEach(tab => {
        tab.addEventListener('click', () => {
            elements.periodTabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            currentPeriod = tab.dataset.period;
            render();
        });
    });
    
    // Theme toggle
    if (elements.themeToggle) {
        elements.themeToggle.addEventListener('click', () => {
            const currentTheme = document.documentElement.getAttribute('data-theme');
            const newTheme = currentTheme === 'light' ? 'dark' : 'light';
            
            document.documentElement.setAttribute('data-theme', newTheme);
            localStorage.setItem(STORAGE_KEYS.THEME, newTheme);
            updateThemeIcon(newTheme);
        });
    }
}

// ========================================
// Initialization
// ========================================

/**
 * Initialize UI (called on DOMContentLoaded)
 */
function init() {
    loadTheme();
    initEventListeners();
    // Data loading happens via initStatsData() after auth
    console.log('📊 Statistics page UI initialized, waiting for auth...');
}

/**
 * Initialize stats data (called from stats.html after auth confirmed)
 * This ensures data is loaded ONLY for authenticated users
 */
window.initStatsData = async function() {
    console.log('🔐 User authenticated, loading stats data...');
    await loadFromFirestore();
};

// Start when DOM is ready
document.addEventListener('DOMContentLoaded', init);
