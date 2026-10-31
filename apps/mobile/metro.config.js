const path = require('path');
const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config');

const workspaceRoot = path.resolve(__dirname, '../..');

/**
 * Monorepo setup: watch the shared packages and resolve from the hoisted root node_modules.
 * Shared packages expose TypeScript source through their "react-native" field.
 *
 * @type {import('@react-native/metro-config').MetroConfig}
 */
const config = {
  watchFolders: [workspaceRoot],
  resolver: {
    nodeModulesPaths: [path.resolve(__dirname, 'node_modules'), path.resolve(workspaceRoot, 'node_modules')],
  },
};

module.exports = mergeConfig(getDefaultConfig(__dirname), config);
