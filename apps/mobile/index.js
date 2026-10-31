/**
 * @format
 */

import 'react-native-get-random-values';
import { AppRegistry } from 'react-native';
import App from './App';
import { initSentry } from './src/lib/sentry';
import { name as appName } from './app.json';

initSentry();

AppRegistry.registerComponent(appName, () => App);
