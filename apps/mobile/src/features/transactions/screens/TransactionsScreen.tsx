import React, { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { FlashList, type ListRenderItem } from '@shopify/flash-list';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { activeFilterCount, SYSTEM_CATEGORIES, type LedgerFilters } from '@et/domain';
import { DayHeader, TransactionRow } from '../../../components';
import { errorMessage, useDebouncedValue, type MainStackParamList } from '../../../lib';
import { space, useTheme } from '../../../theme';
import { EmptyState, IconButton, Screen, SearchField } from '../../../ui';
import { useAccounts } from '../../accounts';
import { useCategories } from '../../categories';
import { FilterSheet } from '../components/FilterSheet';
import { QuickFilters } from '../components/QuickFilters';
import { useLedger, useRecentCategoryIds } from '../hooks';
import { toLedgerItems, type LedgerItem } from '../ledger';
import { useLedgerFilters } from '../ledger-filters';

const QUICK_CATEGORIES = 3;
const DEFAULT_QUICK = SYSTEM_CATEGORIES.slice(0, QUICK_CATEGORIES).map((c) => c.id);

/** Locked mockup "Transactions": search, quick chips, filters sheet, rows grouped by IST day with day totals. */
export function TransactionsScreen() {
  const { colors } = useTheme();
  const navigation = useNavigation<NativeStackNavigationProp<MainStackParamList>>();
  const filters = useLedgerFilters((s) => s.filters);
  const replace = useLedgerFilters((s) => s.replace);
  const [search, setSearch] = useState('');
  const [sheetOpen, setSheetOpen] = useState(false);
  const q = useDebouncedValue(search.trim(), 300);

  const query = useMemo<LedgerFilters>(() => (q ? { ...filters, q } : filters), [filters, q]);
  const ledger = useLedger(query);
  const categories = useCategories();
  const accounts = useAccounts();
  const recentIds = useRecentCategoryIds();

  const quick = useMemo(() => {
    const ids = [...(recentIds.data ?? []), ...DEFAULT_QUICK].filter((id, i, all) => all.indexOf(id) === i).slice(0, QUICK_CATEGORIES);
    return ids.map((id) => categories.data?.find((c) => c.id === id)).filter((c) => c !== undefined);
  }, [recentIds.data, categories.data]);

  const items = useMemo(() => {
    const pages = ledger.data?.pages ?? [];
    return toLedgerItems(
      pages.flatMap((p) => p.items),
      pages.flatMap((p) => p.dayTotals),
    );
  }, [ledger.data]);

  const openDetail = useCallback((id: string) => navigation.navigate('TransactionDetail', { id }), [navigation]);
  const renderItem = useCallback<ListRenderItem<LedgerItem>>(
    ({ item }) =>
      item.kind === 'day' ? <DayHeader label={item.label} netPaise={item.netPaise} /> : <TransactionRow txn={item.txn} when="time" onPress={openDetail} />,
    [openDetail],
  );

  const count = activeFilterCount(filters);
  const narrowed = count > 0 || q.length > 0;
  const clearAll = () => {
    setSearch('');
    replace({});
  };

  let empty: React.ReactElement | null = null;
  if (ledger.isPending) {
    empty = <ActivityIndicator style={styles.loading} color={colors.accent} accessibilityLabel="Loading transactions" />;
  } else if (ledger.isError) {
    empty = <EmptyState title="Couldn't load transactions" message={errorMessage(ledger.error)} actions={[{ label: 'Try again', onPress: () => ledger.refetch() }]} />;
  } else if (narrowed) {
    empty = <EmptyState title="No matches" message="Nothing matches these filters." actions={[{ label: 'Clear filters', onPress: clearAll }]} />;
  } else {
    empty = <EmptyState title="Nothing here yet" message="Transactions you add or import will appear here, grouped by day." />;
  }

  return (
    <Screen
      title="Transactions"
      scroll={false}
      withTabBar
      headerAction={
        <IconButton icon="filter" badge={count} accessibilityLabel={count > 0 ? `Filters, ${count} on` : 'Filters'} onPress={() => setSheetOpen(true)} />
      }
    >
      <SearchField value={search} onChangeText={setSearch} placeholder="Search merchant or note" />
      <QuickFilters filters={filters} onChange={replace} categories={quick} />
      <View style={styles.list}>
        <FlashList
          data={items}
          renderItem={renderItem}
          keyExtractor={(item) => item.key}
          getItemType={(item) => item.kind}
          ListEmptyComponent={empty}
          ListFooterComponent={ledger.isFetchingNextPage ? <ActivityIndicator style={styles.more} color={colors.accent} /> : null}
          onEndReached={() => {
            if (ledger.hasNextPage && !ledger.isFetchingNextPage) ledger.fetchNextPage().catch(() => undefined);
          }}
          onEndReachedThreshold={0.5}
          refreshing={ledger.isRefetching && !ledger.isFetchingNextPage}
          onRefresh={() => ledger.refetch()}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.content}
        />
      </View>
      <FilterSheet
        visible={sheetOpen}
        value={filters}
        categories={categories.data ?? []}
        accounts={accounts.data ?? []}
        onClose={() => setSheetOpen(false)}
        onApply={(next) => {
          replace(next);
          setSheetOpen(false);
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: { flex: 1, marginHorizontal: -space.lg },
  content: { paddingHorizontal: space.lg, paddingBottom: 110 },
  loading: { marginTop: space.xxl },
  more: { marginVertical: space.md },
});
