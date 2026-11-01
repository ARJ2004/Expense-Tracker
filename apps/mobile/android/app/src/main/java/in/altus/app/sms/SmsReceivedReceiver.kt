package `in`.altus.app.sms

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.provider.Telephony
import android.util.Log
import com.facebook.react.HeadlessJsTaskService

/**
 * Wakes an inbox sync when a bank SMS arrives. It reads only the sender here: the message itself
 * is read later from the inbox by the same code as a manual sync, so every SMS has one fingerprint
 * however it was found. Declared only in builds that carry the SMS permissions (src/sms).
 */
class SmsReceivedReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent) {
    if (intent.action != Telephony.Sms.Intents.SMS_RECEIVED_ACTION) return
    if (!LiveCapture.enabled(context)) return
    val senders = Telephony.Sms.Intents.getMessagesFromIntent(intent).mapNotNull { it.originatingAddress }
    val banks = LiveCapture.banks(context)
    if (senders.none { s -> banks.any { it.containsMatchIn(s) } }) return
    try {
      // Receiving SMS_RECEIVED briefly allows this app to start a service from the background.
      context.startService(Intent(context, SmsSyncTaskService::class.java))
      HeadlessJsTaskService.acquireWakeLockNow(context)
    } catch (e: RuntimeException) {
      // Not allowed right now: the next app open or SMS syncs instead. Class only, never content.
      Log.w(TAG, "Couldn't start the SMS sync: ${e.javaClass.simpleName}")
    }
  }

  private companion object {
    const val TAG = "AltusSms"
  }
}
