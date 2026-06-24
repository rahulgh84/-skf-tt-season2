# Firebase Setup for Live Online Scores

Use this version when everyone should see the same scorecard online.

## 1. Create Firebase project
1. Go to https://console.firebase.google.com/
2. Click **Add project**
3. Name it `skf-tt-season2`
4. You can disable Google Analytics
5. Click **Create project**

## 2. Create Firestore database
1. In Firebase, go to **Build > Firestore Database**
2. Click **Create database**
3. Choose **Start in production mode**
4. Select any nearby region
5. Create database

## 3. Add these Firestore rules
Go to **Firestore Database > Rules** and replace rules with:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /tournaments/{tournamentId} {
      allow read: if true;
      allow write: if true;
    }
  }
}
```

This allows your public website to read and update scores. Your website still has a manager password, but this is not high-security. For a community tournament, it is usually okay. For stronger security, use Firebase Authentication.

## 4. Get Firebase web config
1. Go to **Project settings**
2. Under **Your apps**, click the Web icon `</>`
3. App nickname: `SKF TT Website`
4. Register app
5. Copy the `firebaseConfig` values

## 5. Update this file
Open:

`assets/firebase-config.js`

Replace the placeholder values with your Firebase config.

## 6. Upload to GitHub
Upload all files to your GitHub repository and enable GitHub Pages.

Your public site will be:

`https://YOUR-GITHUB-USERNAME.github.io/skf-tt-season2/`

Manager password:

`skf2026`
