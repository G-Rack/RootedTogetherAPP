# Rooted Together — App

A real React Native (Expo) app: the same 4 sign-up flows as the web version
(Seeker, Spiritual Mother, Spiritual Assistant, Priest/Pastor), built as a
proper mobile app for iOS and Android. This is "just sign-ups for now,"
matching flow — like Raya's application step — with matching/messaging as a
later phase.

## See it running in 2 minutes (no App Store needed yet)

1. Install **Expo Go** from the App Store or Google Play on your phone.
2. On your computer, install [Node.js](https://nodejs.org) if you don't have it.
3. Unzip this project, then in a terminal:
   ```
   cd rooted-app
   npm install
   npx expo start
   ```
4. A QR code appears in the terminal. Scan it with your phone's camera
   (iOS) or the Expo Go app itself (Android) — your phone and computer need
   to be on the same Wi-Fi. The real app opens on your phone, fully
   interactive, hot-reloading as you make changes.

## Where sign-ups go

`src/config.js` points at `https://rootedtogether.club/.netlify/functions/submit-signup`
— the same secure backend the web app (`join.html`) already uses, so both
write to the same three Airtable tables (Seekers, Spiritual Mothers &
Assistants, Priests). If that's not your live domain, update the URL there.

Before real sign-ups can be saved, finish the Airtable + Netlify setup in
`App_Backend_Setup_Guide.md` (delivered separately) — this app doesn't need
its own separate backend, it shares the one already being set up.

## Project structure

- `App.js` — the screen-flow engine (role select → steps → thank-you)
- `src/flows.js` — every question, per role, exactly matching the Airtable
  field names — edit this file to add/remove/reword questions
- `src/config.js` — the backend endpoint URL
- `src/components/` — reusable field renderer + the custom select dropdown
- `src/screens/` — the three screen types (role select, a step, thank-you)
- `src/theme.js` — brand colors, shared across every screen

## Path to the real App Store / Google Play

This app was built in a sandboxed environment that can't compile a native
binary or reach Apple/Google's submission tools directly — that part needs
to happen from your own computer (or mine, if you'd rather walk through it
together in a follow-up). The standard path from here, once you're happy
with the app:

1. Create a free [Expo account](https://expo.dev) (`npx eas login`).
2. `npx eas build --platform ios` and `--platform android` — Expo's cloud
   builders produce the real `.ipa`/`.aab` files, no Mac required even for
   iOS.
3. iOS needs an Apple Developer account ($99/year) to submit to TestFlight
   or the App Store; Android needs a one-time $25 Google Play
   registration.
4. `npx eas submit` uploads the build to TestFlight / Play Console.

None of this is needed just to try the app on your own phone via Expo Go —
only for putting it in front of other people through the actual app
stores.
