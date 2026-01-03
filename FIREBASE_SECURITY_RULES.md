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

## Security Rules to Deploy:

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
3. **Deny all other access** - Any path not under `/users/{userId}/` is blocked

## Data Structure:

```
/users/{userId}/
    /habits/{habitId}     - Individual habit documents
    /history/{date}       - Daily completion logs (e.g., "2025-01-08")
    /stats/current        - User statistics (streak, bestStreak, lastDate)
```

## Why This Was Needed:

The previous implementation used `localStorage` which stores data in the browser. This caused a critical bug:
- localStorage is tied to the browser, NOT to the user
- All users logging in on the same browser saw the same habits
- Data was not actually stored in Firebase, just locally

The fix:
1. Moved all data to Firestore with user-scoped paths (`users/{uid}/...`)
2. Data is now loaded ONLY after authentication confirms the user
3. Security rules prevent any cross-user data access at the server level

## Testing the Fix:

1. Log in as User A → Create some habits → Log out
2. Log in as User B → Should see empty habit list (fresh start)
3. Create habits as User B → Log out
4. Log back in as User A → Should see only User A's habits
5. Log back in as User B → Should see only User B's habits

## Migration Note:

The first time each user logs in after this update, any existing localStorage data will be automatically migrated to their Firestore account. This is a one-time migration.
