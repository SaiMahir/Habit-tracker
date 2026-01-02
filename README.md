# 🎯 Habit Tracker

A modern, feature-rich habit tracking web application built with vanilla HTML, CSS, and JavaScript.

![Habit Tracker Preview](https://via.placeholder.com/800x400?text=Habit+Tracker+Preview)

## ✨ Features

### Core Features
- ➕ **Add Daily Habits** - Create habits with name, time, and optional description
- ✅ **Track Completion** - Mark habits as complete with smooth checkbox animations
- 📊 **Progress Tracking** - Animated progress bar showing daily completion percentage
- 📈 **Statistics Dashboard** - View total, completed, pending habits and success rate
- 💾 **Data Persistence** - All data saved to localStorage (survives page refresh)
- 🔄 **Daily Reset** - Habits automatically reset at midnight while preserving history

### Bonus Features
- 🔥 **Streak Counter** - Track consecutive days of 100% completion
- ✏️ **Edit & Delete** - Modify or remove habits anytime
- 🔍 **Filter View** - Filter habits by All/Pending/Completed status
- 📉 **Weekly Chart** - Visual overview of the last 7 days' progress

### UI/UX Features
- 🎨 **Modern Design** - Clean, minimal interface with soft pastel colors
- ✨ **Smooth Animations** - Hover effects, progress bar animation, checkbox transitions
- 📱 **Fully Responsive** - Works beautifully on mobile, tablet, and desktop
- 🌟 **Polished Experience** - Icons, gradients, and micro-interactions throughout

## 🚀 Getting Started

### Option 1: Open Directly
Simply double-click the `index.html` file to open it in your default browser.

### Option 2: Use Live Server (Recommended)
For the best development experience:

1. **VS Code Users:**
   - Install the "Live Server" extension
   - Right-click on `index.html`
   - Select "Open with Live Server"

2. **Using Python:**
   ```bash
   # Python 3
   python -m http.server 8000
   
   # Then open http://localhost:8000 in your browser
   ```

3. **Using Node.js:**
   ```bash
   # Install http-server globally
   npm install -g http-server
   
   # Run in project directory
   http-server
   
   # Open http://localhost:8080 in your browser
   ```

## 📁 Project Structure

```
habit-tracker/
├── index.html      # Main HTML structure
├── styles.css      # All styles and animations
├── script.js       # Application logic
└── README.md       # This file
```

## 🛠️ Technical Details

### Technologies Used
- **HTML5** - Semantic markup
- **CSS3** - Flexbox, Grid, CSS Variables, Animations
- **JavaScript (ES6+)** - No external libraries or frameworks

### Browser Support
- Chrome (recommended)
- Firefox
- Safari
- Edge

### Data Storage
All data is stored in the browser's localStorage:
- `habitTracker_habits` - Current habits list
- `habitTracker_history` - Historical completion data
- `habitTracker_streak` - Current streak count
- `habitTracker_lastDate` - Last active date (for midnight reset)

## 📖 Usage Guide

### Adding a Habit
1. Enter the habit name (required)
2. Select the time (required)
3. Add an optional description
4. Click "Add Habit"

### Completing a Habit
Click the checkbox next to any habit to mark it as complete. The progress bar and stats will update automatically.

### Editing a Habit
Click the ✏️ (pencil) icon to open the edit modal. Make your changes and click "Save Changes".

### Deleting a Habit
Click the 🗑️ (trash) icon and confirm the deletion.

### Filtering Habits
Use the filter buttons (All / Pending / Completed) to view specific habits.

## 🎨 Customization

### Changing Colors
Edit the CSS variables in `styles.css` under `:root`:

```css
:root {
    --primary-color: #6366f1;    /* Main accent color */
    --success-color: #10b981;    /* Completed items */
    --bg-primary: #f8fafc;       /* Background color */
    /* ... more variables */
}
```

### Dark Mode
To enable dark mode, you can swap the color values:
- Change `--bg-primary` to a dark color like `#1a1a2e`
- Change `--text-primary` to a light color like `#ffffff`
- Adjust other colors accordingly

## 🤝 Contributing

Feel free to fork this project and make improvements! Some ideas:
- Add dark mode toggle
- Implement habit categories/tags
- Add data export/import feature
- Add reminder notifications
- Create monthly/yearly views

## 📄 License

This project is open source and available under the MIT License.

---

Built with ❤️ for building better habits, one day at a time 💪
