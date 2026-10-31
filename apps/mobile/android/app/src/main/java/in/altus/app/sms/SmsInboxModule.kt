package `in`.altus.app.sms

import android.Manifest
import android.content.pm.PackageManager
import android.provider.Telephony
import androidx.core.content.ContextCompat
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.module.annotations.ReactModule
import `in`.altus.app.specs.NativeSmsInboxSpec
import java.util.concurrent.Executors

/**
 * Reads bank alerts from the SMS inbox for on-device parsing. Read only: never sends, writes or
 * deletes a message, and never logs message text. Personal messages are skipped here by sender:
 * banks send from alphanumeric headers like "VM-HDFCBK", people from phone numbers.
 */
@ReactModule(name = SmsInboxModule.NAME)
class SmsInboxModule(context: ReactApplicationContext) : NativeSmsInboxSpec(context) {
  private val io = Executors.newSingleThreadExecutor()

  override fun getName() = NAME

  override fun readInbox(sinceMs: Double, limit: Double, promise: Promise) {
    val context = reactApplicationContext
    if (ContextCompat.checkSelfPermission(context, Manifest.permission.READ_SMS) != PackageManager.PERMISSION_GRANTED) {
      promise.reject("E_PERMISSION", "READ_SMS not granted")
      return
    }
    val max = limit.toInt().coerceIn(1, MAX_LIMIT)
    io.execute {
      try {
        val out = Arguments.createArray()
        context.contentResolver.query(
          Telephony.Sms.Inbox.CONTENT_URI,
          arrayOf(Telephony.Sms.ADDRESS, Telephony.Sms.BODY, Telephony.Sms.DATE),
          "${Telephony.Sms.DATE} > ?",
          arrayOf(sinceMs.toLong().toString()),
          "${Telephony.Sms.DATE} ASC",
        )?.use { cursor ->
          val address = cursor.getColumnIndexOrThrow(Telephony.Sms.ADDRESS)
          val body = cursor.getColumnIndexOrThrow(Telephony.Sms.BODY)
          val date = cursor.getColumnIndexOrThrow(Telephony.Sms.DATE)
          while (cursor.moveToNext() && out.size() < max) {
            val sender = cursor.getString(address) ?: continue
            if (!BANK_SENDER.matches(sender)) continue
            val item = Arguments.createMap()
            item.putString("sender", sender)
            item.putString("body", cursor.getString(body) ?: "")
            item.putDouble("receivedAt", cursor.getLong(date).toDouble())
            out.pushMap(item)
          }
        }
        promise.resolve(out)
      } catch (e: SecurityException) {
        promise.reject("E_PERMISSION", "READ_SMS not granted")
      } catch (e: Exception) {
        // The exception class only: messages can carry SMS content.
        promise.reject("E_READ", e.javaClass.simpleName)
      }
    }
  }

  override fun isDeclared(): Boolean {
    val context = reactApplicationContext
    @Suppress("DEPRECATION")
    val info = context.packageManager.getPackageInfo(context.packageName, PackageManager.GET_PERMISSIONS)
    return info.requestedPermissions?.contains(Manifest.permission.READ_SMS) == true
  }

  override fun invalidate() {
    io.shutdown()
    super.invalidate()
  }

  companion object {
    const val NAME = "SmsInbox"
    private const val MAX_LIMIT = 500
    /** "VM-HDFCBK", "AD-SBIINB-S", "JD-ATMSBI": a 2-letter operator prefix and an alphanumeric header. */
    private val BANK_SENDER = Regex("^[A-Za-z]{2}-[A-Za-z0-9]{3,9}(-[A-Za-z])?$")
  }
}
