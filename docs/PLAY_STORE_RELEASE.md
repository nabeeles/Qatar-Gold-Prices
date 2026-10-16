# Google Play Store Publishing & Release Guide

This guide covers everything needed to build, sign, and submit **Qatar Gold Price Tracker** (`com.qatargold.tracker`) to the Google Play Console, including exact answers for the **Data Safety**, **Financial Features**, and **App Content** declarations.

---

## 1. Pre-Submission Readiness Summary

| Requirement | Status | Implementation Details |
| :--- | :---: | :--- |
| **Package Identifier** | ✅ Ready | `com.qatargold.tracker` (`version: "1.0.0"`, `versionCode: 1`) |
| **Android App Bundle (`.aab`)** | ✅ Ready | `playstore` profile configured in [`app/eas.json`](file:///Users/nab/Code/qatar-gold-prices/app/eas.json) (`"buildType": "app-bundle"`, `"autoIncrement": true`) |
| **Local APK Build Mandate** | ✅ Preserved | `production` profile in [`app/eas.json`](file:///Users/nab/Code/qatar-gold-prices/app/eas.json) retains `"buildType": "apk"` per `GEMINI.md` |
| **32-bit PNG App Icons** | ✅ Ready | `icon.png`, `adaptive-icon.png`, `splash-icon.png`, and `favicon.png` converted to valid 1024×1024 RGB PNGs |
| **Permission Minimization** | ✅ Ready | Only `INTERNET`, `POST_NOTIFICATIONS`, and `VIBRATE` allowed; storage/media/audio/overlay permissions explicitly blocked via `android.blockedPermissions` |
| **Local Vault Cloud Backup Block** | ✅ Ready | `android.allowBackup: false` set in [`app/app.json`](file:///Users/nab/Code/qatar-gold-prices/app/app.json) so `vault.db` is never uploaded to Google Drive |
| **In-App Privacy & Disclaimer** | ✅ Ready | Accessible from the Dashboard header Shield icon (`/modal` in [`app/app/modal.tsx`](file:///Users/nab/Code/qatar-gold-prices/app/app/modal.tsx)) |
| **Public Privacy Policy** | ✅ Ready | Authored in [`docs/PRIVACY_POLICY.md`](file:///Users/nab/Code/qatar-gold-prices/docs/PRIVACY_POLICY.md) |

---

## 2. Building the Signed Release Artifact

### Option A: Google Play Store Bundle (`.aab`) — Recommended for Play Console
Remember to export the public Supabase environment variables in your shell before running `--local` builds so Metro inlines them at bundle time:

```bash
cd app
export EXPO_PUBLIC_SUPABASE_URL="https://your-project-id.supabase.co"
export EXPO_PUBLIC_SUPABASE_ANON_KEY="your-anon-public-key"

# Generate signed Android App Bundle (.aab) locally
eas build --platform android --profile playstore --local
```

### Option B: Direct Distribution APK (`.apk`) — Per `GEMINI.md` Mandate
```bash
cd app
export EXPO_PUBLIC_SUPABASE_URL="https://your-project-id.supabase.co"
export EXPO_PUBLIC_SUPABASE_ANON_KEY="your-anon-public-key"

# Generate signed standalone APK locally
eas build --platform android --profile production --local
```

> [!IMPORTANT]
> **Play App Signing & Upload Keystore:**  
> On first run, `eas build` manages your Android Upload Keystore. Enable **Play App Signing** in Google Play Console (`Setup -> App signing`) so Google manages the final production signing key and allows seamless key rotation.

---

## 3. Google Play Console — App Content Declarations

### 3.1 Privacy Policy URL
Host [`docs/PRIVACY_POLICY.md`](file:///Users/nab/Code/qatar-gold-prices/docs/PRIVACY_POLICY.md) on GitHub Pages (or your project website) and paste the HTTPS URL into **Policy -> App content -> Privacy policy**.

### 3.2 Data Safety Questionnaire (Exact Answers)

Use the table below to complete **Policy -> App content -> Data safety**:

| Question | Answer | Explanation |
| :--- | :--- | :--- |
| **Does your app collect or share any of the required user data types?** | **Yes** | Only ephemeral anonymous/device push token identifiers when the user opts into push price alerts. |
| **Is all of the user data collected by your app encrypted in transit?** | **Yes** | All Supabase and Expo Push API traffic uses HTTPS / TLS 1.3. |
| **Do you provide a way for users to request that their data is deleted?** | **Yes** | Users can delete active price alerts directly in the **Alerts** tab (which deletes the row from Supabase under RLS), and uninstalling the app erases the local SQLite database. |
| **Data Type: Device or other IDs** (`Expo Push Token` & `Anonymous Auth UUID`) | **Collected** (Not Shared) |<ul><li>**Optional:** Yes (users can use the app without enabling push alerts)</li><li>**Purpose:** App functionality (sending user-configured gold price push notifications)</li></ul> |
| **Data Type: Financial Info (Purchase history / Portfolio)** | **No (Not Collected)** | Stored 100% locally on the user's device in `vault.db` (`expo-sqlite`). Never transmitted off-device. |
| **Data Type: Personal Info / Location / Contacts / Media** | **No (Not Collected)** | Not requested or collected. |

### 3.3 Financial Features Declaration
Google Play requires all apps with finance-related keywords to complete the **Financial features** declaration (`Policy -> App content -> Financial features`):
- **Selection:** Check **"My app doesn't provide any financial products or services"** (or if categorizing under Finance, select **"Financial market data / calculators only — does not facilitate banking, loans, cryptocurrency, or securities trading"**).
- **Notes for Reviewer:**  
  *"Qatar Gold Price Tracker is a read-only retail gold price comparison utility and local-only weight/purity calculator for consumers in Qatar. It does not connect to bank accounts, process payments, execute trades, or offer financial advice."*

### 3.4 App Access (Login Credentials for Reviewers)
- Select **"All functionality in my app is available without any access restrictions."** (No login/account is required; anonymous session initialization is automatic).

### 3.5 Ads, Target Audience & Content Rating
- **Ads:** Select **"No, my app does not contain ads."**
- **Target Age Group:** Select **18 and over** (avoid selecting under-13 age brackets to prevent unnecessary Families Policy restrictions).
- **Content Rating (IARC):** Category **Utility, Productivity, Communication, or Other** — Answer **No** to all violence, sexuality, gambling, and user-generated content prompts (results in **PEGI 3 / Everyone**).
- **Government Apps:** Select **No**.

---

## 4. Store Listing Metadata (Copy-Paste Ready)

- **App Name (max 30 chars):** `Qatar Gold Price Tracker` (24 chars)
- **Short Description (max 80 chars):**  
  `Live Qatar gold rates (24K, 22K, 21K, 18K), price alerts & private gold vault.` (78 chars)
- **Full Description (max 4000 chars):**
  ```text
  Track live retail gold prices across Qatar in real time with a privacy-first portfolio manager and smart jewelry calculator.

  KEY FEATURES:
  • Live Qatari Market Rates: Compare 24K, 22K, 21K, and 18K gold prices in QAR per gram from major Qatari jewelry retailers and exchanges including Malabar Gold, Joyalukkas, Al Fardan Exchange, LivePriceOfGold, and GoodReturns.
  • Historical Price Trends: Interactive 7-day, 30-day, and 1-year charts with market high, low, and percentage change analytics.
  • Smart Gold & Making-Charge Calculator: Instantly estimate total jewelry purchase costs in QAR by combining live or custom per-gram rates with weight and making charges.
  • Private "My Gold" Vault (100% On-Device): Track your personal gold bars, coins, and jewelry purchases with automatic gain/loss valuation against the live Qatari market average. Your portfolio is stored strictly in a local SQLite database on your device and never leaves your phone.
  • Instant Push Price Alerts: Set custom target prices (above or below) for any karat and receive an immediate notification when the Qatari market hits your goal.

  PRIVACY FIRST:
  No sign-up, no email, and no cloud tracking of your personal holdings. Your gold portfolio stays 100% private on your device.

  Disclaimer: Displayed gold rates are for informational reference only and do not constitute financial or investment advice.
  ```

### Required Graphic Assets Checklist for Play Console
1. **Hi-res App Icon:** `512 × 512 px` 32-bit PNG (can be resized from [`app/assets/images/icon.png`](file:///Users/nab/Code/qatar-gold-prices/app/assets/images/icon.png)).
2. **Feature Graphic:** `1024 × 500 px` PNG or JPEG (dark `#0A0A0A` background with `#D4AF37` gold typography).
3. **Phone Screenshots (2 to 8 required):** `1080 × 1920 px` (9:16) PNG/JPEG showing:
   - Dashboard ("Market Overview" & retailer cards)
   - Trends (Interactive historical chart)
   - Calculator (Weight + making charges)
   - My Gold Vault (Local portfolio tracker)
   - Alerts (Custom QAR/g price target setup)
