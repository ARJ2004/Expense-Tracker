import React from 'react';
import { StyleSheet, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { CategoryIcon } from '../../../components';
import { errorMessage, type MainStackParamList } from '../../../lib';
import { space, useTheme } from '../../../theme';
import { Card, Screen, Text, TopBar } from '../../../ui';
import { useCategories } from '../../categories';

type Props = NativeStackScreenProps<MainStackParamList, 'Categories'>;

/** Settings → Categories: the list transactions are sorted into. Custom categories arrive later. */
export function CategoriesScreen({ navigation }: Props) {
  const { colors } = useTheme();
  const categories = useCategories();
  const items = categories.data ?? [];
  return (
    <Screen>
      <TopBar title="Categories" onBack={navigation.goBack} />
      {categories.isError && (
        <Text variant="secondary" tone="spend">
          {errorMessage(categories.error)}
        </Text>
      )}
      {items.length > 0 && (
        <Card padding="rows">
          {items.map((c, i) => (
            <View
              key={c.id}
              accessible
              accessibilityLabel={c.name}
              style={[styles.row, i < items.length - 1 && { borderBottomColor: colors.border, borderBottomWidth: StyleSheet.hairlineWidth }]}
            >
              <CategoryIcon icon={c.icon} color={c.color} size={20} />
              <Text variant="bodyStrong">{c.name}</Text>
            </View>
          ))}
        </Card>
      )}
      <Text variant="secondary" tone="muted">
        Change a transaction's category from its detail screen; similar payments follow.
      </Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { minHeight: 52, flexDirection: 'row', alignItems: 'center', gap: space.sm },
});
