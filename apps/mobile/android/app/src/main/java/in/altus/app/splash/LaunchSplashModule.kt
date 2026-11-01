package `in`.altus.app.splash

import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.module.annotations.ReactModule
import `in`.altus.app.specs.NativeLaunchSplashSpec

/** Lets JavaScript dismiss the launch splash once its own LaunchScreen is on screen. */
@ReactModule(name = LaunchSplashModule.NAME)
class LaunchSplashModule(context: ReactApplicationContext) : NativeLaunchSplashSpec(context) {
  override fun getName() = NAME

  override fun hide() {
    visible = false
  }

  companion object {
    const val NAME = "LaunchSplash"

    /** Read by MainActivity's keep-on-screen condition on every frame. */
    @Volatile var visible = true
  }
}
