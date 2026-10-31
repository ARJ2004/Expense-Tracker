import React, { type PropsWithChildren, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { space } from '../../../theme';
import { ProgressBar, Screen, Text, TopBar } from '../../../ui';

const STEPS = 3;

export interface OnboardingFrameProps {
  step: 1 | 2 | 3;
  title: string;
  subtitle: string;
  onBack?: () => void;
  footer: ReactNode;
}

/** Shared layout of the three onboarding steps (locked mockup "Onboarding · step 1"). */
export function OnboardingFrame({ step, title, subtitle, onBack, footer, children }: PropsWithChildren<OnboardingFrameProps>) {
  return (
    <Screen footer={footer}>
      {onBack && <TopBar onBack={onBack} />}
      <View style={styles.head}>
        <ProgressBar value={step / STEPS} segments={STEPS} accessibilityLabel={`Step ${step} of ${STEPS}`} />
        <Text variant="label" tone="muted" style={styles.step}>
          Step {step} of {STEPS}
        </Text>
        <Text variant="headline" accessibilityRole="header">
          {title}
        </Text>
        <Text tone="muted" style={styles.subtitle}>
          {subtitle}
        </Text>
      </View>
      {children}
    </Screen>
  );
}

const styles = StyleSheet.create({
  head: { gap: space.md, paddingTop: space.xs, paddingBottom: space.xs },
  step: { fontSize: 13 },
  subtitle: { lineHeight: 22 },
});
