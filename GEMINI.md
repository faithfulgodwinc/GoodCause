# GoodCause Project Rules

## Version Bumping Rule
Whenever code changes, feature additions, or UI adjustments are made to the app:
1. **Increment `versionCode`**: Always increment `versionCode` by +1 in both:
   - [`frontend/app.json`](file:///c:/Users/faith/Documents/GoodCause/frontend/app.json) under `expo.android.versionCode`
   - [`frontend/android/app/build.gradle`](file:///c:/Users/faith/Documents/GoodCause/frontend/android/app/build.gradle) under `android.defaultConfig.versionCode`
2. **Increment Version Name**: Update `version` in `app.json` and `versionName` in `build.gradle` (e.g., `1.0.0` &rarr; `1.0.1`).
