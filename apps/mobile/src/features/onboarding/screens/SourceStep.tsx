import React from 'react';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { errorMessage } from '../../../lib';
import { Button, Text } from '../../../ui';
import { OnboardingFrame } from '../components/OnboardingFrame';
import { SourceOption } from '../components/SourceOption';
import { useOnboardingDraft } from '../draft';
import { useCompleteOnboarding } from '../hooks';
import type { OnboardingParamList } from '../OnboardingNavigator';

type Props = NativeStackScreenProps<OnboardingParamList, 'Source'>;

/** Step 3: how the first transactions will arrive. Either choice finishes onboarding. */
export function SourceStep({ navigation }: Props) {
  const { source, setSource } = useOnboardingDraft();
  const complete = useCompleteOnboarding();

  return (
    <OnboardingFrame
      step={3}
      title="How will you add your spends?"
      subtitle="Pick one to start. You can use both any time."
      onBack={navigation.goBack}
      footer={
        <>
          {complete.error && (
            <Text variant="secondary" tone="spend" accessibilityLiveRegion="polite">
              {errorMessage(complete.error)}
            </Text>
          )}
          <Button block label="Finish setup" disabled={!source} loading={complete.isPending} onPress={() => complete.mutate()} />
        </>
      }
    >
      <SourceOption
        title="Import a statement"
        description="Upload a CSV, Excel or PDF statement from your bank. We'll open Imports when you finish."
        selected={source === 'statement'}
        onPress={() => setSource('statement')}
      />
      <SourceOption
        title="Add manually"
        description="Type in spends and income as they happen."
        selected={source === 'manual'}
        onPress={() => setSource('manual')}
      />
    </OnboardingFrame>
  );
}
