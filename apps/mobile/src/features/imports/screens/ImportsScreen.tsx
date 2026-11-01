import React, { useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ImportStatusRow, UploadDropZone } from '../../../components';
import { errorMessage, type MainStackParamList } from '../../../lib';
import { useTheme } from '../../../theme';
import { Card, EmptyState, Screen, Text } from '../../../ui';
import { lastSyncLabel, smsCaptureAvailable, useSmsCapture } from '../../sms';
import { useImports, useUploadImport } from '../hooks';
import { importSubtitle, importTag, needsPassword } from '../labels';
import { pickStatement } from '../pick-file';

/** Locked mockup "Imports": upload card, the Bank SMS source (Android), then recent imports. */
export function ImportsScreen() {
  const { colors } = useTheme();
  const navigation = useNavigation<NativeStackNavigationProp<MainStackParamList>>();
  const imports = useImports();
  const upload = useUploadImport();
  const [pickError, setPickError] = useState<string | null>(null);
  const smsEnabled = useSmsCapture((s) => s.enabled);
  const smsLastSync = useSmsCapture((s) => s.lastSyncMs);

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
      {smsCaptureAvailable() && (
        <Card padding="rows">
          <ImportStatusRow
            icon="sms"
            fileName="Bank SMS"
            subtitle={smsEnabled ? lastSyncLabel(smsLastSync) : 'Add spends from bank alerts automatically'}
            tag={smsEnabled ? { label: 'On', tone: 'success' } : { label: 'Off', tone: 'neutral' }}
            onPress={() => navigation.navigate('DataSources', { explainSms: !smsEnabled })}
          />
        </Card>
      )}
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
            onPress={imp.status === 'failed' && !needsPassword(imp) ? undefined : () => navigation.navigate('ImportReview', { id: imp.id })}
          />
        ))}
      </View>
    </Screen>
  );
}
