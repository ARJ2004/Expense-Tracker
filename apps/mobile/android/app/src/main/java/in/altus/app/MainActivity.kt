package `in`.altus.app

import android.os.Bundle
import android.os.SystemClock
import androidx.core.splashscreen.SplashScreen.Companion.installSplashScreen
import com.facebook.react.ReactActivity
import com.facebook.react.ReactActivityDelegate
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint.fabricEnabled
import com.facebook.react.defaults.DefaultReactActivityDelegate
import `in`.altus.app.splash.LaunchSplashModule

class MainActivity : ReactActivity() {

  override fun onCreate(savedInstanceState: Bundle?) {
    // Keep the launch splash up until JavaScript has drawn its LaunchScreen over the same navy, so
    // there is no blank frame in between. The time limit means a JS error never strands the user.
    val shownAt = SystemClock.uptimeMillis()
    LaunchSplashModule.visible = savedInstanceState == null
    installSplashScreen().apply {
      setKeepOnScreenCondition {
        LaunchSplashModule.visible && SystemClock.uptimeMillis() - shownAt < MAX_SPLASH_MS
      }
      // The LaunchScreen underneath matches it pixel for pixel, so swap at once instead of fading.
      setOnExitAnimationListener { it.remove() }
    }
    // null: react-native-screens can't restore its fragments after the process is killed.
    super.onCreate(null)
  }

  /**
   * Returns the name of the main component registered from JavaScript. This is used to schedule
   * rendering of the component.
   */
  override fun getMainComponentName(): String = "Altus"

  /**
   * Returns the instance of the [ReactActivityDelegate]. We use [DefaultReactActivityDelegate]
   * which allows you to enable New Architecture with a single boolean flags [fabricEnabled]
   */
  override fun createReactActivityDelegate(): ReactActivityDelegate =
      DefaultReactActivityDelegate(this, mainComponentName, fabricEnabled)

  private companion object {
    const val MAX_SPLASH_MS = 5_000L
  }
}
