import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { radius, space, useTheme } from '../theme';
import { Icon, type IconName } from './Icon';

/** Route name → icon. The route named "Add" renders as the raised centre button. */
const ICONS: Record<string, IconName> = {
  Home: 'home',
  Transactions: 'list',
  Add: 'plus',
  Imports: 'upload',
  Settings: 'settings',
};

/** Floating pill tab bar from the locked mockups: navy in light mode, white in dark mode. */
export function TabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View
      accessibilityRole="tablist"
      style={[styles.bar, { bottom: insets.bottom + space.md, backgroundColor: colors.navBar, borderColor: colors.navBorder }]}
    >
      {state.routes.map((route, index) => {
        const focused = state.index === index;
        const isAdd = route.name === 'Add';
        const label = descriptors[route.key]?.options.tabBarAccessibilityLabel ?? route.name;
        const onPress = () => {
          const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
          if (!focused && !event.defaultPrevented) navigation.navigate(route.name);
        };
        const tint = isAdd ? colors.addFg : focused ? colors.navActive : colors.navInactive;
        return (
          <Pressable
            key={route.key}
            accessibilityRole={isAdd ? 'button' : 'tab'}
            accessibilityLabel={label}
            accessibilityState={isAdd ? undefined : { selected: focused }}
            onPress={onPress}
            style={[
              isAdd ? styles.add : styles.tab,
              isAdd && { backgroundColor: colors.addBg },
              focused && !isAdd && { backgroundColor: colors.navActiveBg },
            ]}
          >
            <Icon name={ICONS[route.name] ?? 'home'} color={tint} strokeWidth={isAdd ? 2.2 : 1.8} />
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    position: 'absolute',
    left: space.lg,
    right: space.lg,
    height: 68,
    borderRadius: radius.pill,
    borderWidth: 1,
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
  },
  tab: { width: 48, height: 48, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  add: { width: 52, height: 52, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
});
