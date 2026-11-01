package `in`.altus.app.sms

import android.content.Intent
import com.facebook.react.HeadlessJsTaskService
import com.facebook.react.bridge.Arguments
import com.facebook.react.jstasks.HeadlessJsTaskConfig

/** Runs the JavaScript task AltusSmsSync (src/features/sms/task.ts), with or without the app open. */
class SmsSyncTaskService : HeadlessJsTaskService() {
  override fun getTaskConfig(intent: Intent?): HeadlessJsTaskConfig =
    HeadlessJsTaskConfig(TASK, Arguments.createMap(), TIMEOUT_MS, true)

  companion object {
    const val TASK = "AltusSmsSync"
    private const val TIMEOUT_MS = 60_000L
  }
}
