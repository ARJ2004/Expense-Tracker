module.exports = {
  preset: '@react-native/jest-preset',
  setupFiles: ['./jest.setup.js', '@shopify/flash-list/jestSetup'],
  // The first render in a suite loads React Native's components; on a cold CI runner with every
  // suite in parallel that alone can pass Jest's 5 s default (a 0.4 s test locally).
  testTimeout: 15_000,
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?|@react-navigation|react-native-svg|react-native-screens|react-native-safe-area-context|@react-native-google-signin|@shopify/flash-list)/)',
  ],
};
