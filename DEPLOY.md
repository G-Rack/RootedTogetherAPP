# Shipping Rooted Together to test users

Day to day: **commit and push to `main`**. EAS decides what to do:

| What changed | What happens |
| --- | --- |
| JavaScript, screens, styles, images | Over-the-air update. Testers get it next time they open the app. No store review. |
| Native things (new package with native code, permissions, app icon, `app.json` native settings, Expo SDK) | New build, uploaded to Google Play internal testing (and TestFlight once iOS is switched on). |

Build numbers go up automatically. Never edit `buildNumber` or `versionCode` by hand.

## One-time setup (do in this order)

1. **On your Mac, reinstall packages** (adds `expo-updates`):
   `cd ~/Desktop/rooted-together-app_36 && rm -rf node_modules && npm install`
2. **Log in and link the project**
   `npx eas-cli@latest login` then `npx eas-cli@latest init`
   (creates the project on expo.dev and writes `extra.eas.projectId` into `app.json`).
3. **Turn on over-the-air updates**: `npx eas-cli@latest update:configure`
   (adds `updates.url` to `app.json`).
4. **Connect GitHub**: expo.dev > your project > GitHub > connect `G-Rack/RootedTogetherAPP`, branch `main`.
5. **Commit and push** `eas.json`, `app.json`, `package.json`, `package-lock.json`, `.eas/`.

## Android (Google Play) - available now

1. Play Console > Create app (package name must be `com.rootedtogether.app`).
2. First build by hand: `npm run build:android`, download the `.aab` from expo.dev, upload it under
   Testing > Internal testing > Create release. Google requires this first upload to be manual.
3. Add yourself and testers under Internal testing > Testers (email list).
4. Create a Google service account with Play Console access (Setup > API access), download its JSON key,
   then add it to EAS: `npx eas-cli@latest credentials` > Android > Google Service Account.
   Never commit the JSON file.
5. From then on, pushes to `main` run `.eas/workflows/deploy-android.yml` automatically.

## iOS (TestFlight) - once Apple approves your account

1. App Store Connect > Apps > New app, bundle ID `com.rootedtogether.app`. Copy its numeric **Apple ID**.
2. Put that number in `eas.json` replacing `REPLACE_WITH_APP_STORE_CONNECT_APP_ID`.
3. First build by hand so EAS can create your certificates and App Store Connect key:
   `npm run ship:ios` (it will ask you to log in with your Apple ID).
4. Add testers in App Store Connect > TestFlight (internal testers need no review).
5. Switch on automatic deploys: `git mv .eas/workflows-disabled/deploy-ios.yml .eas/workflows/deploy-ios.yml`, commit and push.

## Useful commands

- `npm run ship:all` - build both platforms and send them to the stores now
- `npm run update -- "fix profile photo"` - send a JS-only update by hand
- `npm run preview:android` - installable APK for quick tests, no store needed

## Good to know

- Test builds use the same Supabase project as everything else. Stripe is still in sandbox; switch to live keys before real users.
- `EXPO_PUBLIC_DEMO_MODE` is read at build time. If you need it on in store builds, add it under expo.dev > Environment variables (production).
- Android internal testing is limited to 100 testers; TestFlight internal testing to 100 App Store Connect users.
