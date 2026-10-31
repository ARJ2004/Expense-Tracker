import React, { useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { errorMessage, usePreferences, type MainStackParamList } from '../../../lib';
import { radius, useTheme } from '../../../theme';
import { Card, ListRow, Screen, SectionLabel, Text } from '../../../ui';
import { useAccounts } from '../../accounts';
import { useSession, useSignOut } from '../../auth';
import { useCategories } from '../../categories';
import { smsCaptureAvailable, useSmsCapture } from '../../sms';
import { APPEARANCE_LABELS, AppearanceSheet } from '../components/AppearanceSheet';
import { useExportLedger, useHealth } from '../hooks';
import { incomeLabel, initials } from '../labels';
import appInfo from '../../../../app.json';

/** Settings (mockup 10): profile, Money (accounts, categories, income), App (sources, look, export), sign out and delete. */
export function SettingsScreen() {
  const { colors } = useTheme();
  const navigation = useNavigation<NativeStackNavigationProp<MainStackParamList>>();
  const user = useSession((s) => s.user);
  const signOut = useSignOut();
  const accounts = useAccounts();
  const categories = useCategories();
  const health = useHealth();
  const appearance = usePreferences((s) => s.appearance);
  const smsEnabled = useSmsCapture((s) => s.enabled);
  const exportLedger = useExportLedger();
  const [appearanceOpen, setAppearanceOpen] = useState(false);

  const runExport = () =>
    exportLedger.mutate(undefined, {
      onError: (e) => Alert.alert('Export failed', errorMessage(e)),
    });
  const apiStatus = health.isPending ? 'checking' : health.isError ? 'offline' : 'online';

  return (
    <Screen title="Settings" withTabBar>
      <Card>
        <View style={styles.profile}>
          <View style={[styles.avatar, { backgroundColor: colors.primaryBg }]}>
            <Text variant="heading" style={{ color: colors.primaryFg }}>
              {initials(user?.name, user?.email)}
            </Text>
          </View>
          <View style={styles.who}>
            <Text variant="heading" numberOfLines={1}>
              {user?.name ?? user?.email ?? ''}
            </Text>
            <Text variant="secondary" tone="muted" numberOfLines={1}>
              {user?.email ?? 'Signed in with Google'}
            </Text>
          </View>
        </View>
      </Card>

      <SectionLabel label="Money" />
      <Card padding="rows">
        <ListRow label="Accounts" value={accounts.data ? String(accounts.data.length) : undefined} onPress={() => navigation.navigate('Accounts')} />
        <ListRow label="Categories" value={categories.data ? String(categories.data.length) : undefined} onPress={() => navigation.navigate('Categories')} />
        <ListRow label="Income" value={incomeLabel(user?.monthlyIncomePaise ?? null)} onPress={() => navigation.navigate('Income')} last />
      </Card>

      <SectionLabel label="App" />
      <Card padding="rows">
        {smsCaptureAvailable() && (
          <ListRow
            label="Data sources"
            value={smsEnabled ? 'SMS on' : 'SMS off'}
            valueTone={smsEnabled ? 'accent' : 'muted'}
            onPress={() => navigation.navigate('SmsCapture')}
          />
        )}
        <ListRow label="Appearance" value={APPEARANCE_LABELS[appearance]} onPress={() => setAppearanceOpen(true)} />
        <ListRow label="Export data" value={exportLedger.isPending ? 'Exporting…' : 'CSV'} onPress={exportLedger.isPending ? undefined : runExport} last />
      </Card>

      <Card padding="rows">
        <ListRow label={signOut.isPending ? 'Signing out…' : 'Sign out'} onPress={() => signOut.mutate()} />
        <ListRow label="Delete account" tone="danger" onPress={() => navigation.navigate('DeleteAccount')} last />
      </Card>

      <Text variant="secondary" tone="muted" style={styles.footer}>
        {appInfo.displayName} {__DEV__ ? 'debug' : 'release'} · API {apiStatus}
      </Text>

      <AppearanceSheet visible={appearanceOpen} onClose={() => setAppearanceOpen(false)} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  profile: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  avatar: { width: 52, height: 52, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  who: { flex: 1, gap: 2 },
  footer: { textAlign: 'center' },
});
