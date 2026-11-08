# Contact Form Backend Setup: Resend & Firebase Admin SDK

This document details configuring the production Contact Form backend running on **Vercel Serverless Functions** with **Resend** for transactional email delivery and **Firebase Admin SDK (Firestore)** for atomic cross-instance rate limiting and duplicate prevention.

---

## 1. Firebase Admin SDK & Firestore Setup

- **Firebase Project ID:** `shubhfolio-backend`
- **Database:** Cloud Firestore (`(default)`)

### A. Download Service Account Credentials (Never commit to Git)
1. Open the [Firebase Console](https://console.firebase.google.com/) and select project **`shubhfolio-backend`**.
2. Go to **Project Settings** (gear icon) -> **Service Accounts**.
3. Under the **Firebase Admin SDK** tab, click **Generate new private key**.
4. A JSON file will download. **DO NOT commit this file to GitHub or paste it into client code.**

### B. Configure Environment Variables in Vercel
Go to **Vercel Dashboard** -> Your Portfolio Project -> **Settings** -> **Environment Variables**.

You can supply the service account using **either** of these methods:

#### Method 1: Single JSON Variable (Recommended)
Add a single environment variable containing the entire JSON content (or base64 encoded string):
- **Key:** `FIREBASE_SERVICE_ACCOUNT`
- **Value:** Paste the raw content of your downloaded service account JSON file.
- **Environments:** Check `Production`, `Preview`, `Development`.

#### Method 2: Individual Variables
- **`FIREBASE_PROJECT_ID`:** `shubhfolio-backend`
- **`FIREBASE_CLIENT_EMAIL`:** `firebase-adminsdk-...@shubhfolio-backend.iam.gserviceaccount.com`
- **`FIREBASE_PRIVATE_KEY`:** `"-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"` (keep surrounding quotes; newlines are safely parsed).

### C. Persistent Protection Rules
- **Rate Limit:** 5 requests per IP per 10 minutes. Stored in collection `contact_rate_limits`.
- **Deduplication:** 2-minute cooldown for identical `IP:name:email:message` hashes. Stored in collection `contact_dedup`.
- **Concurrency & Atomicity:** Both checks run inside a single atomic Firestore `runTransaction()` call to guarantee concurrent requests cannot bypass limits.
- **Graceful Fallback:** If Firebase credentials are unset or Firestore is temporarily unreachable, the endpoint logs a warning and transparently engages in-memory fallback without crashing or rejecting valid human inquiries.

---

## 2. Resend Email Setup

### A. Obtain API Key
1. Go to [resend.com](https://resend.com) and navigate to **API Keys** (`https://resend.com/api-keys`).
2. Generate an API Key with **Sending Access**.
3. Add to Vercel Environment Variables:
   - **Key:** `RESEND_API_KEY`
   - **Value:** `re_...`

### B. Onboarding Sender Restrictions
- **Default Sender (`onboarding@resend.dev`):**
  In Resend free sandbox mode, emails can **only be delivered to the primary email associated with your Resend account**.
  Since enquiries are routed to `shubhampatil282487@gmail.com`, this works immediately as long as that matches your Resend login.
- **Custom Verified Domain:**
  To deliver to arbitrary addresses, verify your domain in Resend and add:
  - **Key:** `RESEND_FROM_EMAIL`
  - **Value:** `Shubham Patil <contact@yourdomain.com>`

---

## 3. Summary of Required Vercel Environment Variables

| Variable Name | Required | Description |
| :--- | :---: | :--- |
| `RESEND_API_KEY` | **Yes** | Resend API secret key (`re_...`) |
| `FIREBASE_SERVICE_ACCOUNT` | **Yes** (or Method 2) | Full JSON string of service account key |
| `FIREBASE_PROJECT_ID` | Optional | Defaults to `shubhfolio-backend` |
| `RESEND_FROM_EMAIL` | Optional | Custom sender (defaults to `onboarding@resend.dev`) |