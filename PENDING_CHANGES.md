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
- [ ] NEW SIGN-UP (Expo Go only, no new build needed): one account screen (email + password; Apple/Google
      buttons show "coming soon"), then a few tap-to-answer slides on a dark brown screen: how you'll use the
      app -> (Seeker) what you're walking through -> who it's for + faith -> name & date of birth.
      Creators: goals slide instead. Church: church name + your name. Then a welcome screen.
      Nothing is created until the last slide. Everything the old long form asked is now in Edit Profile, and a
      "Finish your profile" card on Explore + a "Complete your profile" checklist (Profile tab) track what's
      left. Creator goals are saved into the "Anything Else" field. Old sign-up screens (StepScreen,
      RoleSelectScreen, SignupDecisionScreen, ReferralThankYouScreen) are no longer used.
      Follow-ups after Girik's first test: tapping an answer goes straight to the next slide (no Continue
      button; Back still works), and the field being typed in now sits higher above the keyboard, including
      elsewhere in the app (KeyboardAwareScrollView.js).
      (App.js, OnboardingScreen.js, WelcomeScreen.js, ProfileChecklistScreen.js, FinishProfileCard.js,
      DarkUI.js, profileChecklist.js, HomeTabs.js, ExploreScreen.js, ProfileScreen.js)
- [ ] Referrals + live Payouts (Expo Go only, no new build needed): sign-up has an optional "Have a referral
      code?" box under the password (format RT-00042). The code is sent as `referredByCode` and the server links
      the new account to the member who invited them. Settings > Payouts & Referrals is now LIVE (no made-up
      numbers): real Stripe balance / pending, working "Request Payout" (min $10), recent sales and lifetime /
      this-month earnings (net of fees, includes paid prayer / meditation requests), the member's real code and
      share link, signed-up count, tier progress and recent referral cuts. Pull down to refresh. Creators who
      have not finished Stripe setup see their earnings and a "Set up payouts" button that opens the website.
      Referral cuts are a tracked ledger, NOT part of the Stripe balance (no automatic payout of them yet).
      Server side (already live): cuts are worked out on net sales and count paid prayer / meditation requests.
      Web: /join page (Open the app button), updated Referrals page, StoreBadges referrer - needs a push.
      (App.js, OnboardingScreen.js, PayoutsReferralsScreen.js, src/referral.js)
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
Install first: `npx expo install expo-haptics expo-notifications expo-device expo-constants expo-application`
- [ ] Referral links open the app with the code filled in: the app now has a `rootedtogether://` link scheme
      (app.json) and reads Google Play's install referrer on first launch (expo-application, Android only).
      The website /join page "Open the app" button uses the scheme; its Play Store link carries
      `&referrer=RT-00042`. Needs the store URLs filled in lib/config.js (PLAY_STORE_URL, APP_STORE_URL) once
      live. Cannot be tested in Expo Go (typing the code by hand still works there). iPhone has no install
      referrer, so iPhone people tap "Open the app" if already installed, or paste the code (the page copies it).
      (src/referral.js, App.js, OnboardingScreen.js, app.json)
- [ ] Double-tap a post's picture/text to like it (with a haptic buzz and a pop-up heart); double-tap a
      community post to mark it Helpful. The heart / Helpful buttons also buzz when you like.
      (DoubleTapLike.js, haptics.js, PostCard.js, CommunityPostCard.js) - review in Expo Go.
- [ ] Push notifications for new messages (1:1 and family group chats) and new followers.
      Needs the Firebase `google-services.json` + FCM key, and a preview build to test (Expo Go on Android
      can't receive push). (notifications.js, App.js, HomeTabs.js, chatApi.js, familyApi.js,
      realFamilyApi.js, postsApi.js, app.json; server: `send-push` edge function + `push_tokens` table)

## Not yet done (later)
- [ ] Sign in with Apple / Google: the buttons on the new sign-up only say "coming soon". Needs the providers
      set up in Supabase, an OAuth flow in the app, a server step to finish sign-up for social users, and a
      NEW BUILD (not Expo Go). Apple sign-in is also required by the App Store when other social logins exist.
- [ ] Delete the old unused sign-up screens once the new one is confirmed (StepScreen, RoleSelectScreen,
      SignupDecisionScreen, ReferralThankYouScreen).
- [ ] Play Console Data safety form - do it AFTER Google Play payments/subscription are set up
      (add Financial info -> Purchase history, plus push notification token / device ID).


## App Store readiness edits (Oct 2026) - NEEDS A NEW BUILD
- Real app icon (brown sprout) replaces the Expo placeholder: assets/icon.png and android-icon-*.png. Old files kept in assets/_old-placeholders.
- app.json: ios.supportsTablet false (no iPad screenshots needed); Android adaptive icon background #6B4226.
- Onboarding: removed non-working "Continue with Apple/Google" buttons; terms line now links Terms of Service + Privacy Policy.
- Profile > More: added Terms of Service row; Notifications opens iOS/Android settings; Help & Support opens an email to admin@rootedtogether.club.
- Paywall: added Terms link next to Restore purchases and Privacy.
- Public profile: web storefront shortcut hidden on iOS (Apple guideline 3.1.1).
- Still to do: RevenueCat keys in src/billing.js (appl_ and goog_).

## Test feedback fixes (22 Oct 2026) - NEEDS A NEW BUILD
- Log in and Reset password screens restyled to the dark sign-up design (AuthShell / BrandHeader / PillInput in DarkUI.js); App.js shows them full-screen.
- "Complete your profile": added a button at the bottom that returns to the profile.
- Communities: Join buttons now line up across each row of cards.
- Likes ("Helpful" on community posts, and post likes): sent to the server one at a time per post as an explicit on/off, duplicates ignored, real failures re-sync. Fixes the heart un-liking itself after a quick tap.
- Website: /terms page exists in rooted-web but must be pushed to go live (was a 404).

## One Premium for everyone (22 Oct 2026)
- [ ] Seeker and creator paywalls merged into ONE "Unlock Premium" screen with one perk list (unlimited
      conversations, join or lead a Spiritual Family, new Premium features as they launch). Removed perks that
      are not built/gated yet (marketplace savings, "who's active", priority replies, selling courses,
      communities). Add a perk back only once the feature exists. (PremiumUpsellScreen.js, ChatLockedScreen.js)
      Apple setup: one subscription group, Premium Yearly + Premium Monthly, one `premium` entitlement.
