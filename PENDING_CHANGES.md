# Pending changes (not yet shipped to the Play build)

Test each change in Expo Go (`npx expo start`). Mark it verified once it
works on the phone. When everything is verified, ship the batch with:

    npx eas-cli update --channel production --platform android --message "<summary>"

(Use `eas build` + a Play upload instead only if a change adds a package
with native code, or touches permissions, icon, splash or the Expo SDK.)

## Shipped in the latest Play build (version code 4, Oct 16)
- Full-screen layout, tab bar above Android's navigation buttons, filter pills not cut off
- Family header icons stay in place; family group chat icon works
- Bio "… more" on other people's profiles; "Additional Services" removed
- Instagram-style square post grid, full Posts view with likes / Likes sheet / comments / share
- Premium paywall: Yearly $49 / Monthly $5.99, billing library (RevenueCat) included, keys not yet set
- Replying to messages needs Premium

## Pending
- [x] Seeker / Assistant profiles: the pencil on the profile picture opens the photo picker to change
      the photo (was opening "Complete your profile") (ProfileScreen.js)
- [ ] Sign-up: the page stays put and scrolls smoothly just enough to keep the field you're typing in above
      the keyboard; dragging down closes the keyboard. Date and dropdown fields close the keyboard before their
      picker opens, and picker sheets clear Android's navigation bar. New post / change password also no longer
      hidden by the keyboard. Waiting for Girik to confirm the new behaviour in Expo Go.
      (App.js, KeyboardAwareScrollView.js, FieldControl.js, CalendarPickerModal.js, SelectModal.js,
      CreatePostScreen.js, ChangePasswordScreen.js)

- [ ] Creator sign-up is free in the app (no $49 website payment). The app sends `source: 'app'`; the
      server (`submit-signup` v25, already live) skips the payment check for it. Website sign-up still
      needs the $49. (App.js)
- [ ] Creator version of the Premium upgrade page (Leaders / Mothers / Pastors / Churches): "Unlock Creator
      Premium" with creator wording; Seeker/Assistant page unchanged. (PremiumUpsellScreen.js)
- [ ] Mothers and Pastors see the Premium upgrade page on the Family tab until subscribed.
      (FamilyScreen.js) Decision still open: also gate selling courses / starting a community, or reword
      the creator perks.
- [x] Explore: gap between a post's picture and its like row fixed (DoubleTapLike.js, PostCard.js) - verified.

- [ ] Profile: the round "+" new-post button was cut off by the tab bar; moved up and made slightly larger.
      (ProfileScreen.js)

## Pending - NEEDS A NEW BUILD (adds native code; cannot ship as an OTA update)
Install first: `npx expo install expo-haptics expo-notifications expo-device expo-constants`
- [ ] Double-tap a post's picture/text to like it (with a haptic buzz and a pop-up heart); double-tap a
      community post to mark it Helpful. The heart / Helpful buttons also buzz when you like.
      (DoubleTapLike.js, haptics.js, PostCard.js, CommunityPostCard.js) - review in Expo Go.
- [ ] Push notifications for new messages (1:1 and family group chats) and new followers.
      Needs the Firebase `google-services.json` + FCM key, and a preview build to test (Expo Go on Android
      can't receive push). (notifications.js, App.js, HomeTabs.js, chatApi.js, familyApi.js,
      realFamilyApi.js, postsApi.js, app.json; server: `send-push` edge function + `push_tokens` table)

## Not yet done (later)
- [ ] Play Console Data safety form - do it AFTER Google Play payments/subscription are set up
      (add Financial info -> Purchase history, plus push notification token / device ID).

