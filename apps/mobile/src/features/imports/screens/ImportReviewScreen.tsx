import React, { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { ImportRow } from '@et/api-client';
import { formatINR, SYSTEM_CATEGORIES } from '@et/domain';
import { CategoryPicker } from '../../../components';
import { ApiError, errorMessage, type MainStackParamList } from '../../../lib';
import { space, useTheme } from '../../../theme';
import { Button, Card, Chip, ChipGroup, EmptyState, IconButton, Screen, Text, TopBar } from '../../../ui';
import { accountName, useAccounts } from '../../accounts';
import { useCategories } from '../../categories';
import { useRecentCategoryIds } from '../../transactions';
import { AllRowsSheet } from '../components/AllRowsSheet';
import { UnlockForm } from '../components/UnlockForm';
import { useConfirmImport, useDiscardImport, useImport, useImportRows, useSetImportAccount, useUpdateImportRow } from '../hooks';
import { alreadyImportedNotice, failureLabel, needsPassword, reviewSubtitle, rowDay } from '../labels';

type Props = NativeStackScreenProps<MainStackParamList, 'ImportReview'>;

/** Two quick chips per row before "Other…" (locked mockup: Shopping, Bills). */
const QUICK = 2;
const DEFAULT_QUICK = ['shopping', 'bills_utilities'].map((key) => SYSTEM_CATEGORIES.find((c) => c.key === key)!.id);

/** New debit rows no rule could categorize; they would land in Other. */
const needsCategory = (r: ImportRow) => r.status === 'new' && r.direction === 'debit' && r.categorySource === 'default';

/** Locked mockup "Import review": summary, "Pick a category", then "Add N transactions". */
export function ImportReviewScreen({ route, navigation }: Props) {
  const { colors } = useTheme();
  const { id, alreadyImportedAt } = route.params;
  const imp = useImport(id);
  const status = imp.data?.status;
  const rows = useImportRows(id, 'all', status === 'review' || status === 'imported');
  const categories = useCategories();
  const accounts = useAccounts();
  const recentIds = useRecentCategoryIds();
  const updateRow = useUpdateImportRow(id);
  const setAccount = useSetImportAccount(id);
  const confirm = useConfirmImport(id);
  const discard = useDiscardImport(id);
  const [pickingFor, setPickingFor] = useState<ImportRow | null>(null);
  const [allRows, setAllRows] = useState(false);
  /** Rows that needed a category when review opened; they stay listed after the user picks one. */
  const [toPick, setToPick] = useState<number[] | null>(null);

  const all = useMemo(() => rows.data ?? [], [rows.data]);
  if (toPick === null && rows.isSuccess) setToPick(all.filter(needsCategory).map((r) => r.rowNo));
  // A row leaves the list if a rule categorized it since (e.g. after the account was picked); ones the user picked stay.
  const pickList = useMemo(
    () =>
      (toPick ?? [])
        .map((n) => all.find((r) => r.rowNo === n))
        .filter((r): r is ImportRow => !!r && (needsCategory(r) || r.categorySource === 'user')),
    [toPick, all],
  );
  const picked = pickList.filter((r) => r.categorySource === 'user').length;

  const quick = useMemo(() => {
    const ids = [...(recentIds.data ?? []), ...DEFAULT_QUICK].filter((cid, i, list) => list.indexOf(cid) === i).slice(0, QUICK);
    return ids.map((cid) => categories.data?.find((c) => c.id === cid)).filter((c) => c !== undefined);
  }, [recentIds.data, categories.data]);

  const choose = useCallback((row: ImportRow, categoryId: string) => updateRow.mutate({ rowNo: row.rowNo, body: { categoryId } }), [updateRow]);
  const toggle = useCallback((row: ImportRow, include: boolean) => updateRow.mutate({ rowNo: row.rowNo, body: { action: include ? 'import' : 'skip' } }), [updateRow]);

  const askDiscard = () =>
    Alert.alert('Discard this import?', 'Nothing from this file will be added.', [
      { text: 'Keep', style: 'cancel' },
      { text: 'Discard', style: 'destructive', onPress: () => discard.mutate(undefined, { onSuccess: () => navigation.goBack() }) },
    ]);

  const top = (action?: React.ReactNode) => <TopBar title="Review import" onBack={navigation.goBack} action={action} />;

  if (imp.isPending || status === 'parsing') {
    return (
      <Screen>
        {top()}
        <View style={styles.center}>
          <ActivityIndicator color={colors.accent} />
          <Text variant="body" tone="muted">
            Reading your statement…
          </Text>
        </View>
      </Screen>
    );
  }
  if (imp.isError) {
    const gone = imp.error instanceof ApiError && imp.error.code === 'NOT_FOUND';
    return (
      <Screen>
        {top()}
        <EmptyState
          title={gone ? 'This import is gone' : "Couldn't load this import"}
          message={gone ? 'It was discarded.' : errorMessage(imp.error)}
          actions={[{ label: gone ? 'Back' : 'Try again', onPress: gone ? navigation.goBack : () => imp.refetch() }]}
        />
      </Screen>
    );
  }

  const data = imp.data;
  if (needsPassword(data)) {
    return (
      <Screen>
        {top()}
        <UnlockForm importId={id} fileName={data.fileName} onDiscard={askDiscard} />
      </Screen>
    );
  }
  if (data.status === 'failed') {
    return (
      <Screen>
        {top()}
        <EmptyState title={failureLabel(data.error)} message="Export the statement again as CSV or Excel (.xlsx) and upload it." actions={[{ label: 'Back', onPress: navigation.goBack }]} />
      </Screen>
    );
  }

  const done = data.status === 'imported';
  const footer = done ? (
    <Button block label="See transactions" onPress={() => navigation.navigate('Tabs', { screen: 'Transactions' } as never)} />
  ) : (
    <>
      {confirm.error && (
        <Text variant="secondary" tone="spend" style={styles.note} accessibilityLiveRegion="polite">
          {errorMessage(confirm.error)}
        </Text>
      )}
      <Button
        block
        label={data.selectedCount === 1 ? 'Add 1 transaction' : `Add ${data.selectedCount} transactions`}
        disabled={!data.account || (data.selectedCount === 0 && data.duplicateCount === 0)}
        loading={confirm.isPending}
        onPress={() => confirm.mutate()}
      />
      <Text variant="secondary" tone="muted" style={styles.note}>
        Uncategorised rows go to Other; you can fix them later.
      </Text>
    </>
  );

  return (
    <Screen footer={footer}>
      {top(done ? undefined : <IconButton icon="trash" accessibilityLabel="Discard import" onPress={askDiscard} />)}
      <View style={styles.file}>
        <Text variant="lead" numberOfLines={2}>
          {data.fileName}
        </Text>
        <Text variant="secondary" tone="muted">
          {reviewSubtitle(data)}
        </Text>
      </View>
      {alreadyImportedAt && !done && (
        <Text variant="secondary" tone="muted" accessibilityLiveRegion="polite">
          {alreadyImportedNotice(alreadyImportedAt)}
        </Text>
      )}

      {!data.account && !done && (
        <Card>
          <Text variant="heading">Which account is this?</Text>
          <Text variant="secondary" tone="muted">
            We couldn't tell from the file. Pick one so duplicates are matched correctly.
          </Text>
          {(accounts.data ?? []).length > 0 ? (
            <ChipGroup
              accessibilityLabel="Account"
              options={(accounts.data ?? []).map((a) => ({ value: a.id, label: accountName(a) }))}
              value={null}
              onChange={(accountId) => setAccount.mutate(accountId)}
            />
          ) : null}
          <Button variant="text" label="Add an account" onPress={() => navigation.navigate('Accounts')} />
          {setAccount.error && (
            <Text variant="secondary" tone="spend">
              {errorMessage(setAccount.error)}
            </Text>
          )}
        </Card>
      )}

      <Card>
        <View style={styles.summary}>
        {done ? (
          <>
            <Stat value={data.importedCount} label="added" />
            <Stat value={data.mergedCount} label="matched in ledger" />
            <Stat value={data.rowCount - data.importedCount - data.mergedCount} label="skipped" />
          </>
        ) : (
          <>
            <Stat value={data.newCount} label="new" />
            <Stat value={data.duplicateCount} label="duplicates skipped" />
            <Stat value={data.needsCategoryCount} label="need a category" accent />
          </>
        )}
        </View>
      </Card>

      {!done && pickList.length > 0 && (
        <>
          <View style={styles.pickHeader}>
            <Text variant="heading" accessibilityRole="header">
              Pick a category
            </Text>
            <Text variant="secondary" tone="muted">
              {picked} of {pickList.length}
            </Text>
          </View>
          {pickList.map((row) => (
            <PickRow
              key={row.rowNo}
              row={row}
              quick={quick}
              onChoose={(cid) => choose(row, cid)}
              onMore={() => setPickingFor(row)}
            />
          ))}
        </>
      )}

      {!done && rows.isSuccess && (
        <Button variant="secondary" label={data.flaggedCount > 0 ? `Review all rows · ${data.flaggedCount} flagged` : 'Review all rows'} onPress={() => setAllRows(true)} />
      )}

      <CategoryPicker
        visible={pickingFor !== null}
        categories={categories.data ?? []}
        value={pickingFor?.categorySource === 'user' ? (pickingFor.category?.id ?? null) : null}
        onSelect={(cid) => {
          if (pickingFor) choose(pickingFor, cid);
          setPickingFor(null);
        }}
        onClose={() => setPickingFor(null)}
      />
      <AllRowsSheet visible={allRows} rows={all} onToggle={toggle} onClose={() => setAllRows(false)} />
    </Screen>
  );
}

function Stat({ value, label, accent = false }: { value: number; label: string; accent?: boolean }) {
  return (
    <View style={styles.stat} accessible accessibilityLabel={`${value} ${label}`}>
      <Text variant="figure" tone={accent ? 'accent' : 'default'}>
        {value}
      </Text>
      <Text variant="label" tone="muted">
        {label}
      </Text>
    </View>
  );
}

interface PickRowProps {
  row: ImportRow;
  quick: readonly { id: string; name: string }[];
  onChoose: (categoryId: string) => void;
  onMore: () => void;
}

function PickRow({ row, quick, onChoose, onMore }: PickRowProps) {
  const chosen = row.categorySource === 'user' ? row.category : null;
  const other = chosen && !quick.some((c) => c.id === chosen.id) ? chosen : null;
  return (
    <View style={styles.pickRow}>
      <View style={styles.pickTop}>
        <View style={styles.pickText}>
          <Text variant="body" numberOfLines={1}>
            {row.merchantName ?? row.narration}
          </Text>
          <Text variant="secondary" tone="muted">
            {rowDay(row.occurredOn)} · Debit
          </Text>
        </View>
        <Text variant="mono">{formatINR(-row.amountPaise, { symbol: false })}</Text>
      </View>
      <View style={styles.chips} accessibilityRole="radiogroup" accessibilityLabel={`Category for ${row.merchantName ?? 'this row'}`}>
        {quick.map((c) => (
          <Chip key={c.id} label={c.name} selected={chosen?.id === c.id} onPress={() => onChoose(c.id)} />
        ))}
        <Chip label={other ? other.name : 'Other…'} selected={!!other} onPress={onMore} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', gap: space.sm, paddingVertical: space.xxl },
  file: { gap: space.xxs },
  summary: { flexDirection: 'row', gap: space.sm },
  stat: { flex: 1, gap: 2 },
  pickHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  pickRow: { gap: space.xs, paddingVertical: space.sm },
  pickTop: { flexDirection: 'row', justifyContent: 'space-between', gap: space.sm },
  pickText: { flex: 1, gap: 2 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.xs },
  note: { textAlign: 'center' },
});
