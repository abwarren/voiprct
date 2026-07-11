# AnfieldVoice — Google Play & App Store Compliance Guide

> **Purpose**: One-stop reference for submitting AnfieldVoice to both stores.
> **App name**: AnfieldVoice
> **Publisher**: Red Cape Technologies (Pty) Ltd — Reg 2022/762895/07
> **Bundle ID (both)**: `com.redcapetech.anfieldvoice`

---

## 1. Data Privacy Declaration

Use these exact values when filling out the **Data Safety** (Play) and **App Privacy** (App Store) forms.

### Data Collected & Linked to User

| Data Type | Collected? | Purpose | Linked to User? |
|-----------|-----------|---------|-----------------|
| **Name** | Yes | Account creation, estate directory, audit trail | Yes |
| **Email** | Yes | Account login, notifications, invitations | Yes |
| **Phone number** | Yes | Resident contact, gate call notifications | Yes |
| **User ID** | Yes (internal) | Account identification | Yes |
| **Apartment / Unit number** | Yes | Estate management, access control | Yes |
| **Role / Permissions** | Yes | Role-based access control | Yes |
| **Crash data** | No | — | — |
| **Diagnostics** | No | — | — |
| **Device ID** | No | — | — |
| **Location** | No | — | — |
| **Photos / Media** | No | — | — |
| **Contacts** | No | — | — |
| **Browsing history** | No | — | — |
| **Purchase history** | No | (B2B, no in-app purchases) | — |

### Data Handling

| Question | Answer |
|----------|--------|
| Data encrypted in transit? | Yes (HTTPS / TLS) |
| Data encrypted at rest? | Yes (PostgreSQL + OS-level encryption) |
| Data shared with third parties? | No |
| Data used for tracking? | No |
| Account deletion available? | Yes — in-app (Profile → Delete Account) |
| Data retention policy? | Active account: retained. Deleted: anonymized within 24h. Audit trail: retained indefinitely (anonymized). |

### Play Store Data Safety Form Reference

Copy these into the Google Play Console Data Safety section:

```
**Personal Info — Name**
  Collected: Yes
  Shared: No
  Used for: App functionality, Account management
  User-optional: No

**Personal Info — Email**
  Collected: Yes
  Shared: No
  Used for: App functionality, Account management
  User-optional: No

**Personal Info — Phone**
  Collected: Yes
  Shared: No
  Used for: App functionality
  User-optional: Yes (can register without phone)

**Personal Info — User IDs**
  Collected: Yes
  Shared: No
  Used for: App functionality
  User-optional: No

**No other data types collected**
  Financial info: No
  Location: No
  Photos/Videos: No
  Audio: No
  Messages: No
  Device/App history: No
  Device ID: No
  Health/Fitness: No
  Contacts: No
  Browsing: No
  Purchase: No
```

### App Store Privacy Nutrition Labels

| Data Type | Used for? | Linked to user? |
|-----------|-----------|-----------------|
| Name | App functionality, Estate directory | Yes |
| Email Address | App functionality, Account management | Yes |
| Phone Number | App functionality | Yes |
| User ID | App functionality | Yes |

---

## 2. Content Rating

For both stores, use these ratings:

| Category | Play Store | App Store |
|----------|-----------|-----------|
| Rating | **Everyone / 4+** | **4+** |
| Reasons | No objectionable content. | No objectionable content. |
| | No user-generated content. | No user-generated content. |
| | No in-app purchases. | No in-app purchases. |
| | No gambling/simulated gambling. | No gambling/simulated gambling. |
| | No violence. | No violence. |
| | No sexual content. | No sexual content. |
| | No alcohol/tobacco/drugs. | No alcohol/tobacco/drugs. |

**Play Store questionnaire tips:**
- Communication: Only "in-app functionality" (gate calls), not "open communication"
- User interaction: "Users can share information with other users via the app" — but only within their estate, not public
- No anonymous posting, no photos shared between users

---

## 3. App Description (Both Stores)

### Short Description (80 char max — Play Store)

> Estate management. Role-based access. Full audit trail.

### Full Description (English)

Use this for both stores — the Play Store has a 4000-char limit, App Store has a 4000-char limit.

```
AnfieldVoice is a residential estate management platform that gives property administrators, residents, and security staff the right tools for their role.

DESIGNED FOR ESTATES
AnfieldVoice replaces paper registers, WhatsApp groups, and spreadsheets with a structured system. Every action is logged. Every user sees only what they need.

KEY FEATURES

• Role-Based Access
Six additive roles: Resident, Property Administrator, Security, Maintenance, Body Corporate Admin, and Super Admin. Each role has precisely scoped permissions.

• Tenant Management
Property administrators can add, remove, and manage residents across their assigned apartments — whether they live on-site or manage remotely.

• Visitor Management
Residents receive gate calls, generate time-bound visitor PINs, and schedule expected arrivals. Non-resident property administrators never get resident gate features.

• Full Audit Trail
Every administrative action is logged with immutable before/after snapshots. Know who did what, when, and why.

• Account Controls
Full account deletion available in-app. Personal data is permanently anonymized on deletion.

BUILT FOR SOUTH AFRICA
Compliant with POPIA (Protection of Personal Information Act). All data hosted on South African infrastructure.

ABOUT RED CAPE TECHNOLOGIES
AnfieldVoice is brought to you by Red Cape Technologies (Pty) Ltd — Reg 2022/762895/07.
```

---

## 4. Privacy Policy URL

Host the `Privacy_Policy.html` file from this repo at a public URL.

```
https://your-domain.com/privacy
```

Or use a GitHub Pages link:
```
https://abwarren.github.io/voiprct/Privacy_Policy.html
```

---

## 5. Screenshots Required

### Play Store (at minimum)

| Size | Quantity | Content |
|------|----------|---------|
| Phone (5.5"+) | 4–8 | Home dashboard, Apartment detail, Profile, Login |
| 7" tablet | 0 (optional) | — |
| 10" tablet | 0 (optional) | — |

### App Store (at minimum)

| Size | Quantity | Content |
|------|----------|---------|
| 6.7" iPhone (1290×2796) | 4–6 | Home dashboard, Resident list, Audit log, Profile |
| 6.5" iPhone (1242×2688) | 4–6 | Same (can reuse with re-crop) |
| 5.5" iPhone (1242×2208) | 4–6 | Same |
| 12.9" iPad (2048×2732) | 4–6 | Landscape + portrait showing the wider layout |
| 11" iPad (1488×2266) | 4–6 | Same |

**Screenshot content tips:**
- Show the dark theme — it's premium and looks great on screenshots
- Use the emulator at the correct resolution
- Blur or crop any real resident names/email (use test data: Alice Smith, John Owner)
- Add device frames (optional but recommended)

---

## 6. Review-Ready Checklist

### Google Play Store

| # | Item | Status | Notes |
|---|------|--------|-------|
| 1 | Developer account | □ | Register at play.google.com/console ($25 one-time) |
| 2 | App signing key | ✓ | EAS Build generates this automatically |
| 3 | **Account deletion** | ✓ Done | `POST /api/v1/me/delete-account` + in-app UI |
| 4 | **Privacy Policy URL** | ✓ Done | `Privacy_Policy.html` — host at public URL |
| 5 | **Data Safety form** | □ | Fill using Section 1 above (5 min) |
| 6 | **Content rating** | □ | Questionnaire using Section 2 (10 min) |
| 7 | **App description** | ✓ Drafted | Section 3 above |
| 8 | **Screenshots** | □ | Need 4–8 phone screenshots on emulator |
| 9 | **Category** | □ | Tools or Productivity |
| 10 | **Target API level** | ✓ Auto | Expo SDK 52 targets latest Android API |
| 11 | **Permissions** | ✓ Auto | INTERNET only (auto-included, not listed) |

### Apple App Store

| # | Item | Status | Notes |
|---|------|--------|-------|
| 1 | **Apple Developer Program** | □ | $99/year — register at developer.apple.com |
| 2 | **Privacy Policy URL** | ✓ Done | Same URL as Play Store |
| 3 | **Privacy Nutrition Labels** | □ | Fill using Section 1 above |
| 4 | **App Review** | □ | — |
| 5 | **iPad support** | ✓ Done | `supportsTablet: true` in app.json |
| 6 | **Encryption declaration** | ✓ Done | `ITSAppUsesNonExemptEncryption: false` in app.json |
| 7 | **Account deletion** | ✓ Done | Same endpoint — Apple also requires this |
| 8 | **Sign in with Apple** | ✗ N/A | Only required if using social logins. We use custom JWT. |
| 9 | **TestFlight** | □ | Need to build with EAS for internal testing |
| 10 | **Screenshots** | □ | Need 4–6 per device size (see Section 5) |
| 11 | **App description** | ✓ Drafted | Section 3 above |
| 12 | **Content rating** | □ | 4+ rating — no objectionable content |
| 13 | **App icon** | □ | Need 1024×1024 PNG for App Store Connect |

---

## 7. Technical Checklist (Config & Code)

### Already Configured

| Item | File | Value |
|------|------|-------|
| Bundle ID (Android) | `app.json` → `android.package` | `com.redcapetech.anfieldvoice` |
| Bundle ID (iOS) | `app.json` → `ios.bundleIdentifier` | `com.redcapetech.anfieldvoice` |
| iPad support | `app.json` → `ios.supportsTablet` | `true` |
| Encryption export | `app.json` → `ios.infoPlist.ITSAppUsesNonExemptEncryption` | `false` |
| Face ID usage | `app.json` → `ios.infoPlist.NSFaceIDUsageDescription` | Descriptive text |
| Android adaptive icon | `app.json` → `android.adaptiveIcon` | Foreground + background + monochrome |
| Dark UI | `app.json` → `userInterfaceStyle` | `dark` |
| Orientation | `app.json` → `orientation` | `default` (portrait + landscape) |
| Account deletion | `src/api/__init__.py` | `POST /api/v1/me/delete-account` |
| Privacy screen | `app/privacy.tsx` | In-app privacy policy |
| Profile deletion UI | `app/(tabs)/profile.tsx` | Two-step confirmation modal |

### Still Needs Work (Before Submit)

| Item | Effort | Notes |
|------|--------|-------|
| **Host Privacy Policy** | 10 min | Upload `Privacy_Policy.html` to public URL (S3, GitHub Pages, or server) |
| **Take screenshots** | 30 min | Run `npx expo start` on emulator, capture all required sizes |
| **Fill Data Safety form** | 5 min | Use Section 1 reference |
| **Content rating questionnaire** | 10 min | Use Section 2 guidance |
| **Create 1024×1024 icon** | 10 min | For App Store Connect (separate from app icon) |

---

## 8. Common Rejection Risks

### Play Store Rejections

| Risk | Likelihood | Mitigation |
|------|-----------|------------|
| "Account deletion not available in-app" | Low (✓ done) | Already implemented |
| "Privacy Policy URL invalid or unreachable" | Low | Host before submitting |
| "Misleading permissions declaration" | Low | Only INTERNET, declare truthfully |
| "Content rating mismatched" | Low | Rate 4+/Everyone |

### App Store Rejections

| Risk | Likelihood | Mitigation |
|------|-----------|------------|
| "iPad support required" | None (✓ done) | Now set to `true` |
| "Encryption export compliance" | None (✓ done) | Declaration set to false (HTTPS only) |
| "Missing privacy policy" | None (✓ done) | Host and link |
| "Account deletion not available" | Low (✓ done) | Implemented — Apple also requires this |
| "Sign in with Apple required" | None | Not needed — we use custom JWT auth, not social logins |
| "2.1 — App completeness (placeholder content)" | Medium | Fill in the stub screens (estate.tsx, residents.tsx, etc.) before submitting |
| "4.0 — Design: insufficient functionality" | Low | Core functionality (login, permissions, resident mgmt, audit) is working |

---

## 9. EAS Build Commands (When Ready)

```bash
cd anfieldvoice-mobile

# Android (APK for testing)
npx eas build --platform android --profile preview

# Android (AAB for Play Store)
npx eas build --platform android --profile production

# iOS (for TestFlight / App Store)
npx eas build --platform ios --profile production

# Submit to stores
npx eas submit --platform android
npx eas submit --platform ios
```

---

## Appendix: Bundle IDs

| Platform | ID | Notes |
|----------|----|-------|
| Android | `com.redcapetech.anfieldvoice` | Must match in both `app.json` and Google Play Console |
| iOS | `com.redcapetech.anfieldvoice` | Must match in both `app.json` and App Store Connect |
