# Automatic Version Bumping Rule

Whenever code changes, feature additions, or UI adjustments are made to the GoodCause project:
1. **Increment `versionCode`**: Always increment `versionCode` by +1 in both:
   - `frontend/app.json` (`expo.android.versionCode`)
   - `frontend/android/app/build.gradle` (`android.defaultConfig.versionCode`)
2. **Increment Version Name**: Update `version` in `app.json` and `versionName` in `build.gradle` (e.g., `1.0.0` -> `1.0.1`).
