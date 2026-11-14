/** Goal events, emitted after the write commits. Listeners live in the reacting module (rewards, notifications). */
export const GOAL_CREATED = 'goal.created';
export const GOAL_REACHED = 'goal.reached';

export interface GoalCreatedEvent {
  userId: string;
  goalId: string;
}

export interface GoalReachedEvent {
  userId: string;
  goalId: string;
  name: string;
}

/** A contribution reached new milestones ("saved-50", "streak-7"). */
export const GOAL_MILESTONES = 'goal.milestones';

export interface GoalMilestonesEvent {
  userId: string;
  goalId: string;
  name: string;
  emoji: string | null;
  milestones: string[];
}
