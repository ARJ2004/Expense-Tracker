import React, { useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ImportStatusRow, UploadDropZone } from '../../../components';
import { errorMessage, type MainStackParamList } from '../../../lib';
import { useTheme } from '../../../theme';
import { EmptyState, Screen, Text } from '../../../ui';
import { useImports, useUploadImport } from '../hooks';
import { importSubtitle, importTag } from '../labels';
import { pickStatement } from '../pick-file';

/** Locked mockup "Imports": upload card, then recent imports. The Bank SMS card waits for SMS capture (S8). */
export function ImportsScreen() {
  const { colors } = useTheme();
  const navigation = useNavigation<NativeStackNavigationProp<MainStackParamList>>();
  const imports = useImports();
  const upload = useUploadImport();
  const [pickError, setPickError] = useState<string | null>(null);

  const choose = async () => {
    setPickError(null);
    upload.reset();
    let file;
    try {
      file = await pickStatement();
    } catch {
      setPickError("Couldn't open that file. Try another one.");
      return;
    }
    if (!file) return;
    upload.mutate(file, {
      onSuccess: (result) =>
        navigation.navigate('ImportReview', {
          id: result.import.id,
          ...(result.alreadyImportedAt && { alreadyImportedAt: result.alreadyImportedAt }),
        }),
    });
  };

  const items = imports.data ?? [];
  return (
    <Screen title="Imports" withTabBar>
      <UploadDropZone onChoose={choose} loading={upload.isPending} error={pickError ?? (upload.error ? errorMessage(upload.error) : null)} />
      {items.length > 0 && (
        <Text variant="heading" accessibilityRole="header">
          Recent imports
        </Text>
      )}
      {imports.isPending && <ActivityIndicator color={colors.accent} accessibilityLabel="Loading imports" />}
      {imports.isError && (
        <EmptyState title="Couldn't load imports" message={errorMessage(imports.error)} actions={[{ label: 'Try again', onPress: () => imports.refetch() }]} />
      )}
      <View>
        {items.map((imp) => (
          <ImportStatusRow
            key={imp.id}
            fileName={imp.fileName}
            subtitle={importSubtitle(imp)}
            tag={importTag(imp)}
            onPress={imp.status === 'failed' ? undefined : () => navigation.navigate('ImportReview', { id: imp.id })}
          />
        ))}
      </View>
    </Screen>
  );
}
