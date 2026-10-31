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
  /** Home's "See all": every category with spend in a month ("YYYY-MM"). */
  CategorySpend: { month: string };
  Categories: undefined;
  Income: undefined;
  DeleteAccount: undefined;
};
