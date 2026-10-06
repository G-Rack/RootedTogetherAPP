// Shared brand tokens — kept in one place so the native app stays visually
// consistent with the web app (join.html) and the landing page.
export const colors = {
  brown: '#6B4226',
  brownLight: '#8C6A4A',
  brownPale: '#C9AD8E',
  cream: '#FBF6EF',
  creamDark: '#F3ECE3',
  text: '#2B2118',
  textSoft: '#6b5f50',
  white: '#FFFFFF',
  errorBg: '#FDECEB',
  errorBorder: '#E0A89F',
  errorText: '#8A3B2F',
  successBg: '#EFF5EC',
  successBorder: '#B9D6AE',
  successText: '#3F6B39',
};

// 'Georgia' renders natively on iOS. Android has no Georgia, so it falls
// back to the generic 'serif' family, which is the closest built-in match
// without shipping a custom font file.
export const serif = 'Georgia, serif';
