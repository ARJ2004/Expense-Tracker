import ReactNativeBlobUtil from 'react-native-blob-util';
import { errorCodes, isErrorWithCode, saveDocuments } from '@react-native-documents/picker';
import { istDateKey } from '@et/domain';
import { API_BASE_URL, ApiError, refreshSession, sessionTokens } from '../../lib';

/**
 * The CSV can be large, so it streams from the API straight to a cache file (never through JS
 * memory), then the system "Save as" dialog copies it where the user chooses. The cache copy is
 * removed either way. Resolves false when the user cancels the dialog.
 */
export async function exportLedger(): Promise<boolean> {
  const fileName = `altus-transactions-${istDateKey(new Date())}.csv`;
  const path = `${ReactNativeBlobUtil.fs.dirs.CacheDir}/${fileName}`;
  try {
    await download(path);
    try {
      const [saved] = await saveDocuments({ sourceUris: [`file://${path}`], mimeType: 'text/csv', fileName });
      if (saved.error) throw new ApiError('EXPORT_SAVE_FAILED', "Couldn't save the file. Try another folder.");
      return true;
    } catch (e) {
      if (isErrorWithCode(e) && e.code === errorCodes.OPERATION_CANCELED) return false;
      throw e;
    }
  } finally {
    await ReactNativeBlobUtil.fs.unlink(path).catch(() => undefined);
  }
}

/** GET /v1/me/export into `path`; on a 401 refreshes the session once and tries again. */
async function download(path: string, retried = false): Promise<void> {
  const token = sessionTokens.access();
  const res = await ReactNativeBlobUtil.config({ path }).fetch('GET', `${API_BASE_URL}/v1/me/export`, token ? { Authorization: `Bearer ${token}` } : {});
  const status = res.info().status;
  if (status === 401 && !retried) {
    const session = await refreshSession();
    if (!session) {
      sessionTokens.notifyExpired();
      throw new ApiError('AUTH_EXPIRED', 'Your session ended. Sign in again.');
    }
    return download(path, true);
  }
  if (status !== 200) throw new ApiError('EXPORT_FAILED', "Couldn't export right now. Try again in a minute.");
}
