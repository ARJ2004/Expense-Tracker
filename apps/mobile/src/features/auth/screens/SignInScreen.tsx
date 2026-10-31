import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { DEV_SIGN_IN_EMAIL, errorMessage } from '../../../lib';
import { fonts, radius, space, useTheme } from '../../../theme';
import { Button, Logo, Screen, Text } from '../../../ui';
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
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Continue with Google"
            accessibilityState={{ disabled: busy, busy }}
            disabled={busy}
            onPress={() => signIn.mutate('google')}
            style={({ pressed }) => [
              styles.google,
              { backgroundColor: colors.surface, borderColor: colors.border },
              (pressed || busy) && styles.dim,
            ]}
          >
            <View style={[styles.g, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Text style={[styles.gLetter, { color: colors.googleBlue }]}>G</Text>
            </View>
            <Text variant="bodyStrong" style={styles.googleLabel}>
              Continue with Google
            </Text>
          </Pressable>
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
        <Text tone="muted" style={styles.tagline}>
          Elevate your finances, effortlessly.
        </Text>
      </View>
      <View style={[styles.pitch, { backgroundColor: colors.hero, borderColor: colors.heroBorder }]}>
        <Text variant="label" style={[styles.pitchEyebrow, { color: colors.heroMuted }]}>
          Every rupee, one place
        </Text>
        <Text variant="heading" style={[styles.pitchText, { color: colors.heroText }]}>
          Bank SMS, statements and cash, sorted into one clear ledger.
        </Text>
        <View style={styles.bars}>
          <View style={[styles.bar, styles.bar4, { backgroundColor: colors.highlight }]} />
          <View style={[styles.bar, styles.bar2, { backgroundColor: colors.brandTeal }]} />
          <View style={[styles.bar, styles.bar1, { backgroundColor: colors.heroTrack }]} />
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  brand: { alignItems: 'center', gap: 14, paddingTop: 52, paddingBottom: 48 },
  tagline: { fontSize: 16, textAlign: 'center' },
  pitch: { borderRadius: radius.card, borderWidth: 1, padding: 22, gap: 10 },
  pitchEyebrow: { fontSize: 13 },
  pitchText: { fontSize: 20, lineHeight: 26 },
  bars: { flexDirection: 'row', gap: 6, marginTop: 6 },
  bar: { height: 8, borderRadius: radius.pill },
  bar4: { flex: 4 },
  bar2: { flex: 2 },
  bar1: { flex: 1 },
  google: {
    height: 56,
    borderRadius: radius.pill,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.sm,
  },
  g: { width: 24, height: 24, borderRadius: radius.pill, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  gLetter: { fontFamily: fonts.bold, fontSize: 14, lineHeight: 18 },
  googleLabel: { fontFamily: fonts.bold, fontSize: 16 },
  dim: { opacity: 0.7 },
  center: { textAlign: 'center' },
});
