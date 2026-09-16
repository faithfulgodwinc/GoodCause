# Apple App Review — Guideline 2.1 Information Needed Response

Use this official response to reply to Apple's App Review team in **App Store Connect Resolution Center** and copy-paste it into the **Notes** field under **App Review Information** for future submissions.

---

## Response Template (Copy & Paste to App Store Connect)

**Subject:** Response to Guideline 2.1 Information Needed — GoodCause (com.goodcause.app)

Dear App Review Team,

Thank you for your feedback. Below is the detailed information requested to assist in completing the review for **GoodCause**.

---

### 1. Screen Recording
We have recorded a video on a physical iOS device running iOS 18 showing the complete app experience. 

**What the screen recording covers:**
- **App Launch & Login**: Launching the app, entering test email `reviewer@goodcause.app`, and typing verification code `123456`.
- **Content Creation & Moderation**: Creating a campaign, uploading media, and demonstrating the reporting/flagging and user blocking mechanisms.
- **In-App Subscriptions**: Accessing the "Commit to Help" membership subscription screen (StoreKit / RevenueCat).
- **In-App Account Deletion (Guideline 5.1.1)**: Navigating to **Profile &rarr; Delete account**, confirming deletion, and observing automated profile deletion and session termination.

*(The video file is attached directly to this App Store Connect message).*

---

### 2. Purpose & Target Audience
- **Purpose**: GoodCause is a transparent fundraising and direct-giving mobile application built to bring total trust and clarity to charitable giving.
- **Problem Solved**: Traditional giving often lacks visibility into how contributions are used. GoodCause solves this trust deficit by providing transparent impact commitments, itemized budget breakdowns, and verified photo/audio milestone updates.
- **Target Audience**: Donors, monthly community supporters, cause organizers, and non-profit advocates looking for verifiable giving.

---

### 3. Setup Instructions & Demo Account Credentials
Reviewers can instantly access and test all authenticated features without needing external email delivery:

- **Sign-in Required**: Yes
- **Demo Username / Email**: `reviewer@goodcause.app`
- **Verification Code**: `123456` *(Hardcoded test code for instant review access)*

**Testing Steps:**
1. Launch GoodCause &rarr; enter `reviewer@goodcause.app` &rarr; enter `123456`.
2. **Explore Causes**: Tap any campaign to view story details, budget breakdowns, and impact commitments.
3. **Create Campaign**: Tap **My Campaigns &rarr; Start a campaign** to test creating a cause.
4. **Test Subscriptions**: Tap **Commit to Help** on Profile to view native StoreKit subscription tiers.
5. **Test Account Deletion**: Go to **Profile** &rarr; scroll to bottom &rarr; tap **Delete account** &rarr; confirm deletion.

---

### 4. External Services & Platforms Used
GoodCause uses the following trusted infrastructure services:
1. **Authentication**: Email OTP (internal API) + Google Sign-In + Sign in with Apple (`expo-apple-authentication`).
2. **Database & Cloud Storage**: Supabase Cloud (Encrypted PostgreSQL database and file storage for campaign media).
3. **In-App Subscriptions**: Apple In-App Purchases (StoreKit) managed via RevenueCat SDK (`react-native-purchases`).
4. **Direct Campaign Payments**: Paystack payment gateway integration.
5. **AI Services**: **NONE**. The app does not use any third-party AI services or generative AI models.

---

### 5. Regional Functionality
GoodCause functions **consistently across all regions globally** without geo-blocking or regional feature variations. All users worldwide have access to identical campaign creation, impact tracking, and account management features.

---

### 6. Regulated Industry & Material Authorization
GoodCause is a **technology software platform** facilitating direct community fundraising and transparent supporter commitments. GoodCause is not a bank, credit issuer, or investment broker, and does not sell securities or financial products. All user campaigns are subject to organizer verification and safety moderation.

---

Thank you for your guidance. Please let us know if any further information is needed to approve GoodCause for release.

Best regards,  
GoodCause Team
