# Changelog

Running record of changes to the Rooted Together app. Newest first.
Each entry lists what changed, which files, and a suggested commit message.
Entries under "Unpushed" have been edited locally but not yet committed/pushed.

## Unpushed

### Removed "Desired amount per seeker" from Mother and Pastor sign-up
- The question no longer appears in the Mother or Pastor/Priest sign-up steps (existing saved answers stay in the database untouched).
  Files: src/flows.js (field removed from both flows, unused AMOUNT_PER_SEEKER_OPTIONS removed)
- Suggested commit message: `Remove "desired amount per seeker" from Mother and Pastor sign-up`

## Pushed

### Initial commit (209dd32)
Everything below was already in the folder when the repo was first pushed.

- Payouts & Referrals screen replaces Settings > Leader Tools > "Payouts & Earnings"
  (referral code uses the account owner's handle; payout history shows the status chip above the amount).
  Files: src/screens/PayoutsReferralsScreen.js (new), src/screens/ProfileScreen.js
- Profile page for Spiritual Leaders / Mothers / Pastors:
  - "Edit Profile" button removed (editing lives on the photo pencil icon and in Settings)
  - Bio shows "... more" / "Show less" when longer than 3 lines
  - Posts now show for all three roles (previously influencers only), 3-column grid with rounded thumbnails
  - "New Post" button replaced by a small floating "+" button at the bottom right
  - "Danger Zone" label removed above Delete Account
  Files: src/screens/ProfileScreen.js
- Posting fixed for Mothers and Pastors (previously Spiritual Leaders only):
  - getMyInfluencerRow replaced by getMyLeaderRow (reads directory_listing)
  - Image upload folder now uses the user's auth id (matches the storage policy)
  - Gate message now reads "Only Approved Spiritual Leaders, Mothers, and Pastors can post right now."
  Files: src/postsApi.js, src/screens/CreatePostScreen.js, src/screens/ExploreScreen.js
