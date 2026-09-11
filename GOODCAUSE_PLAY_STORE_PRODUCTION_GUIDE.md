# GoodCause — Google Play Store Production Release Guide

This document provides step-by-step instructions for completing the Google Play Console setup, building your Android App Bundle (`.aab`), filling out the Data Safety form, and submitting your app to production.

---

## 1. Hosting Your Privacy Policy (Required by Google Play)

Google Play Console **requires** a publicly accessible Privacy Policy URL.

### Options to Host Your Privacy Policy:

#### Option A: Vercel / Web Deployment (Recommended)
We have included a standalone HTML Privacy Policy at [`frontend/public/privacy.html`](file:///c:/Users/faith/Documents/GoodCause/frontend/public/privacy.html).
- If your frontend is deployed to Vercel/Netlify, your privacy policy URL will be:
  `https://your-domain.com/privacy.html`

#### Option B: GitHub Pages (Free)
1. Copy [`frontend/public/privacy.html`](file:///c:/Users/faith/Documents/GoodCause/frontend/public/privacy.html) to a repository.
2. Enable GitHub Pages under Repository Settings -> Pages.
3. Your URL will be: `https://<your-username>.github.io/<repo-name>/privacy.html`.

---

## 2. Google Play Console Data Safety Questionnaire Answers

When submitting your app on Google Play Console under **Policy -> Data Safety**, use the following exact responses based on GoodCause's implementation:

### Section 1: Data Collection & Sharing
- **Does your app collect or share any of the required user data types?**  
  &rarr; Select **Yes**.
- **Is all of the user data collected by your app encrypted in transit?**  
  &rarr; Select **Yes** (HTTPS/TLS enforced).
- **Do you provide a way for users to request that their data be deleted?**  
  &rarr; Select **Yes**.
- **Privacy Policy URL:**  
  &rarr; Enter your public Privacy Policy URL (from Step 1).

### Section 2: Data Types & Declarations

| Data Category | Data Type | Collected? | Shared? | Purpose | Account Deletion Supported? |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Personal Info** | Name | Yes | No | App Functionality, Account Management | Yes |
| **Personal Info** | Email address | Yes | No | Account Management, Authentication | Yes |
| **Photos and Videos** | Photos (`READ_MEDIA_IMAGES`) | Yes | No | Campaign stories & updates | Yes |
| **Audio Files** | Voice Recordings (`RECORD_AUDIO`) | Yes | No | Campaign audio updates | Yes |
| **Financial Info** | Purchase/Donation History | Yes | No | Processing donations & analytics | Anonymized |
| **App Info & Specs** | Crash Logs & Diagnostics | Yes | No | Analytics & app performance | Yes |

---

## 3. Account Deletion Requirement Declaration

Google Play Console requires a clear declaration for account deletion under **Policy -> App Content -> Account Deletion**:

1. **URL for account deletion request:**  
   Provide your Privacy Policy URL or a direct email link (e.g. `https://your-domain.com/privacy.html#deletion` or `mailto:privacy@goodcause.app`).
2. **Does your app allow users to create an account in-app?**  
   &rarr; Select **Yes**.
3. **Can users request account deletion entirely in-app?**  
   &rarr; Select **Yes** (available in **Profile &rarr; Legal & Privacy &rarr; Data & Deletion**).

---

## 4. Building the Android App Bundle (.AAB File)

Run the following command in your terminal inside the `frontend` folder:

```bash
cd frontend
npx eas-cli build -p android --profile production
```

### What Happens During Build:
1. EAS will ask to generate/use your Android keystore credentials automatically. Select **Yes**.
2. Expo will compile the native code, sign the `.aab` file, and output a download link.
3. Download the `.aab` file to your computer.

---

## 5. Uploading to Google Play Console

1. Log into your [Google Play Console](https://play.google.com/console).
2. Select your app **GoodCause** (or create a new app with package name `com.goodcause.app`).
3. Go to **Testing & Production &rarr; Production**.
4. Click **Create new release**.
5. Upload the generated `.aab` file.
6. Enter Release Notes (e.g., *"Initial production release of GoodCause - Transparent fundraising platform"*).
7. Complete the **Main Store Listing** (App description, screenshots, feature graphic, and Privacy Policy URL).
8. Click **Save** and **Review Release**, then **Start rollout to Production**!
