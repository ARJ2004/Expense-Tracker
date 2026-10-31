module.exports = {
  root: true,
  extends: '@react-native',
  rules: {
    // Colours and sizes come from src/theme only; this keeps light and dark mode correct.
    'react-native/no-color-literals': 'error',
    'react-native/no-inline-styles': 'error',
  },
  overrides: [{ files: ['src/theme/**'], rules: { 'react-native/no-color-literals': 'off' } }],
};
