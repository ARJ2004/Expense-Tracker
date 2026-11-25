/**
 * Route names and params. Kept in lib (below features) so screens can type their props without
 * importing from navigation/, which sits above them.
 */
export type MainTabParamList = {
  Home: undefined;
  Transactions: undefined;
  Add: undefined;
  Imports: undefined;
  Settings: undefined;
};

export type MainStackParamList = {
  Tabs: undefined;
  TransactionDetail: { id: string };
  Accounts: undefined;
  /** alreadyImportedAt: this exact file was added before (shown as a notice). */
  ImportReview: { id: string; alreadyImportedAt?: string };
  /** Bank SMS, statements and manual entry; explainSms opens the SMS disclosure straight away. */
  DataSources: { explainSms?: boolean } | undefined;
  /** Home's "See all": every category with spend in a month ("YYYY-MM"). */
  CategorySpend: { month: string };
  Categories: undefined;
  Income: undefined;
  DeleteAccount: undefined;
  Goals: undefined;
  GoalDetail: { id: string };
  /** New goal, or edit the one with this id. */
  GoalForm: { id?: string } | undefined;
  Groups: undefined;
  GroupDetail: { id: string };
  /** New group, or edit the one with this id. */
  GroupForm: { id?: string } | undefined;
  /** Add an expense to a group, or edit the one with expenseId. */
  GroupExpenseForm: { groupId: string; expenseId?: string };
  /** Who did what in a group. */
  GroupHistory: { id: string };
  /** Opened from a join link or a typed code. */
  JoinGroup: { code: string };
  Budgets: undefined;
  /** Streak and badges. */
  Rewards: undefined;
  Notifications: undefined;
  NotificationSettings: undefined;
};
