# Inner Parts — Privacy Policy

**Short version: Inner Parts does not collect, transmit, or share any of your data. Everything stays on your device.**

---

## What data the app stores

All data is stored locally on your device using Android's app storage. Nothing is synced to a server or sent to any external service.

| Data | Where it's stored |
|------|------------------|
| Parts directory | App local storage (localStorage) |
| Fronting logs | App local storage |
| Journal entries | App local storage |
| Relationships | App local storage |
| Message board threads | App local storage |
| Voice log recordings | `Documents/InnerParts/audio/` on your device |
| Backups | `Documents/InnerParts/backups/` on your device |

---

## Third-party services

**None at runtime.** Inner Parts makes no network requests while you are using it.

The only external interaction is a **user-initiated** button in Settings that opens the Ko-Fi donation page in your system browser. Tapping this is entirely optional and no data from the app is included.

---

## Permissions and why they're needed

| Permission | Why |
|------------|-----|
| `RECORD_AUDIO` | Voice log recordings via the mic button in Quick Log. Audio is saved to your device only. |
| `ACCESS_FINE_LOCATION` `ACCESS_COARSE_LOCATION` | Optionally fills in your location when logging. Resolved **offline** using a bundled city dataset — your coordinates are never sent anywhere. |
| `POST_NOTIFICATIONS` | Optional check-in reminder notifications. |
| `RECEIVE_BOOT_COMPLETED` | Reschedules reminders after your device restarts. |
| `SCHEDULE_EXACT_ALARM` | Schedules reminders at the times you choose. |
| `VIBRATE` | Haptic feedback for notifications. |
| `INTERNET` | Required by the Capacitor WebView framework. The app itself makes no network requests. |

---

## A note on location

Earlier versions of this app sent your GPS coordinates to [Nominatim (OpenStreetMap)](https://nominatim.openstreetmap.org) to look up a city name. **This is no longer the case.** Location is now resolved entirely on-device using a bundled offline dataset.

---

## A note on voice

Earlier versions used the browser's `SpeechRecognition` API, which sent audio to Google's servers for transcription. **This is no longer the case.** Voice logs are now recorded as audio files using Android's local `MediaRecorder` API and saved directly to your device.

---

## Backups

Backups you create are saved as JSON files to `Documents/InnerParts/backups/` on your device. If you choose to share a backup using the share sheet, that file goes wherever you send it — Inner Parts has no control over it once shared.

---

## Data deletion

To delete all app data: go to Android Settings → Apps → Inner Parts → Clear Data. This removes everything. Deleting the app removes all localStorage data; files in `Documents/InnerParts/` must be deleted manually if you want to remove recordings and backups.

---

*Inner Parts is free, open source software. If you have questions about privacy, open an issue on GitHub.*
