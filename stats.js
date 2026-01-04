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
// Constants & Configuration
// ========================================

const STORAGE_KEYS = {
    THEME: 'habitTracker_theme' // Theme stays in localStorage (not sensitive)
};

const DAYS_OF_WEEK = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const FULL_MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

// ========================================
// State Management
// ========================================

let habits = [];
let history = {};
let streak = 0;
let bestStreak = 0;
let currentPeriod = 'week';
let isDataLoaded = false;

// Calendar month state - initialized to current month
let calendarMonth = new Date().getMonth();  // 0-11
let calendarYear = new Date().getFullYear();
let isCalendarLoading = false;
let monthHistoryCache = {}; // Cache for month-specific history data

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
    
    // Streak calendar & navigation
    streakCalendar: document.getElementById('streak-calendar'),
    perfectDays: document.getElementById('perfect-days'),
    activeDays: document.getElementById('active-days'),
    monthCompletionRate: document.getElementById('month-completion-rate'),
    prevMonthBtn: document.getElementById('prev-month-btn'),
    nextMonthBtn: document.getElementById('next-month-btn'),
    calendarMonthLabel: document.getElementById('calendar-month-label'),
    calendarLoading: document.getElementById('calendar-loading'),
    
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
    const log = getLogger();
    if (!window.FirebaseDB) {
        log.error('FirebaseDB not loaded');
        return;
    }
    
    const userId = window.FirebaseDB.getCurrentUserId();
    if (!userId) {
        log.warn('No authenticated user, cannot load stats');
        return;
    }
    
    log.debug('Loading statistics data');
    
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
        log.info('Statistics data loaded');
        
        // Render the UI
        render();
    } catch (error) {
        log.error('Error loading statistics', error);
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

// ========================================
// Line Chart Rendering
// ========================================

/**
 * Generate a smooth curve path using Catmull-Rom spline interpolation
 * This creates natural-looking curves through all data points
 * 
 * @param {Array} points - Array of {x, y} coordinates
 * @param {number} tension - Curve tension (0 = sharp, 1 = very smooth)
 * @returns {string} SVG path data string
 */
function generateSmoothPath(points, tension = 0.3) {
    if (points.length < 2) return '';
    if (points.length === 2) {
        return `M ${points[0].x},${points[0].y} L ${points[1].x},${points[1].y}`;
    }
    
    let path = `M ${points[0].x},${points[0].y}`;
    
    for (let i = 0; i < points.length - 1; i++) {
        const p0 = points[Math.max(0, i - 1)];
        const p1 = points[i];
        const p2 = points[i + 1];
        const p3 = points[Math.min(points.length - 1, i + 2)];
        
        // Calculate control points using Catmull-Rom to Bezier conversion
        const cp1x = p1.x + (p2.x - p0.x) * tension;
        const cp1y = p1.y + (p2.y - p0.y) * tension;
        const cp2x = p2.x - (p3.x - p1.x) * tension;
        const cp2y = p2.y - (p3.y - p1.y) * tension;
        
        path += ` C ${cp1x},${cp1y} ${cp2x},${cp2y} ${p2.x},${p2.y}`;
    }
    
    return path;
}

/**
 * Generate the area path (for gradient fill under the line)
 * Closes the path at the bottom of the chart
 * 
 * @param {Array} points - Array of {x, y} coordinates
 * @param {number} height - Chart height for bottom edge
 * @param {number} tension - Curve tension
 * @returns {string} SVG path data string
 */
function generateAreaPath(points, height, tension = 0.3) {
    if (points.length < 2) return '';
    
    const linePath = generateSmoothPath(points, tension);
    const lastPoint = points[points.length - 1];
    const firstPoint = points[0];
    
    // Close the path: go down to bottom, across, and back up
    return `${linePath} L ${lastPoint.x},${height} L ${firstPoint.x},${height} Z`;
}

/**
 * Render the completion line chart
 * 
 * HOW IT WORKS:
 * 1. Fetches date range based on current period (week/month)
 * 2. Calculates completion percentage for each day
 * 3. Converts percentages to SVG coordinates
 * 4. Generates smooth curved path through all points
 * 5. Renders data points with visual states (completed/pending/no-data)
 * 6. Animates the line drawing using stroke-dasharray technique
 * 
 * TO UPDATE DATA: Just call renderChart() after data changes
 */
function renderChart() {
    const dates = currentPeriod === 'week' ? getLastNDays(7) : getCurrentMonthDates();
    const today = getTodayDate();
    
    // SVG dimensions
    const svgWidth = 600;
    const svgHeight = 200;
    const padding = { top: 20, right: 30, bottom: 10, left: 30 };
    const chartWidth = svgWidth - padding.left - padding.right;
    const chartHeight = svgHeight - padding.top - padding.bottom;
    
    // Get SVG elements
    const svgLine = document.getElementById('chart-line');
    const svgArea = document.getElementById('chart-area');
    const svgPoints = document.getElementById('chart-points');
    const svgGrid = document.getElementById('chart-grid');
    const tooltip = document.getElementById('chart-tooltip');
    
    if (!svgLine || !svgArea || !svgPoints) {
        getLogger().error('Line chart SVG elements not found');
        return;
    }
    
    // Calculate data points
    const dataPoints = dates.map((date, index) => {
        const stats = getDateStats(date);
        return {
            date,
            stats,
            isToday: date === today,
            isFuture: date > today,
            // X position: evenly distributed across chart width
            x: padding.left + (index / Math.max(1, dates.length - 1)) * chartWidth,
            // Y position: inverted (0% at bottom, 100% at top)
            y: padding.top + chartHeight - (stats.rate / 100) * chartHeight
        };
    });
    
    // Handle single data point case
    if (dataPoints.length === 1) {
        dataPoints[0].x = svgWidth / 2;
    }
    
    // Render grid lines (horizontal lines at 25%, 50%, 75%, 100%)
    const gridLines = [0, 25, 50, 75, 100].map(percent => {
        const y = padding.top + chartHeight - (percent / 100) * chartHeight;
        return `<line x1="${padding.left}" y1="${y}" x2="${svgWidth - padding.right}" y2="${y}" 
                       class="grid-line" stroke="var(--border-color)" stroke-opacity="0.3" stroke-dasharray="4,4"/>
                <text x="${padding.left - 8}" y="${y + 4}" class="grid-label" 
                      fill="var(--text-muted)" font-size="10" text-anchor="end">${percent}%</text>`;
    }).join('');
    svgGrid.innerHTML = gridLines;
    
    // Generate the smooth curve path
    const linePath = generateSmoothPath(dataPoints, 0.25);
    const areaPath = generateAreaPath(dataPoints, svgHeight - padding.bottom, 0.25);
    
    // Set paths
    svgLine.setAttribute('d', linePath);
    svgArea.setAttribute('d', areaPath);
    
    // Calculate path length for animation
    const pathLength = svgLine.getTotalLength ? svgLine.getTotalLength() : 1000;
    
    // Set up line animation (draw effect)
    svgLine.style.strokeDasharray = pathLength;
    svgLine.style.strokeDashoffset = pathLength;
    
    // Set up area animation (fade in)
    svgArea.style.opacity = '0';
    
    // Render data points with different states
    const pointsHTML = dataPoints.map((point, index) => {
        let pointClass = 'chart-point';
        let innerClass = 'point-inner';
        
        if (point.isFuture) {
            pointClass += ' future';
        } else if (point.stats.total === 0) {
            pointClass += ' no-data';
        } else if (point.stats.rate === 100) {
            pointClass += ' completed';
        } else if (point.stats.rate > 0) {
            pointClass += ' partial';
        } else {
            pointClass += ' missed';
        }
        
        if (point.isToday) {
            pointClass += ' today';
        }
        
        // Create point with outer ring and inner dot
        return `
            <g class="${pointClass}" data-index="${index}" data-date="${point.date}">
                <circle class="point-outer" cx="${point.x}" cy="${point.y}" r="12" fill="transparent"/>
                <circle class="point-ring" cx="${point.x}" cy="${point.y}" r="8" fill="none" stroke-width="2"/>
                <circle class="${innerClass}" cx="${point.x}" cy="${point.y}" r="5"/>
            </g>
        `;
    }).join('');
    
    svgPoints.innerHTML = pointsHTML;
    
    // Add hover interactions for tooltips
    svgPoints.querySelectorAll('.chart-point').forEach(point => {
        point.addEventListener('mouseenter', (e) => {
            const index = parseInt(point.dataset.index);
            const data = dataPoints[index];
            
            tooltip.innerHTML = `
                <div class="tooltip-date">${formatDate(data.date)}</div>
                <div class="tooltip-stats">${data.stats.completed}/${data.stats.total} completed</div>
                <div class="tooltip-rate">${data.stats.rate}%</div>
            `;
            tooltip.classList.add('visible');
            
            // Position tooltip near the point
            const svgRect = document.getElementById('line-chart-svg').getBoundingClientRect();
            const pointX = (data.x / svgWidth) * svgRect.width;
            const pointY = (data.y / svgHeight) * svgRect.height;
            
            tooltip.style.left = `${pointX}px`;
            tooltip.style.top = `${pointY - 60}px`;
        });
        
        point.addEventListener('mouseleave', () => {
            tooltip.classList.remove('visible');
        });
    });
    
    // Render X-axis labels
    elements.chartXLabels.innerHTML = dates.map((date, index) => {
        const isToday = date === today;
        const label = currentPeriod === 'week' ? getDayName(date) : new Date(date).getDate();
        return `<span class="x-label ${isToday ? 'today' : ''}">${label}</span>`;
    }).join('');
    
    // Trigger animations after a short delay
    requestAnimationFrame(() => {
        // Animate line drawing
        svgLine.style.transition = 'stroke-dashoffset 1.2s ease-out';
        svgLine.style.strokeDashoffset = '0';
        
        // Animate area fade in
        svgArea.style.transition = 'opacity 0.8s ease-out 0.4s';
        svgArea.style.opacity = '1';
        
        // Animate points appearing (staggered)
        svgPoints.querySelectorAll('.chart-point').forEach((point, i) => {
            point.style.opacity = '0';
            point.style.transform = 'scale(0)';
            setTimeout(() => {
                point.style.transition = 'opacity 0.3s ease-out, transform 0.3s ease-out';
                point.style.opacity = '1';
                point.style.transform = 'scale(1)';
            }, 800 + i * 80);
        });
    });
}

// ========================================
// Calendar Month Navigation
// ========================================

/**
 * Get the number of days in a given month
 * Correctly handles leap years
 * @param {number} year - Full year (e.g., 2026)
 * @param {number} month - Month index (0-11)
 * @returns {number} Number of days in the month
 */
function getDaysInMonth(year, month) {
    // new Date(year, month + 1, 0) gives the last day of the month
    return new Date(year, month + 1, 0).getDate();
}

/**
 * Get the day of week for the first day of a month
 * @param {number} year - Full year
 * @param {number} month - Month index (0-11)
 * @returns {number} Day of week (0 = Sunday, 6 = Saturday)
 */
function getFirstDayOfMonth(year, month) {
    return new Date(year, month, 1).getDay();
}

/**
 * Generate array of date strings for a specific month
 * @param {number} year - Full year
 * @param {number} month - Month index (0-11)
 * @returns {string[]} Array of date strings in YYYY-MM-DD format
 */
function getMonthDates(year, month) {
    const daysInMonth = getDaysInMonth(year, month);
    const dates = [];
    
    for (let day = 1; day <= daysInMonth; day++) {
        const date = new Date(year, month, day);
        dates.push(date.toISOString().split('T')[0]);
    }
    
    return dates;
}

/**
 * Create a cache key for month history
 * @param {number} year - Full year
 * @param {number} month - Month index (0-11)
 * @returns {string} Cache key
 */
function getMonthCacheKey(year, month) {
    return `${year}-${String(month + 1).padStart(2, '0')}`;
}

/**
 * Check if a given month/year is in the future
 * @param {number} year - Full year
 * @param {number} month - Month index (0-11)
 * @returns {boolean} True if the month is in the future
 */
function isFutureMonth(year, month) {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();
    
    return year > currentYear || (year === currentYear && month > currentMonth);
}

/**
 * Update the month label display
 */
function updateCalendarMonthLabel() {
    if (elements.calendarMonthLabel) {
        elements.calendarMonthLabel.textContent = `${FULL_MONTHS[calendarMonth]} ${calendarYear}`;
    }
}

/**
 * Update navigation button states (disable future months)
 */
function updateNavigationButtons() {
    // Disable next button if next month would be in the future
    const nextMonth = calendarMonth === 11 ? 0 : calendarMonth + 1;
    const nextYear = calendarMonth === 11 ? calendarYear + 1 : calendarYear;
    
    if (elements.nextMonthBtn) {
        const isNextFuture = isFutureMonth(nextYear, nextMonth);
        elements.nextMonthBtn.disabled = isNextFuture;
        elements.nextMonthBtn.classList.toggle('disabled', isNextFuture);
    }
}

/**
 * Show/hide calendar loading state
 * @param {boolean} loading - Whether to show loading state
 */
function setCalendarLoading(loading) {
    isCalendarLoading = loading;
    
    if (elements.calendarLoading) {
        elements.calendarLoading.style.display = loading ? 'flex' : 'none';
    }
    
    if (elements.streakCalendar) {
        elements.streakCalendar.classList.toggle('loading', loading);
    }
    
    // Disable navigation while loading
    if (elements.prevMonthBtn) {
        elements.prevMonthBtn.disabled = loading;
    }
    if (elements.nextMonthBtn) {
        elements.nextMonthBtn.disabled = loading;
    }
}

/**
 * Load history data for a specific month from Firebase
 * Uses caching to avoid redundant requests
 * 
 * @param {number} year - Full year
 * @param {number} month - Month index (0-11)
 * @returns {Promise<object>} History object keyed by date for the month
 */
async function loadMonthHistory(year, month) {
    const log = getLogger();
    const cacheKey = getMonthCacheKey(year, month);
    
    // Check cache first
    if (monthHistoryCache[cacheKey]) {
        log.debug(`Using cached history for ${cacheKey}`);
        return monthHistoryCache[cacheKey];
    }
    
    // Get Firebase auth
    const auth = window.firebaseAuth;
    if (!auth || !auth.currentUser) {
        log.error('Cannot load month history: No authenticated user');
        return {};
    }
    
    const userId = auth.currentUser.uid;
    
    try {
        const { collection, query, where, getDocs, orderBy } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js');
        const db = window.firebaseDb;
        
        if (!db) {
            log.error('Firestore not initialized');
            return {};
        }
        
        // Generate date range for the month
        const startDate = `${year}-${String(month + 1).padStart(2, '0')}-01`;
        const endDate = `${year}-${String(month + 1).padStart(2, '0')}-${getDaysInMonth(year, month)}`;
        
        log.debug(`Loading history for ${startDate} to ${endDate}`);
        
        // Query Firestore for history documents within the month
        // Path: users/{userId}/history where document ID is date (YYYY-MM-DD)
        const historyRef = collection(db, 'users', userId, 'history');
        const snapshot = await getDocs(historyRef);
        
        const monthHistory = {};
        snapshot.forEach(doc => {
            const docDate = doc.id; // Document ID is the date string
            // Filter to only include dates within our target month
            if (docDate >= startDate && docDate <= endDate) {
                const data = doc.data();
                if (!data.userId || data.userId === userId) {
                    monthHistory[docDate] = data.habits || [];
                }
            }
        });
        
        // Cache the result
        monthHistoryCache[cacheKey] = monthHistory;
        log.dbOperation('load', `history-${cacheKey}`, Object.keys(monthHistory).length);
        
        return monthHistory;
        
    } catch (error) {
        log.error(`Error loading month history for ${cacheKey}`, error);
        return {};
    }
}

/**
 * Get completion stats for a specific date using month-specific history
 * @param {string} date - Date string (YYYY-MM-DD)
 * @param {object} monthHistory - History data for the month
 * @returns {object} Object with total, completed, and rate
 */
function getDateStatsFromHistory(date, monthHistory) {
    const today = getTodayDate();
    
    // For today, use current habits state
    if (date === today) {
        const total = habits.length;
        const completed = habits.filter(h => h.completed).length;
        return {
            total,
            completed,
            rate: total === 0 ? 0 : Math.round((completed / total) * 100)
        };
    }
    
    // For other dates, check the provided history
    const dayHistory = monthHistory[date] || [];
    const total = dayHistory.length;
    const completed = dayHistory.filter(h => h.completed).length;
    
    return {
        total,
        completed,
        rate: total === 0 ? 0 : Math.round((completed / total) * 100)
    };
}

/**
 * Navigate to previous month
 */
async function goToPreviousMonth() {
    if (isCalendarLoading) return;
    
    calendarMonth--;
    if (calendarMonth < 0) {
        calendarMonth = 11;
        calendarYear--;
    }
    
    await renderStreakCalendar();
}

/**
 * Navigate to next month
 */
async function goToNextMonth() {
    if (isCalendarLoading) return;
    
    // Check if next month would be in the future
    const nextMonth = calendarMonth + 1;
    const nextYear = nextMonth > 11 ? calendarYear + 1 : calendarYear;
    const normalizedMonth = nextMonth > 11 ? 0 : nextMonth;
    
    if (isFutureMonth(nextYear, normalizedMonth)) {
        return; // Don't navigate to future months
    }
    
    calendarMonth++;
    if (calendarMonth > 11) {
        calendarMonth = 0;
        calendarYear++;
    }
    
    await renderStreakCalendar();
}

/**
 * Render streak calendar for the currently selected month
 * Shows a proper monthly calendar with correct day alignment
 */
async function renderStreakCalendar() {
    const log = getLogger();
    
    // Show loading state
    setCalendarLoading(true);
    updateCalendarMonthLabel();
    
    try {
        // Load history for the selected month
        const monthHistory = await loadMonthHistory(calendarYear, calendarMonth);
        
        // Also merge in global history if it contains data for this month
        // (for the current month, live data might be more up-to-date)
        const cacheKey = getMonthCacheKey(calendarYear, calendarMonth);
        Object.keys(history).forEach(date => {
            if (date.startsWith(`${calendarYear}-${String(calendarMonth + 1).padStart(2, '0')}`)) {
                monthHistory[date] = history[date];
            }
        });
        
        const today = getTodayDate();
        const daysInMonth = getDaysInMonth(calendarYear, calendarMonth);
        const firstDayOfWeek = getFirstDayOfMonth(calendarYear, calendarMonth);
        
        let perfectDays = 0;
        let activeDays = 0;
        let totalCompletions = 0;
        let totalTasks = 0;
        
        // Build calendar HTML
        let calendarHTML = '';
        
        // Add empty cells for days before the first day of the month
        for (let i = 0; i < firstDayOfWeek; i++) {
            calendarHTML += '<div class="calendar-day empty"></div>';
        }
        
        // Add cells for each day of the month
        for (let day = 1; day <= daysInMonth; day++) {
            const dateStr = `${calendarYear}-${String(calendarMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            const stats = getDateStatsFromHistory(dateStr, monthHistory);
            const isToday = dateStr === today;
            const isFuture = dateStr > today;
            
            let className = 'calendar-day';
            
            if (isFuture) {
                // Future days - no status
                className += ' future';
            } else if (stats.total > 0) {
                activeDays++;
                totalTasks += stats.total;
                totalCompletions += stats.completed;
                
                if (stats.rate === 100) {
                    className += ' completed';
                    perfectDays++;
                } else if (stats.rate > 0) {
                    className += ' partial';
                } else {
                    className += ' missed';
                }
            }
            
            if (isToday) className += ' today';
            
            const tooltipText = isFuture 
                ? `${formatDate(dateStr)}: Future` 
                : `${formatDate(dateStr)}: ${stats.rate}% (${stats.completed}/${stats.total})`;
            
            calendarHTML += `<div class="${className}" title="${tooltipText}">${day}</div>`;
        }
        
        // Render the calendar
        elements.streakCalendar.innerHTML = calendarHTML;
        
        // Calculate and update stats
        const monthCompletionRate = totalTasks > 0 
            ? Math.round((totalCompletions / totalTasks) * 100) 
            : 0;
        
        animateCounter(elements.perfectDays, perfectDays, 600);
        animateCounter(elements.activeDays, activeDays, 600);
        
        if (elements.monthCompletionRate) {
            elements.monthCompletionRate.textContent = `${monthCompletionRate}%`;
        }
        
        // Update navigation buttons
        updateNavigationButtons();
        
        log.debug(`Calendar rendered for ${FULL_MONTHS[calendarMonth]} ${calendarYear}: ${perfectDays} perfect, ${activeDays} active, ${monthCompletionRate}% rate`);
        
    } catch (error) {
        log.error('Error rendering streak calendar', error);
        elements.streakCalendar.innerHTML = '<div class="calendar-error">Error loading calendar data</div>';
    } finally {
        setCalendarLoading(false);
    }
}

/**
 * Initialize calendar navigation event listeners
 */
function initCalendarNavigation() {
    if (elements.prevMonthBtn) {
        elements.prevMonthBtn.addEventListener('click', goToPreviousMonth);
    }
    
    if (elements.nextMonthBtn) {
        elements.nextMonthBtn.addEventListener('click', goToNextMonth);
    }
    
    // Initialize to current month
    const now = new Date();
    calendarMonth = now.getMonth();
    calendarYear = now.getFullYear();
    
    updateCalendarMonthLabel();
    updateNavigationButtons();
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
    
    // Calendar month navigation
    initCalendarNavigation();
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
    getLogger().debug('Statistics page UI initialized, waiting for auth');
}

/**
 * Initialize stats data (called from stats.html after auth confirmed)
 * This ensures data is loaded ONLY for authenticated users
 */
window.initStatsData = async function() {
    getLogger().debug('User authenticated, loading stats data');
    await loadFromFirestore();
};

// Start when DOM is ready
document.addEventListener('DOMContentLoaded', init);
