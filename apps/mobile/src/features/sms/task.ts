import { AppRegistry } from 'react-native';
import { queryClient, secureStore } from '../../lib';
import { runSmsSync } from './run';
import { useSmsCapture } from './store';

/** The Android service's task name (SmsSyncTaskService.TASK). */
const TASK = 'AltusSmsSync';
/**
 * SMS_RECEIVED fires before the SMS app has written the message to the inbox, so the first read
 * can come back empty: try again after these waits. Anything still missing waits for the next sync.
 */
const RETRY_MS = [1_500, 2_500, 6_000];

const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * What the task does when a bank SMS arrives, app open or not. Nothing when capture is off or
 * nobody is signed in; never throws (a failed sync is retried by the next trigger).
 */
export async function onBankSms(): Promise<void> {
  if (!useSmsCapture.getState().enabled) return;
  if (!(await secureStore.getRefreshToken())) return;
  for (const delay of RETRY_MS) {
    await wait(delay);
    try {
      const result = await runSmsSync();
      if (result.read > 0) {
        // The app may be open: show the new row on Home and in the ledger.
        await queryClient.invalidateQueries();
        return;
      }
    } catch {
      return;
    }
  }
}

/** Registers the headless task; call once from index.js, before the app component. */
export function registerSmsTask(): void {
  AppRegistry.registerHeadlessTask(TASK, () => onBankSms);
}
