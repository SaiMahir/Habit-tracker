# Firebase Security Rules - IMPORTANT!

## Deploy These Rules to Fix the Cross-Account Data Bug

The cross-account data sharing issue has been fixed in the code by using Firestore with user-scoped paths. However, you **MUST** also deploy these security rules to your Firebase Console to ensure server-side enforcement.

## How to Deploy:

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project: **habit-tracker-a34d0**
3. In the left sidebar, click **Firestore Database**
4. Click the **Rules** tab
5. Replace the existing rules with the rules below
6. Click **Publish**

## Security Rules to Deploy (Enhanced with Data Validation):

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Users can only read/write their own data
    match /users/{userId} {
      // User profile document
      allow read: if isOwner(userId);
      allow write: if isOwner(userId) && validateUserProfile();
      
      // Habits collection
      match /habits/{habitId} {
        allow read: if isOwner(userId);
        allow create: if isOwner(userId) && validateHabit();
        allow update: if isOwner(userId) && validateHabit();
        allow delete: if isOwner(userId);
      }
      
      // History collection (daily completion logs)
      match /history/{date} {
        allow read: if isOwner(userId);
        allow write: if isOwner(userId) && validateHistory();
      }
      
      // Stats document
      match /stats/{statId} {
        allow read: if isOwner(userId);
        allow write: if isOwner(userId) && validateStats();
      }
    }
    
    // Helper function: Check if user owns this data
    function isOwner(userId) {
      return request.auth != null && request.auth.uid == userId;
    }
    
    // Validate user profile document
    function validateUserProfile() {
      let data = request.resource.data;
      return data.keys().hasOnly(['displayName', 'email', 'photoURL', 'createdAt', 'lastLogin', 'emailVerified', 'preferences'])
        && (data.displayName is string && data.displayName.size() <= 100 || !('displayName' in data))
        && (data.email is string || !('email' in data));
    }
    
    // Validate habit document structure
    function validateHabit() {
      let data = request.resource.data;
      let allowedKeys = ['id', 'groupId', 'dayOfWeek', 'name', 'time', 'description', 'completed', 'createdAt', 'updatedAt', 'userId'];
      return data.keys().hasOnly(allowedKeys)
        && data.name is string 
        && data.name.size() >= 1 
        && data.name.size() <= 100
        && (!('description' in data) || (data.description is string && data.description.size() <= 500))
        && (!('time' in data) || data.time is string)
        && (!('completed' in data) || data.completed is bool);
    }
    
    // Validate history document structure
    function validateHistory() {
      let data = request.resource.data;
      return data.date is string || data.habits is list || data.completedAt is timestamp;
    }
    
    // Validate stats document structure  
    function validateStats() {
      let data = request.resource.data;
      return (!('streak' in data) || data.streak is int)
        && (!('bestStreak' in data) || data.bestStreak is int)
        && (!('totalCompleted' in data) || data.totalCompleted is int);
    }
    
    // Deny all other access
    match /{document=**} {
      allow read, write: if false;
    }
  }
}
```

## Basic Rules (Alternative - Less Strict):

If you have issues with the enhanced rules, use this simpler version:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Users can only read/write their own data
    match /users/{userId}/{document=**} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
    
    // Deny all other access
    match /{document=**} {
      allow read, write: if false;
    }
  }
}
```

## What These Rules Do:

1. **`request.auth != null`** - User must be logged in
2. **`request.auth.uid == userId`** - User can only access paths where the `{userId}` matches their own Firebase Auth UID
3. **Data Validation** - Habit names limited to 100 chars, descriptions to 500 chars, proper field types enforced
4. **Deny all other access** - Any path not under `/users/{userId}/` is blocked

## Data Structure:

```
/users/{userId}/
    /habits/{habitId}     - Individual habit documents
    /history/{date}       - Daily completion logs (e.g., "2025-01-08")
    /stats/current        - User statistics (streak, bestStreak, lastDate)
```

## Additional Security Recommendations:

### 1. Enable Firebase App Check
Go to Firebase Console → App Check → Register your app to prevent API abuse.

### 2. Restrict API Key in Google Cloud Console
1. Go to: https://console.cloud.google.com/apis/credentials
2. Click on your API key
3. Under "Application restrictions", select "HTTP referrers"
4. Add your production domain(s)
5. Under "API restrictions", restrict to Firebase APIs only

### 3. Monitor Usage
Enable Firebase Monitoring and set up alerts for unusual activity patterns.

## Why This Was Needed:

The previous implementation used `localStorage` which stores data in the browser. This caused a critical bug:
- localStorage is tied to the browser, NOT to the user
- All users logging in on the same browser saw the same habits
- Data was not actually stored in Firebase, just locally

The fix:
1. Moved all data to Firestore with user-scoped paths (`users/{uid}/...`)
2. Data is now loaded ONLY after authentication confirms the user
3. Security rules prevent any cross-user data access at the server level
4. Data validation prevents malicious payload injection

## Testing the Fix:

1. Log in as User A → Create some habits → Log out
2. Log in as User B → Should see empty habit list (fresh start)
3. Create habits as User B → Log out
4. Log back in as User A → Should see only User A's habits
5. Log back in as User B → Should see only User B's habits

## Migration Note:

The first time each user logs in after this update, any existing localStorage data will be automatically migrated to their Firestore account. This is a one-time migration.
