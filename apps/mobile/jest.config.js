module.exports = {
  preset: '@react-native/jest-preset',
  setupFiles: ['./jest.setup.js', '@shopify/flash-list/jestSetup'],
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?|@react-navigation|react-native-svg|react-native-screens|react-native-safe-area-context|@react-native-google-signin|@shopify/flash-list)/)',
  ],
};
