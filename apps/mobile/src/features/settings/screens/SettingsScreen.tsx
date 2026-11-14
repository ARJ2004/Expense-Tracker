import React, { useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { errorMessage, usePreferences, type MainStackParamList } from '../../../lib';
import { radius, useTheme } from '../../../theme';
import { Card, ListRow, Screen, SectionLabel, Text } from '../../../ui';
import { useAccounts } from '../../accounts';
import { useBudgets } from '../../budgets';
import { useGoals } from '../../goals';
import { useNotifications } from '../../notifications';
import { useSession, useSignOut } from '../../auth';
import { useCategories } from '../../categories';
import { smsCaptureAvailable, useSmsCapture } from '../../sms';
import { APPEARANCE_LABELS, AppearanceSheet } from '../components/AppearanceSheet';
import { useExportLedger, useHealth } from '../hooks';
import { incomeLabel, initials } from '../labels';
import appInfo from '../../../../app.json';

/** Settings (mockup 10): profile, Money (accounts, categories, income, budgets, goals), App (sources, notifications, look, export), sign out and delete. */
export function SettingsScreen() {
  const { colors } = useTheme();
  const navigation = useNavigation<NativeStackNavigationProp<MainStackParamList>>();
  const user = useSession((s) => s.user);
  const signOut = useSignOut();
  const accounts = useAccounts();
  const goals = useGoals('active');
  const budgets = useBudgets();
  const inbox = useNotifications();
  const categories = useCategories();
  const health = useHealth();
  const appearance = usePreferences((s) => s.appearance);
  const smsEnabled = useSmsCapture((s) => s.enabled);
  const toReview = useSmsCapture((s) => Object.keys(s.held).length);
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
        <ListRow label="Income" value={incomeLabel(user?.monthlyIncomePaise ?? null)} onPress={() => navigation.navigate('Income')} />
        <ListRow label="Budgets" value={budgets.data ? String(budgets.data.items.length) : undefined} onPress={() => navigation.navigate('Budgets')} />
        <ListRow label="Goals" value={goals.data ? String(goals.data.length) : undefined} onPress={() => navigation.navigate('Goals')} />
        <ListRow label="Streak and badges" onPress={() => navigation.navigate('Rewards')} last />
      </Card>

      <SectionLabel label="App" />
      <Card padding="rows">
        <ListRow
          label="Data sources"
          value={smsCaptureAvailable() ? (smsEnabled ? (toReview > 0 ? `${toReview} to review` : 'SMS on') : 'SMS off') : undefined}
          valueTone={smsEnabled ? (toReview > 0 ? 'spend' : 'accent') : 'muted'}
          onPress={() => navigation.navigate('DataSources')}
        />
        <ListRow
          label="Notifications"
          value={inbox.data?.unreadCount ? `${inbox.data.unreadCount} new` : undefined}
          valueTone="accent"
          onPress={() => navigation.navigate('NotificationSettings')}
        />
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
