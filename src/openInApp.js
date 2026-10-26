// Opens a web page in an in-app browser sheet (SFSafariViewController on iOS,
// Chrome Custom Tab on Android) so people stay inside Rooted Together instead
// of being sent out to their browser app. A close button returns them to the
// screen they came from. Falls back to the system browser if the in-app
// browser can't be shown for any reason.
import { Linking } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import { colors } from './theme';

export async function openInApp(url) {
  try {
    await WebBrowser.openBrowserAsync(url, {
      toolbarColor: colors.cream,
      controlsColor: colors.brown,
      showTitle: true,
      enableBarCollapsing: true,
      dismissButtonStyle: 'close',
    });
  } catch (e) {
    try { await Linking.openURL(url); } catch (_) { /* nothing more to try */ }
  }
}
