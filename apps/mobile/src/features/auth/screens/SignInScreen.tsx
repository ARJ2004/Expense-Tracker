import React from 'react';
import { StyleSheet, View } from 'react-native';
import { DEV_SIGN_IN_EMAIL, errorMessage } from '../../../lib';
import { radius, space, useTheme } from '../../../theme';
import { Button, HeroSurface, Logo, Screen, Text } from '../../../ui';
import { useSignIn } from '../hooks';

/** Locked mockup "Sign in": logo and wordmark, the navy pitch card, Continue with Google. */
export function SignInScreen() {
  const { colors } = useTheme();
  const signIn = useSignIn();
  const busy = signIn.isPending;

  return (
    <Screen
      footer={
        <>
          <Button
            block
            variant="secondary"
            icon={<GoogleMark />}
            label="Continue with Google"
            disabled={busy}
            onPress={() => signIn.mutate('google')}
          />
          {signIn.error && (
            <Text variant="secondary" tone="spend" style={styles.center} accessibilityLiveRegion="polite">
              {errorMessage(signIn.error)}
            </Text>
          )}
          {DEV_SIGN_IN_EMAIL && (
            <Button variant="text" label={`Continue as ${DEV_SIGN_IN_EMAIL}`} disabled={busy} onPress={() => signIn.mutate('dev')} />
          )}
          <Text variant="secondary" tone="muted" style={styles.center}>
            Your data stays yours. We never ask for bank passwords.
          </Text>
        </>
      }
    >
      <View style={styles.brand}>
        <Logo />
        <Text variant="wordmark" accessibilityRole="header">
          Altus
        </Text>
        <Text tone="muted" style={styles.center}>
          Elevate your finances, effortlessly.
        </Text>
      </View>
      <HeroSurface>
        <Text variant="eyebrow" style={{ color: colors.heroMuted }}>
          Every rupee, one place
        </Text>
        <Text variant="lead" style={{ color: colors.heroText }}>
          Bank SMS, statements and cash, sorted into one clear ledger.
        </Text>
        <View style={styles.bars}>
          <View style={[styles.bar, styles.bar4, { backgroundColor: colors.highlight }]} />
          <View style={[styles.bar, styles.bar2, { backgroundColor: colors.brandTeal }]} />
          <View style={[styles.bar, styles.bar1, { backgroundColor: colors.heroTrack }]} />
        </View>
      </HeroSurface>
    </Screen>
  );
}

/** Google's "G" in its brand blue, on the button's own surface. Only Sign in uses it. */
function GoogleMark() {
  const { colors } = useTheme();
  return (
    <View style={[styles.mark, { backgroundColor: colors.surface, borderColor: colors.border }]} importantForAccessibility="no">
      <Text variant="bodyStrong" style={{ color: colors.googleBlue }}>
        G
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  brand: { alignItems: 'center', gap: space.sm, paddingTop: space.xxl + space.lg, paddingBottom: space.xxl + space.md },
  bars: { flexDirection: 'row', gap: space.xxs, marginTop: space.xxs },
  bar: { height: space.xs, borderRadius: radius.pill },
  bar4: { flex: 4 },
  bar2: { flex: 2 },
  bar1: { flex: 1 },
  mark: { width: space.xl, height: space.xl, borderRadius: radius.pill, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  center: { textAlign: 'center' },
});
