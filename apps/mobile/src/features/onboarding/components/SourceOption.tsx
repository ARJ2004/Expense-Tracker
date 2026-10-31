import React from 'react';
import { Pressable } from 'react-native';
import { Card, Text } from '../../../ui';

export interface SourceOptionProps {
  title: string;
  description: string;
  selected: boolean;
  onPress: () => void;
}

/** A choosable card on onboarding step 3. */
export function SourceOption({ title, description, selected, onPress }: SourceOptionProps) {
  return (
    <Pressable accessibilityRole="radio" accessibilityState={{ selected, checked: selected }} onPress={onPress}>
      <Card selected={selected}>
        <Text variant="bodyStrong">{title}</Text>
        <Text variant="secondary" tone="muted">
          {description}
        </Text>
      </Card>
    </Pressable>
  );
}
