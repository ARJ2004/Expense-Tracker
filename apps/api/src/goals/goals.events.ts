/** A goal's target was saved in full. Nothing listens yet: the hook for a celebration notification. */
export const GOAL_REACHED = 'goal.reached';

export interface GoalReachedEvent {
  userId: string;
  goalId: string;
}
