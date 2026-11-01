package `in`.altus.app.sms

import android.content.Context

/**
 * What the SMS receiver needs before any JavaScript runs: whether capture is on and which senders
 * are banks. JavaScript mirrors both here (SmsInbox.setLiveCapture) whenever they change.
 */
object LiveCapture {
  private const val PREFS = "altus_sms_live"
  private const val ENABLED = "enabled"
  private const val SENDERS = "senders"

  fun save(context: Context, enabled: Boolean, senders: List<String>) {
    context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit()
      .putBoolean(ENABLED, enabled)
      .putStringSet(SENDERS, senders.toSet())
      .apply()
  }

  fun enabled(context: Context): Boolean =
    context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getBoolean(ENABLED, false)

  /** Bank sender patterns; one that Kotlin can't compile is dropped, never every sender let in. */
  fun banks(context: Context): List<Regex> =
    context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getStringSet(SENDERS, emptySet())
      .orEmpty()
      .mapNotNull { runCatching { Regex(it, RegexOption.IGNORE_CASE) }.getOrNull() }
}
