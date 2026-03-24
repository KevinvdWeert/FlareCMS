# FlareCMS

A lightweight Content Management System built with React (Vite) and Firebase.

## Features
- Public website with dynamic page routing (`/:slug`).
- Private admin dashboard (`/admin`).
- Block-based editor (Headings, Paragraphs, Images with Firebase Storage).
- Role-based access control (Admin, Editor) via Firebase custom profile docs.
- Secure Firebase rules protecting your data.

## Getting Started

### 1. Firebase Setup
1. Create a [Firebase Project](https://console.firebase.google.com/).
2. Enable **Firestore**, **Authentication** (Email/Password), and **Storage**.
3. Copy your Firebase config variables.
4. Duplicate `apps/web/.env.example` to `apps/web/.env` and paste your config variables:
   ```env
   VITE_FIREBASE_API_KEY=your_value
   ...
   ```

### 2. Install & Run
Run the development server natively:
```bash
cd apps/web
npm install
npm run dev
```

### 3. Deploying Firebase Rules
If you have `firebase-tools` installed globally, you can deploy the security rules:
```bash
firebase init
firebase deploy --only firestore,storage
```

(Or configure them manually in the Firebase console matching `firebase/firestore.rules` and `firebase/storage.rules`).

### 4. Bootstrapping the First Admin
To manage users, you need at least one `admin` user.
1. Sign up on the web app (by attempting to sign in, or simply creating an account via Firebase Console / custom code that registers but since signup wasn't fully fleshed out in the UI, you can create a user in the Firebase Console Auth tab).
   *Wait, the login page doesn't have a signup button. You can manually create a user in Firebase Auth Console to get a UID.*
2. Start your python environment and install requirements:
   ```bash
   pip install firebase-admin
   ```
3. Generate a Service Account key from Firebase Project Settings > Service Accounts. Save it as `serviceAccountKey.json` inside `/scripts`.
4. Run the script:
   ```bash
   cd scripts
   python bootstrap_admin.py <UID_FROM_FIREBASE_AUTH> admin@example.com
   ```
5. Log in with that user at `/admin/login`. You now have admin privileges and can promote other users from `/admin/users`.