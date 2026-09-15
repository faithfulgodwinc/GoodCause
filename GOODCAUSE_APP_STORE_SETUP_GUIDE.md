# GoodCause — Apple App Store Production Setup & Release Guide

This document provides step-by-step instructions for setting up **GoodCause** on the Apple App Store, configuring App Store Connect, handling iOS-specific App Review requirements, and submitting your app using Expo / EAS.

---

## 1. Prerequisites & Account Setup

1. **Apple Developer Account**: Ensure you are enrolled in the [Apple Developer Program](https://developer.apple.com/programs/) ($99/year).
2. **Register App ID**:
   - Go to [Apple Developer Certificates, Identifiers & Profiles](https://developer.apple.com/account/resources/identifiers/list).
   - Add a new App ID with Bundle ID: `com.goodcause.app`.
   - Enable required capabilities (Push Notifications if used, Sign in with Apple, etc.).
3. **Create App in App Store Connect**:
   - Go to [App Store Connect](https://appstoreconnect.apple.com/).
   - Navigate to **Apps** &rarr; click **+ New App**.
   - Select **iOS**, enter Name: `GoodCause`, Primary Language, SKU (`goodcause-ios`), and select Bundle ID `com.goodcause.app`.

---

## 2. App Store Privacy & Data Declarations (App Privacy Form)

Apple requires declaring all collected data types in App Store Connect under **App Privacy**:

| Data Category | Data Type | Collected? | Linked to User? | Used for Tracking? | Purpose |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Contact Info** | Name & Email Address | Yes | Yes | No | App Functionality & Authentication |
| **User Content** | Photos / Images | Yes | Yes | No | Campaign stories & updates |
| **User Content** | Audio Data | Yes | Yes | No | Campaign voice updates |
| **Financial Info** | Payment Info / Purchases | Yes | Yes | No | Campaign donations & transparent funding |
| **Diagnostics** | Crash Data / Performance | Yes | No | No | Analytics & bug fixing |

- **Privacy Policy URL**: Ensure your privacy policy (e.g. `https://your-domain.com/privacy.html`) is publicly accessible and linked in App Store Connect.
- **Account Deletion (Guideline 5.1.1)**: Apple requires an in-app account deletion flow. GoodCause has this under **Profile &rarr; Legal & Privacy &rarr; Data & Deletion**.

---

## 3. Critical Apple Review Requirements to Check

1. **Sign in with Apple (Guideline 4.8)**:
   - If your app uses third-party social logins (e.g., Google Sign-In), Apple **requires** offering **Sign in with Apple** as an equivalent option on iOS, unless you only use standard email/password authentication.
2. **Review Demo Account (Crucial for Approval)**:
   - Under **App Review Information** in App Store Connect, check **"Sign-in required"**.
   - Provide a valid **Demo Username** and **Password** (e.g. `testuser@goodcause.app`).
   - Add notes explaining how the reviewer can test creating a campaign or viewing transparent donations without spending real money (e.g., use sandbox/test payment details).
3. **Permission Strings (`infoPlist`)**:
   - Verify camera/photo library usage strings in [`frontend/app.json`](file:///c:/Users/faith/Documents/GoodCause/frontend/app.json):
     - `NSPhotoLibraryUsageDescription`: "Add photos to tell your campaign story"

---

## 4. Building & Submitting via Expo EAS

### Option A: Fully Automated EAS Build & Submission (Recommended)

1. Open terminal inside the `frontend` folder:
   ```bash
   cd frontend
   npx eas-cli build -p ios --profile production
   ```
2. EAS will prompt you to log into your Apple Developer Account or set up an **App Store Connect API Key**.
3. EAS automatically manages Certificates & Provisioning Profiles.
4. Once built, submit directly to App Store Connect:
   ```bash
   npx eas-cli submit -p ios --profile production
   ```

### Option B: Build IPA and Upload via Transporter App
1. Build the iOS App Store package:
   ```bash
   cd frontend
   npx eas-cli build -p ios --profile production
   ```
2. Download the generated `.ipa` file from the Expo dashboard.
3. Download **Transporter** from the Mac App Store.
4. Open Transporter, sign in with your Apple ID, drag & drop the `.ipa` file, and click **Deliver**.

---

## 5. App Store Optimization (ASO) Distribution Listing Guide

Use these optimized, high-conversion copy-paste values when filling out your app listing in [App Store Connect](https://appstoreconnect.apple.com/):

---

### A. General App Information (`App Information` tab)

* **App Name**: `goodcause`
* **Subtitle**: `Direct Impact & Fundraising` *(27/30 characters — ASO Keyword Optimized)*
* **Primary Category**: `Lifestyle`
* **Secondary Category**: `Utilities` (or `Social Networking`)
* **Content Rights**: Select **No, it does not contain, show, or access third-party content**.

#### Age Rating Questionnaire Answers:
Select **None** (or **No**) for all content declaration categories:
- Alcohol, Tobacco, or Drug Use or References: **None**
- Contests: **None**
- Gambling / Simulated Gambling: **None / No**
- Horror / Fear Themes: **None**
- Mature / Suggestive Themes: **None**
- Medical / Treatment Information: **None** (or Infrequent/Mild)
- Profanity or Crude Humor: **None**
- Sexual Content or Nudity: **None**
- Violence (Cartoon, Fantasy, Realistic): **None**
- Unrestricted Web Access: **No**
*(Resulting Age Rating: **4+**)*

---

### B. Pricing and Availability (`Pricing and Availability` tab)

* **Price**: **Free** ($0.00)
* **Availability**: **Available in all countries and regions** (or select specific markets).

---

### C. App Privacy Questionnaire (`App Privacy` tab)

* **Privacy Policy URL**: `https://goodcause-app.vercel.app/privacy.html` *(or your hosted privacy policy link)*
* **Data Collection Question**: Select **Yes, we collect data from this app**.
* **Select Data Types Collected**:
  1. **Contact Info**: Check *Name* & *Email Address* (Select: *Linked to User Identity* & *App Functionality*).
  2. **User Content**: Check *Photos or Videos* & *Audio Data* (Select: *Linked to User Identity* & *App Functionality*).
  3. **Financial Info**: Check *Payment Info / Purchase History* (Select: *Linked to User Identity* & *App Functionality*).
  4. **Diagnostics**: Check *Crash Data* (Select: *Not Linked to User Identity* & *Analytics/Performance*).
* **Tracking Declaration**: Select **No, we do not use data from this app for tracking purposes across other companies' apps or websites**.

---

### D. iOS App Version Metadata (`iOS App -> Prepare for Submission`)

#### 1. Screenshots (Required)
Upload high-resolution screenshots:
* **6.7" Display** (iPhone 16 Pro Max / 15 Pro Max / 14 Pro Max): `1290 x 2796 px`
* **5.5" Display** (iPhone 8 Plus): `1242 x 2208 px`

#### 2. Promotional Text (160/170 Characters — ASO Optimized)
```text
Experience transparent giving with goodcause. Create causes, support verified campaigns, and track real-world impact through direct photo and voice updates.
```

#### 3. Description (ASO & Conversion Optimized)
```text
goodcause is the modern, transparent fundraising platform designed to bring total clarity, trust, and connection to giving.

Whether you are starting a campaign for a personal cause, community project, or emergency relief, goodcause connects supporters directly to verifiable, real-world impact.

WHY GOODCAUSE?
• Transparent Cause Funding: Track exactly how every single contribution makes a tangible difference.
• Direct Media & Story Updates: Campaign organizers share authentic photo and voice updates directly with supporters.
• Impact Commitments: Transparent milestones showing progress from initial funding to execution on the ground.
• Fast & Secure Sign-In: Instant access via email code, Google Sign-In, and Sign in with Apple.

HOW IT WORKS:
1. Discover Verified Causes: Explore verified campaigns making a real difference.
2. Support & Share: Back causes effortlessly and invite friends to join the movement.
3. Track Direct Impact: Receive photo, audio, and milestone updates as your contribution changes lives.

Join goodcause today and experience the power of transparent giving.
```

#### 4. Keywords (98/100 Characters — Pure ASO, Comma-Separated, No Spaces)
```text
fundraising,charity,donation,cause,transparency,impact,ngo,giving,nonprofit,crowdfunding,volunteer
```

#### 5. Support & Marketing URLs
* **Support URL**: `https://goodcause-app.vercel.app/privacy.html`
* **Marketing URL**: `https://goodcause-app.vercel.app`

---

### E. App Review Information (Guarantees Fast Approval)

* **Sign-in required**: Select **Yes**.
* **Demo Username / Email**: `reviewer@goodcause.app`
* **Demo Password / Code**: `123456`
* **Notes for Reviewer**:
  ```text
  goodcause is a transparent cause and fundraising platform.

  Reviewers can log in using the demo account:
  - Email: reviewer@goodcause.app
  - 6-Digit Verification Code: 123456 (bypasses email delivery for instant testing)

  Once signed in, you can test browsing causes, viewing transparent impact commitments, and testing campaign media updates.
  ```

---

### F. Version Release Control
* Select **Automatically release App Store version** (app goes live automatically as soon as Apple approves it).

---

## 7. Setting Up In-App Purchases & Subscriptions with RevenueCat (iOS)

GoodCause already contains full RevenueCat logic built into [`frontend/src/lib/revenuecat.tsx`](file:///c:/Users/faith/Documents/GoodCause/frontend/src/lib/revenuecat.tsx). Follow these steps to enable live In-App Purchases for iOS:

### Step 1: Add your iOS App to RevenueCat
1. Log into your [RevenueCat Dashboard](https://app.revenuecat.com/).
2. Select your **goodcause** project (or create one).
3. Click **+ Add App** &rarr; Select **App Store (iOS)**.
4. Enter your details:
   - **App Name**: `goodcause`
   - **Bundle ID**: `com.goodcause.app`
   - **App Store Connect App ID**: `6812077131`
5. Copy the generated **iOS Public API Key** (starts with `appl_...`).

### Step 2: Configure Subscriptions in App Store Connect
1. In [App Store Connect](https://appstoreconnect.apple.com/), select **goodcause**.
2. Go to **Monetization** &rarr; **Subscriptions** (or In-App Purchases).
3. Create a **Subscription Group** named `goodcause_subscriptions`.
4. Create the 4 Subscription Products matching GoodCause tiers:

| Product ID | Name | Tier Price |
| :--- | :--- | :--- |
| `gc_monthly_1k` | Tier 1 Supporter | ₦1,000 / month |
| `gc_monthly_2k5` | Tier 2 Supporter | ₦2,500 / month |
| `gc_monthly_5k` | Tier 3 Supporter | ₦5,000 / month |
| `gc_monthly_10k` | Tier 4 Supporter | ₦10,000 / month |

### Step 3: Link RevenueCat to App Store Connect
1. In App Store Connect &rarr; **Users and Access** &rarr; **Integrations** &rarr; **App Store Connect API**.
2. Generate an API key with role **App Manager**.
3. In RevenueCat &rarr; **App Settings (iOS)**, paste your App Store Connect API Key (or Shared Secret) so RevenueCat can automatically validate Apple receipts.

### Step 4: Add iOS API Key to `eas.json`
In [`frontend/eas.json`](file:///c:/Users/faith/Documents/GoodCause/frontend/eas.json), replace `"appl_REVENUECAT_IOS_KEY_HERE"` with your real RevenueCat iOS Public API key (`appl_...`).
