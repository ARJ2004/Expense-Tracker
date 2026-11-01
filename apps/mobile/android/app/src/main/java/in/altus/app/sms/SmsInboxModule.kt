package `in`.altus.app.sms

import android.Manifest
import android.content.pm.PackageManager
import android.provider.Telephony
import androidx.core.content.ContextCompat
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReadableArray
import com.facebook.react.module.annotations.ReactModule
import `in`.altus.app.specs.NativeSmsInboxSpec
import java.util.concurrent.Executors

/**
 * Reads bank alerts from the SMS inbox for on-device parsing. Read only: never sends, writes or
 * deletes a message, and never logs message text. Only senders matching the bank patterns the
 * app passes in (one list, kept in @et/parsers) are read; for any other message, personal or
 * business, the body is never loaded.
 */
@ReactModule(name = SmsInboxModule.NAME)
class SmsInboxModule(context: ReactApplicationContext) : NativeSmsInboxSpec(context) {
  private val io = Executors.newSingleThreadExecutor()

  override fun getName() = NAME

  override fun readInbox(sinceMs: Double, limit: Double, senders: ReadableArray, promise: Promise) {
    val context = reactApplicationContext
    if (ContextCompat.checkSelfPermission(context, Manifest.permission.READ_SMS) != PackageManager.PERMISSION_GRANTED) {
      promise.reject("E_PERMISSION", "READ_SMS not granted")
      return
    }
    val max = limit.toInt().coerceIn(1, MAX_LIMIT)
    val banks = patterns(senders)
    if (banks.isEmpty()) {
      promise.resolve(Arguments.createArray())
      return
    }
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
            // containsMatchIn, as JavaScript's RegExp.test: the patterns carry their own anchors.
            if (banks.none { it.containsMatchIn(sender) }) continue
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

  override fun countInbox(sinceMs: Double, senders: ReadableArray, promise: Promise) {
    val context = reactApplicationContext
    if (ContextCompat.checkSelfPermission(context, Manifest.permission.READ_SMS) != PackageManager.PERMISSION_GRANTED) {
      promise.reject("E_PERMISSION", "READ_SMS not granted")
      return
    }
    val banks = patterns(senders)
    io.execute {
      try {
        var count = 0
        // Only the sender column: counting never loads a message body.
        context.contentResolver.query(
          Telephony.Sms.Inbox.CONTENT_URI,
          arrayOf(Telephony.Sms.ADDRESS),
          "${Telephony.Sms.DATE} > ?",
          arrayOf(sinceMs.toLong().toString()),
          null,
        )?.use { cursor ->
          val address = cursor.getColumnIndexOrThrow(Telephony.Sms.ADDRESS)
          while (cursor.moveToNext()) {
            val sender = cursor.getString(address) ?: continue
            if (banks.any { it.containsMatchIn(sender) }) count++
          }
        }
        promise.resolve(count.toDouble())
      } catch (e: SecurityException) {
        promise.reject("E_PERMISSION", "READ_SMS not granted")
      } catch (e: Exception) {
        promise.reject("E_READ", e.javaClass.simpleName)
      }
    }
  }

  override fun setLiveCapture(enabled: Boolean, senders: ReadableArray) {
    LiveCapture.save(reactApplicationContext, enabled, (0 until senders.size()).mapNotNull { senders.getString(it) })
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

  /** A pattern Kotlin can't compile is dropped: that bank is skipped, never every sender let in. */
  private fun patterns(senders: ReadableArray): List<Regex> =
    (0 until senders.size()).mapNotNull { i ->
      senders.getString(i)?.let { runCatching { Regex(it, RegexOption.IGNORE_CASE) }.getOrNull() }
    }

  companion object {
    const val NAME = "SmsInbox"
    private const val MAX_LIMIT = 500
  }
}
