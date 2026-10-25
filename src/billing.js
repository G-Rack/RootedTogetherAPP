// Premium subscriptions through the app stores (Google Play Billing on
// Android, Apple In-App Purchase on iOS), via RevenueCat. Both stores
// require digital subscriptions like this one to go through their own
// billing, so Stripe can't be used here.
//
// Setup still needed (outside the code):
//   (Done 25 Oct 2026: Play + App Store products, RevenueCat project and both
//   keys below are set up. Notes kept for reference.)
//   1. Play Console → Monetize → Subscriptions: create one subscription,
//      e.g. id `premium`, with two base plans: yearly $49 and monthly $5.99.
//   2. RevenueCat: create a project, connect the Play app (service account
//      JSON), import the products, create an entitlement `premium` holding
//      both, and an offering (default) with Annual and Monthly packages.
//   3. Paste RevenueCat's public SDK keys below.
//
// Until a key is filled in, isBillingConfigured() is false and the paywall
// falls back to the old free "upgrade" in development builds only (__DEV__);
// release builds refuse the upgrade instead.
import { Platform } from 'react-native';

export const REVENUECAT_ANDROID_KEY = 'goog_cLChVzBPXyGdQGqLMLLecjxPgtR'; // starts with "goog_"
export const REVENUECAT_IOS_KEY = 'appl_JoPNdGaZkvdWpwvfScHJaSkIrml'; // starts with "appl_"
export const ENTITLEMENT_ID = 'premium';

// Shown until the store's real, localized prices load (and if they can't).
export const PLANS = {
  yearly: { key: 'yearly', label: 'Yearly', price: '$49', period: 'per year', perMonth: '$4.08', billed: 'Billed $49 once a year' },
  monthly: { key: 'monthly', label: 'Monthly', price: '$5.99', period: 'per month', billed: 'Billed $5.99 every month' },
};

let Purchases = null;
let configured = false;

function apiKey() {
  return Platform.OS === 'ios' ? REVENUECAT_IOS_KEY : REVENUECAT_ANDROID_KEY;
}

export function isBillingConfigured() {
  return Platform.OS !== 'web' && !!apiKey();
}

function storeName() {
  return Platform.OS === 'ios' ? 'the App Store' : 'Google Play';
}
export function storeLabel() {
  return storeName();
}

// Call once per signed-in session, with the Supabase auth id, so purchases
// follow the person across devices.
export async function initBilling(myAuthId) {
  if (!isBillingConfigured() || configured || !myAuthId) return false;
  try {
    Purchases = require('react-native-purchases').default;
    Purchases.configure({ apiKey: apiKey(), appUserID: myAuthId });
    configured = true;
    return true;
  } catch (e) {
    return false;
  }
}

function hasPremium(customerInfo) {
  return !!customerInfo?.entitlements?.active?.[ENTITLEMENT_ID];
}

export async function hasActivePremium() {
  if (!configured) return false;
  try {
    return hasPremium(await Purchases.getCustomerInfo());
  } catch (e) {
    return false;
  }
}

// { yearly: pkg|null, monthly: pkg|null } from the current offering, each
// with the store's localized price string.
export async function loadPlanPackages() {
  if (!configured) return { yearly: null, monthly: null };
  try {
    const offerings = await Purchases.getOfferings();
    const current = offerings?.current;
    return { yearly: current?.annual || null, monthly: current?.monthly || null };
  } catch (e) {
    return { yearly: null, monthly: null };
  }
}

// Resolves true when Premium is active after the purchase, false if the
// person cancelled the store sheet; throws on a real failure.
export async function purchasePlan(pkg) {
  try {
    const { customerInfo } = await Purchases.purchasePackage(pkg);
    return hasPremium(customerInfo);
  } catch (e) {
    if (e?.userCancelled) return false;
    throw e;
  }
}

export async function restorePurchases() {
  if (!configured) return false;
  return hasPremium(await Purchases.restorePurchases());
}
