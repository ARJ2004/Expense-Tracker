import type { NavigationProp } from '@react-navigation/native';
import type { MainStackParamList } from '../../lib';

/**
 * Where a notification's tap goes, from its data ({ screen, id }). Shared by the inbox and a tap
 * on a push. Unknown screens fall back to the inbox.
 */
export function openNotificationTarget(navigation: Pick<NavigationProp<MainStackParamList>, 'navigate'>, data: Record<string, string | undefined>): void {
  switch (data.screen) {
    case 'Budgets':
      return navigation.navigate('Budgets');
    case 'Rewards':
      return navigation.navigate('Rewards');
    case 'Goal':
      return data.id ? navigation.navigate('GoalDetail', { id: data.id }) : navigation.navigate('Goals');
    case 'Transaction':
      return data.id ? navigation.navigate('TransactionDetail', { id: data.id }) : undefined;
    case 'Home':
      return navigation.navigate('Tabs');
    default:
      return navigation.navigate('Notifications');
  }
}
