# Tag Parts

A private Android app for plural systems to track fronting, manage system members, write journals, and understand patterns over time.

All data is stored locally on the device. No accounts, no servers, no telemetry.

---

## Features

| Feature | Description |
|---|---|
| 🏠 Fronting Log | Record who's fronting, where, when, and awareness level (1–10) |
| 👥 Parts Directory | Document system members with roles, colors, IFS designations, aliases, and privacy flags |
| 📓 Journals | Per-part private journals with optional passcode protection |
| 📊 Analytics | Fronting frequency and awareness trends over time |
| 💬 Message Board | Threaded in-app communication between parts |
| 🔗 Bonds | Track relationships between system members |
| ⚡ Quick Log | One-tap logging with per-part presets and voice input |
| 🔔 Reminders | Local notifications to prompt regular logging |
| 💾 Backup / Restore | Export and import all data as JSON via Settings |

---

## Tech Stack

| Layer | Technology |
|---|---|
| UI | Vanilla JS + HTML/CSS |
| Build | Vite 5 |
| Mobile wrapper | Capacitor 7 |
| Platform | Android (min SDK 23 / target SDK 35) |
| Storage | `localStorage` + Capacitor Filesystem mirror |

---

## Development Setup

### Prerequisites

- Node.js 18+
- Android Studio with Android SDK 35 installed
- JDK 17+ (required for Gradle 8)

### Run in browser (dev mode)

```bash
cd inner-parts-app
npm install
npm start        # Vite dev server → http://localhost:5173
```

### Deploy to Android device / emulator

```bash
cd inner-parts-app
npm run build          # Compile web assets → dist/
npx cap sync android   # Copy dist/ into android/app/src/main/assets/public/
npx cap run android    # Build and deploy to connected device
```

Or open Android Studio directly:

```bash
npx cap open android
```

---

## Building the APK

### Automated (GitHub Actions)

Every push to `main` triggers a debug APK build automatically.  
Download it from the **Actions** tab → latest workflow run → **Artifacts → tag-parts-debug**.

### Manual debug build

```bash
cd inner-parts-app
npm run build
npx cap sync android
cd android
./gradlew assembleDebug
```

Output: `android/app/build/outputs/apk/debug/app-debug.apk`

### Signed release build

1. Generate a keystore (one-time setup):
   ```bash
   keytool -genkey -v -keystore tagparts.jks -alias tagparts -keyalg RSA -keysize 2048 -validity 10000
   ```
2. Add signing config to `android/app/build.gradle` under `android { signingConfigs { ... } }`
3. Build:
   ```bash
   ./gradlew assembleRelease
   ```

For automated release builds via GitHub Actions, store the keystore as a base64-encoded repository secret (`KEYSTORE_BASE64`) and decode it in the workflow.

---

## Project Structure

```
inner-parts-app/
├── src/
│   ├── index.html          # Fronting log (home screen)
│   ├── parts.html          # Parts directory
│   ├── loggys.html         # Log history & calendar
│   ├── journal.html        # Per-part journals
│   ├── analytics.html      # Stats & charts
│   ├── messageBoard.html   # Threads
│   ├── relationships.html  # Bonds tracker
│   ├── Settings.html       # App settings & backup
│   ├── css/style.css
│   └── js/
│       ├── index.js        # Home screen logic
│       ├── parts.js        # Parts CRUD
│       ├── log.js          # Log entry management
│       ├── onboarding.js   # First-launch wizard
│       ├── quickLog.js     # Quick log overlay
│       ├── analytics.js    # Charts & stats
│       ├── journal.js      # Journal entries
│       ├── storage.js      # localStorage wrapper
│       └── ...
├── android/                # Capacitor Android project
├── capacitor.config.json
└── package.json
```

---

## Privacy

Tag Parts keeps everything on-device in Android's private app storage. There are no network requests, no analytics SDKs, and no cloud sync. Uninstalling the app will erase all data — use **Settings → Backup / Restore** to export first.
