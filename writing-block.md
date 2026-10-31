# Personal Finance & Expense Tracker
## MVP – Feature Scope and Requirements

**Document Version:** 1.0  
**Status:** Initial MVP Scope  
**Target Market:** India  
**Platform:** Android (First Release)

---

## 1. Product Overview

The application aims to help individuals understand, track and manage their personal finances by automatically aggregating financial transactions from multiple sources into a single platform.

Users currently make payments through UPI applications, bank accounts, debit cards, credit cards and other payment methods. Their financial activity is scattered across different applications and bank statements.

The application will solve this problem by collecting transaction information from supported sources, consolidating it into a unified transaction ledger, automatically categorizing expenses and presenting meaningful financial insights.

### Primary Objective

Provide users with a single dashboard that explains:

- How much money they earn.
- How much money they spend.
- Where their money goes.
- Which categories consume most of their income.
- How their spending changes over time.
- How much money they have available after accounting for expenses.

---

## 2. Technology and Product Decisions

| Area | Decision |
|---|---|
| Initial platform | Android |
| Mobile framework | React Native |
| Native integration | Kotlin native modules |
| Backend | Node.js / NestJS |
| Database | PostgreSQL |
| ORM | Prisma |
| Background processing | AWS SQS + Lambda |
| File storage | AWS S3 |
| Push notifications | Firebase Cloud Messaging |
| Authentication | Secure user authentication |
| Initial data ingestion | SMS, notifications and bank statements |
| Future financial integration | RBI Account Aggregator ecosystem through an eligible partner |
| Initial target audience | Individual users in India |

---

# 3. Feature Scope

## Module 1: User Registration and Onboarding

**Objective:** Allow users to create an account and configure their financial profile.

### Features

1. User registration and login.
2. Secure authentication.
3. Basic user profile management.
4. Monthly income configuration.
5. Income frequency selection:
   - Monthly
   - Weekly
   - Custom
6. Preferred currency (INR initially).
7. Initial financial preferences.

### Permission Management

The application will request permissions only when the corresponding functionality is enabled.

Required permissions may include:

- SMS access for transaction message detection.
- Notification access for financial notification detection.
- File access or document picker access for statement uploads.
- Notification permission for application alerts.

Users must be informed about why each permission is required and what data will be processed.

---

## Module 2: SMS-Based Transaction Tracking

**Priority:** P0/P1

**Objective:** Automatically identify financial transactions from supported bank SMS messages.

### Features

1. Detect incoming SMS messages from supported financial institutions.
2. Identify transaction-related messages.
3. Extract relevant transaction information:
   - Transaction amount.
   - Transaction date and time.
   - Debit or credit.
   - Bank name.
   - Account identifier (masked).
   - Merchant or beneficiary name.
   - UPI reference number.
   - Transaction description.
4. Identify supported transaction types.
5. Ignore unrelated personal messages.
6. Convert extracted messages into normalized transaction records.
7. Sync processed transactions with the backend.
8. Prevent duplicate transaction creation.
9. Maintain ingestion source information.

### Expected Behaviour

When a user makes a payment of ₹500 and receives a bank SMS, the application should automatically identify the transaction and add it to the expense ledger.

**Important:** SMS access will be implemented subject to applicable Google Play permission eligibility and approval.

---

## Module 3: Notification-Based Transaction Tracking

**Priority:** P1

**Objective:** Identify transactions from supported UPI and banking application notifications.

### Supported Application Categories

- Google Pay.
- PhonePe.
- Paytm.
- Banking applications.
- Credit card applications.

### Features

1. Notification listener integration.
2. Maintain a configurable allowlist of supported financial applications.
3. Identify financial transaction notifications.
4. Extract:
   - Transaction amount.
   - Merchant or beneficiary.
   - Transaction date and time.
   - Payment application.
   - Transaction description.
   - Transaction reference, when available.
5. Convert notification data into normalized transactions.
6. Sync transactions with the backend.
7. Handle duplicate transactions originating from SMS and notifications.
8. Allow users to enable or disable notification-based tracking.

### Expected Behaviour

When a user pays ₹450 through Google Pay and receives a payment notification, the application should identify the payment and add it to the transaction ledger.

Notification access must be explicitly enabled by the user.

---

## Module 4: Bank Statement Upload and Processing

**Priority:** P0

**Objective:** Allow users to import historical transactions from their bank statements.

### Supported Formats

- PDF.
- CSV.
- XLSX.

### Features

1. Upload bank statements.
2. Identify supported bank statement formats.
3. Extract transaction information.
4. Parse transaction date.
5. Extract debit and credit amounts.
6. Extract transaction descriptions and narration.
7. Identify account information where available.
8. Normalize extracted records.
9. Detect duplicate transactions.
10. Preview extracted transactions before importing.
11. Allow users to correct incorrectly extracted information.
12. Confirm and import transactions.
13. Maintain upload history.

### Statement Processing Flow

1. User selects a bank statement.
2. Application uploads the document securely.
3. Backend identifies the file format and bank.
4. Extraction engine processes the document.
5. Transaction records are normalized.
6. Duplicate detection is performed.
7. User reviews the extracted records.
8. Confirmed transactions are imported into the ledger.

---

## Module 5: Unified Transaction Management

**Priority:** P0

**Objective:** Consolidate transactions from all supported ingestion sources into one transaction ledger.

### Features

1. Display all transactions in chronological order.
2. Display transaction amount and direction.
3. Show merchant or beneficiary.
4. Display transaction category.
5. Display transaction date.
6. Identify transaction source:
   - SMS.
   - Notification.
   - Bank statement.
   - Manual entry.
   - Future Account Aggregator integration.
7. Search transactions.
8. Filter by:
   - Date range.
   - Amount.
   - Category.
   - Transaction type.
   - Account.
   - Source.
9. View individual transaction details.
10. Edit transaction information.
11. Delete transactions.
12. Add transaction notes.

### Transaction Types

- Debit.
- Credit.
- Refund.
- Transfer.
- Cash withdrawal.
- Cash deposit.

The application should distinguish actual spending from transfers between a user's own accounts.

---

## Module 6: Transaction Deduplication

**Priority:** P0

**Objective:** Ensure that the same financial transaction is not counted multiple times when received through different sources.

### Features

1. Identify transactions with matching bank reference numbers.
2. Match transactions using account, amount, date and direction.
3. Use merchant and timestamp similarity as secondary matching criteria.
4. Identify possible duplicate transactions.
5. Maintain original ingestion source records.
6. Merge confirmed duplicate records into a canonical transaction.
7. Allow manual review of uncertain matches.

### Example

A ₹500 Swiggy payment may appear in:

- Bank SMS.
- Google Pay notification.
- Bank statement.

The application should identify these as potentially representing the same transaction and count the expense only once.

---

## Module 7: Automatic Expense Categorization

**Priority:** P0

**Objective:** Automatically classify transactions into meaningful expense categories.

### Initial Categories

| Category | Examples |
|---|---|
| Food & Dining | Swiggy, Zomato, restaurants |
| Groceries | Blinkit, Zepto, BigBasket |
| Shopping | Amazon, Flipkart, Myntra |
| Transport | Uber, Ola, Rapido |
| Entertainment | Netflix, Spotify, cinemas |
| Bills & Utilities | Electricity, mobile, internet |
| Healthcare | Hospitals, pharmacies |
| Travel | Flights, hotels, bookings |
| Education | Courses, fees, books |
| Rent | House rent |
| Transfers | Person-to-person transfers |
| Income | Salary, freelance income |
| Other | Unclassified transactions |

### Features

1. Automatic merchant identification.
2. Merchant-to-category mapping.
3. Rule-based categorization.
4. User correction of categories.
5. Merchant mapping preferences.
6. Custom category creation.
7. Support for uncategorized transactions.
8. Improve future categorization using user corrections.

The categorization engine should initially use deterministic rules and merchant mappings, with more advanced classification introduced later.

---

## Module 8: Expense Dashboard and Analytics

**Priority:** P0

**Objective:** Provide a consolidated overview of the user's financial activity.

### Dashboard Components

1. Total income.
2. Total expenses.
3. Current month spending.
4. Remaining monthly budget, when configured.
5. Total savings or net cash flow.
6. Recent transactions.
7. Category-wise spending.
8. Daily spending summary.
9. Weekly spending summary.
10. Monthly spending trends.

### Visualizations

- Expense distribution by category.
- Daily spending trend.
- Monthly income versus expenses.
- Highest spending categories.
- Top merchants.
- Monthly comparison.

### Expected Outcome

Users should be able to understand their financial position without manually calculating expenses across multiple banking applications.

---

## Module 9: Budget Management

**Priority:** P1

**Objective:** Allow users to establish spending limits and understand how their expenses compare with their budgets.

### Features

1. Set monthly spending budget.
2. Set category-specific budgets.
3. Configure daily spending targets.
4. Calculate remaining available budget.
5. Track budget utilization.
6. Notify users when spending approaches configured limits.
7. Notify users when budgets are exceeded.

### Budget Calculation

The daily spending allowance should not simply be calculated by dividing monthly income by 30.

The application should consider:

- Monthly income.
- Fixed expenses.
- Savings allocation.
- Loan repayments.
- Other financial commitments.
- Available discretionary income.

The system should calculate a realistic spending allowance based on the user's financial preferences.

---

## Module 10: Notifications and Spending Summaries

**Priority:** P1

**Objective:** Keep users informed about their financial activity.

### Features

1. Daily spending summary.
2. Transaction confirmation notifications.
3. Budget threshold notifications.
4. Unusual spending alerts.
5. Weekly spending summary.
6. Monthly spending summary.

### Example Daily Notification

"Your daily spending target was ₹3,333.

Today's spending: ₹2,200.

You stayed within your target by ₹1,133."

Notifications should be configurable to avoid unnecessary interruptions.

---

# 4. Future Feature Scope

These features are intentionally excluded from the initial release.

## Module 11: Account Aggregator Integration

**Priority:** Future Phase

**Objective:** Enable consent-based retrieval of financial information from supported banks through India's Account Aggregator ecosystem.

### Features

1. Account linking.
2. Bank selection.
3. Consent management.
4. Financial data retrieval through an eligible FIU arrangement.
5. Bank account identification.
6. Transaction synchronization.
7. Historical transaction retrieval where supported.
8. Account synchronization status.
9. Consent revocation.
10. Transaction deduplication with existing records.

Potential integration partners to evaluate:

- Setu.
- Finvu.
- Other eligible Account Aggregator ecosystem participants.

Integration is subject to partner eligibility, contractual requirements and regulatory compliance.

## Module 12: Subscription Detection

**Priority:** Future Phase

1. Identify recurring payments.
2. Detect monthly subscriptions.
3. Identify subscription amounts.
4. Display upcoming recurring expenses.
5. Track subscription spending.
6. Notify users about recurring charges.

## Module 13: Advanced Financial Insights

**Priority:** Future Phase

1. Identify spending patterns.
2. Compare month-on-month spending.
3. Identify unusual expenses.
4. Estimate monthly expenditure.
5. Identify potential savings opportunities.
6. Generate personalized spending recommendations.

---

# 5. MVP Release Boundaries

The first release should focus on accurate transaction aggregation rather than advanced financial intelligence.

### Must Have

- User onboarding.
- Income configuration.
- Bank statement uploads.
- Transaction extraction.
- SMS transaction parsing, subject to permission approval.
- Transaction ledger.
- Deduplication.
- Expense categorization.
- Dashboard and basic analytics.
- Manual transaction entry and correction.

### Should Have

- Notification parsing.
- Transaction search and filtering.
- Daily spending summaries.
- Budget configuration.
- Category-specific budgets.

### Future

- Account Aggregator integration.
- Subscription detection.
- Advanced financial intelligence.
- Predictive expense analytics.
- Multi-account financial planning.

---

# 6. Key Product Success Metrics

The MVP should be evaluated using the following metrics:

| Metric | What it measures |
|---|---|
| Transaction capture rate | Percentage of actual transactions successfully captured |
| Categorization accuracy | Percentage of transactions correctly categorized |
| Duplicate rate | Percentage of duplicate transactions remaining in the ledger |
| Import success rate | Percentage of successful statement imports |
| User correction rate | Percentage of transactions requiring manual correction |
| Weekly active users | Users regularly using the application |
| Retention | Users continuing to use the application |
| Data source adoption | Number of ingestion methods activated per user |

The most important initial metric is transaction capture accuracy across the available sources.

---

# 7. Final Product Direction

The first release will establish a reliable personal financial transaction aggregation platform for Indian users.

The product will begin by collecting transactions from SMS messages, supported financial application notifications and uploaded bank statements.

All transactions will flow through a common processing pipeline that handles extraction, normalization, deduplication and categorization before displaying the results in a unified financial dashboard.

The Account Aggregator ecosystem will be explored as a subsequent integration to improve automation and reduce dependence on device-level data collection.

**Core product philosophy:**

Users should not have to manually record every expense to understand where their money goes.

The application should do the heavy lifting and make personal financial management simple, transparent and accessible.