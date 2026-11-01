/**
 * @format
 */

import 'react-native-get-random-values';
import { AppRegistry } from 'react-native';
import App from './App';
import { initSentry } from './src/lib/sentry';
import { registerSmsTask } from './src/features/sms';
import { name as appName } from './app.json';

initSentry();

// Before the app: a bank SMS can start JavaScript with no screen (Android's SMS receiver).
registerSmsTask();
AppRegistry.registerComponent(appName, () => App);
