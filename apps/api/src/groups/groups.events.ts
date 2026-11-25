/**
 * Group events, emitted after the write commits. Listeners live in the reacting module
 * (notifications). Each says who to tell, so listeners never read group tables; the actor is
 * never among the recipients.
 */
export const GROUP_EXPENSE_CREATED = 'group.expense.created';
export const GROUP_PAYMENT_CREATED = 'group.payment.created';
export const GROUP_MEMBER_JOINED = 'group.member.joined';
export const GROUP_DELETED = 'group.deleted';
export const GROUP_SETTLED = 'group.settled';

export interface GroupExpenseCreatedEvent {
  groupId: string;
  groupName: string;
  expenseId: string;
  actorUserId: string;
  /** The actor's name in this group. */
  actorName: string;
  description: string;
  amountPaise: number;
  /** Joined members (other than the actor) with a share in it. */
  recipients: { userId: string; sharePaise: number }[];
}

export interface GroupPaymentCreatedEvent {
  groupId: string;
  groupName: string;
  paymentId: string;
  actorUserId: string;
  fromName: string;
  amountPaise: number;
  /** The payee, when they joined and didn't record it themselves. */
  recipientUserId: string | null;
}

export interface GroupMemberJoinedEvent {
  groupId: string;
  groupName: string;
  memberName: string;
  /** The owner, unless the owner is the one joining. */
  recipientUserIds: string[];
}

export interface GroupDeletedEvent {
  groupId: string;
  groupName: string;
  /** Every other joined member. */
  recipientUserIds: string[];
}

/** A payment brought every balance in the group to 0. */
export interface GroupSettledEvent {
  groupId: string;
  actorUserId: string;
}
