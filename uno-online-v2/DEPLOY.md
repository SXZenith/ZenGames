# Deploying UNO Online
## Firebase (Frontend) + Render (Backend) — both free

---

## PART 1 — Deploy the Server to Render

### 1. Push your project to GitHub
Create a new repo on GitHub and push the entire `uno-online-v2/` folder.

### 2. Create a Render account
Go to https://render.com and sign up (free, no credit card needed).

### 3. Create a new Web Service
- Click **New → Web Service**
- Connect your GitHub repo
- Settings:
  - **Name:** `uno-server` (or anything you like)
  - **Root Directory:** `server`
  - **Build Command:** `npm install`
  - **Start Command:** `node index.js`
  - **Plan:** Free
- Click **Create Web Service**

Render will deploy and give you a URL like:
```
https://uno-server.onrender.com
```
Copy this URL — you need it next.

> ⚠️ Free Render servers spin down after 15 min of inactivity.
> The first connection after idle takes ~15s to wake up. This is normal.

---

## PART 2 — Build the Frontend

### 4. Set your Render URL
Edit `client/.env.production`:
```
VITE_SERVER_URL=https://YOUR_RENDER_APP_NAME.onrender.com
```

### 5. Build the client
```bash
cd client
npm run build
```
This creates `client/dist/` — the static files Firebase will host.

---

## PART 3 — Deploy to Firebase Hosting

### 6. Install Firebase CLI (one-time)
```bash
npm install -g firebase-tools
```

### 7. Log in
```bash
firebase login
```

### 8. Create a Firebase project
Go to https://console.firebase.google.com → **Add Project** → follow the steps.
Note your **Project ID** (shown on the project settings page).

### 9. Update .firebaserc
Replace `YOUR_FIREBASE_PROJECT_ID` in `.firebaserc` with your actual project ID.

### 10. Deploy
From the `uno-online-v2/` root folder:
```bash
firebase deploy --only hosting
```

Firebase gives you two permanent free URLs:
```
https://YOUR_PROJECT_ID.web.app
https://YOUR_PROJECT_ID.firebaseapp.com
```

---

## Updating the game later

Whenever you change code:

```bash
# 1. Push to GitHub — Render auto-redeploys the server

# 2. Rebuild and redeploy the frontend
cd client
npm run build
cd ..
firebase deploy --only hosting
```

---

## Checklist
- [ ] Code pushed to GitHub
- [ ] Render Web Service created, URL noted
- [ ] `client/.env.production` updated with Render URL
- [ ] `npm run build` run in `client/`
- [ ] Firebase project created at console.firebase.google.com
- [ ] `.firebaserc` updated with Firebase project ID
- [ ] `firebase deploy --only hosting` run successfully
- [ ] Visit your `.web.app` URL and test!
