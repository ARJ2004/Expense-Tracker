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
};
