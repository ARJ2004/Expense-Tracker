import { TurboModuleRegistry, type TurboModule } from 'react-native';

/** Codegen spec for the Android LaunchSplash module (android/.../splash/LaunchSplashModule.kt). */
export interface Spec extends TurboModule {
  /** Dismisses the native launch splash; JavaScript's LaunchScreen is already drawn underneath. */
  hide(): void;
}

/** Null where the module does not exist (iOS, tests). */
export default TurboModuleRegistry.get<Spec>('LaunchSplash');
