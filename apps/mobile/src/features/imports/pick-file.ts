import { errorCodes, isErrorWithCode, pick, types } from '@react-native-documents/picker';

export interface PickedFile {
  uri: string;
  name: string;
  type: string;
}

/**
 * Opens the system file picker for a statement (CSV, Excel or PDF). Resolves null when the user
 * backs out.
 */
export async function pickStatement(): Promise<PickedFile | null> {
  try {
    const [file] = await pick({
      // types.csv is a list on Android and a single UTI on iOS.
      type: ([] as string[]).concat(types.csv, types.xlsx, types.plainText, types.pdf, 'application/octet-stream'),
      allowMultiSelection: false,
    });
    return { uri: file.uri, name: file.name ?? 'statement', type: file.type ?? 'application/octet-stream' };
  } catch (e) {
    if (isErrorWithCode(e) && e.code === errorCodes.OPERATION_CANCELED) return null;
    throw e;
  }
}
