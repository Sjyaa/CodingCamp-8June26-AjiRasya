# Design Document: Personal Finance Tracker

## Overview

The personal finance tracker is a single-page web application that runs entirely in the browser using plain HTML, CSS, and vanilla JavaScript — no build tools, frameworks, or backend required. All data is stored in the browser's `localStorage` API.

The app allows users to:
- Record income and expense transactions (description, amount, type, category, date)
- View a sorted transaction history
- Monitor a running balance, total income, and total expenses
- Delete unwanted transactions
- Set a spending limit with a visual overage warning
- Toggle between light and dark themes (applied before the first DOM paint)

The project uses a minimal file structure: one HTML file at the root, one CSS file in `css/`, and one JavaScript file in `js/`.

---

## Architecture

The app follows a simple **MVC-like pattern** with no framework dependency:

```
┌─────────────────────────────────────────────┐
│                   index.html                │
│  (markup + inline <head> script for theme)  │
└─────────────┬───────────────────────────────┘
              │ loads
┌─────────────▼───────────────────────────────┐
│              js/app.js                      │
│                                             │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  │
│  │  Store   │  │Controller│  │   View   │  │
│  │(Storage) │◄─│          │─►│ (DOM ops)│  │
│  └──────────┘  └──────────┘  └──────────┘  │
└─────────────────────────────────────────────┘
              │ loads
┌─────────────▼───────────────────────────────┐
│              css/styles.css                 │
│  (CSS custom properties for theming,        │
│   responsive layout, WCAG 2.1 AA colours)   │
└─────────────────────────────────────────────┘
```

**Data flow:**
1. User interacts with a form or button in the DOM (View layer).
2. An event handler in the Controller reads the input, validates it, and calls the Store.
3. The Store mutates the in-memory state and writes to `localStorage`.
4. The Controller calls the View to re-render the affected UI sections.

All application state lives in a single in-memory object (`AppState`) that mirrors `localStorage`. There is no reactive framework; every state mutation is followed by an explicit render call.

---

## Components and Interfaces

### File: `index.html`

```
<head>
  <script>           ← inline theme bootstrap (reads localStorage before paint)
</head>
<body>
  #summary-panel     ← balance, total income, total expenses
  #spending-banner   ← warning banner (hidden by default)
  #spending-limit    ← limit input + save button
  #sort-control      ← sort dropdown
  #transaction-form  ← add-transaction form
  #transaction-list  ← rendered list of transactions
  #theme-toggle      ← button to toggle dark/light
</body>
```

### Module: `js/app.js`

The single JS file is organised into four logical sections via comments (no ES modules are required at this scope):

#### 1. Store

Responsible for all `localStorage` interaction and in-memory state.

```
AppState {
  transactions: Transaction[]   // master array (insertion order)
  spendingLimit: number | null
  theme: 'light' | 'dark'
  sortOrder: SortOrder
}

Store.load()          → reads localStorage, populates AppState
Store.save()          → serialises AppState.transactions + spendingLimit to localStorage
Store.addTransaction(t: Transaction) → void
Store.deleteTransaction(id: string)  → void
Store.setSpendingLimit(n: number)    → void
Store.setTheme(theme: string)        → void
Store.setSortOrder(order: SortOrder) → void
```

#### 2. Validator

Pure functions; no side effects.

```
Validator.validateTransaction(fields) → { valid: boolean, errors: FieldErrors }
Validator.validateSpendingLimit(raw)  → { valid: boolean, error?: string }
```

#### 3. Sorter

Pure function; returns a new sorted array without mutating the source.

```
Sorter.sort(transactions: Transaction[], order: SortOrder) → Transaction[]
```

#### 4. View

DOM manipulation only; never reads from `localStorage` directly.

```
View.renderSummary(balance, income, expenses)
View.renderTransactions(transactions: Transaction[])
View.renderSpendingBanner(expenses, limit)
View.renderValidationErrors(errors: FieldErrors)
View.clearForm()
View.applyTheme(theme: string)
View.showStorageError(message: string)
```

#### 5. Controller (init + event handlers)

Wires together Store, Validator, Sorter, and View.

```
Controller.init()
Controller.onFormSubmit(event)
Controller.onDeleteClick(transactionId)
Controller.onSortChange(order)
Controller.onSpendingLimitSave()
Controller.onThemeToggle()
```

---

## Data Models

### Transaction

```js
{
  id:          string,    // UUID v4 (crypto.randomUUID or fallback)
  description: string,    // 1–100 chars, non-whitespace-only
  amount:      number,    // 0.01–999999999.99, stored as JS number
  type:        'income' | 'expense',
  category:    Category,  // one of the 7 predefined values
  date:        string,    // ISO 8601 date: YYYY-MM-DD
  insertedAt:  number     // Date.now() at insertion — stable secondary sort key
}
```

### Category (enum-like constant)

```js
const CATEGORIES = ['Food', 'Transport', 'Housing', 'Entertainment', 'Health', 'Salary', 'Other'];
```

### SortOrder (enum-like constant)

```js
const SORT_ORDERS = {
  DATE_DESC:    'date-desc',      // default
  AMOUNT_ASC:   'amount-asc',
  AMOUNT_DESC:  'amount-desc',
  CATEGORY_ASC: 'category-asc'
};
```

### AppState (in-memory)

```js
{
  transactions:  Transaction[],       // master array; never mutated by Sorter
  spendingLimit: number | null,
  theme:         'light' | 'dark',
  sortOrder:     SortOrder
}
```

### localStorage Schema

```
Key                            Value
─────────────────────────────────────────────────────────────
pft_transactions               JSON string → Transaction[]
pft_spending_limit             JSON string → number
pft_theme                      'light' | 'dark'
```

`sortOrder` is not persisted (resets to `DATE_DESC` on each page load).

### Derived Values (computed on every render, not stored)

```
totalIncome   = sum of amount where type === 'income'
totalExpenses = sum of amount where type === 'expense'
balance       = totalIncome − totalExpenses
```

---

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system — essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*


### Property 1: Valid transaction addition is reflected in state and storage

*For any* valid transaction (non-empty description, amount in 0.01–999,999,999.99, valid type, valid category, valid date), adding it to the app SHALL result in the transaction appearing in `AppState.transactions` and in the serialized value retrieved from `localStorage` under `pft_transactions`.

**Validates: Requirements 1.2, 5.1**

---

### Property 2: Whitespace-only descriptions are rejected by validation

*For any* string composed entirely of whitespace characters (spaces, tabs, newlines), the validator SHALL reject it as an invalid description, and the transaction SHALL NOT be added to the list.

**Validates: Requirements 1.3**

---

### Property 3: Invalid amounts are rejected by validation

*For any* amount value that is zero, negative, greater than 999,999,999.99, or non-numeric, the validator SHALL reject it, and no transaction with that amount SHALL be added to the list.

**Validates: Requirements 1.4**

---

### Property 4: Transaction list rendering completeness

*For any* non-empty array of transactions, rendering the transaction list SHALL produce exactly one list item per transaction, and each list item SHALL contain a delete control element.

**Validates: Requirements 2.1, 4.1**

---

### Property 5: Transaction display formatting

*For any* transaction, the rendered output SHALL display the amount formatted to exactly 2 decimal places, prefixed with "+" for income and "−" for expense, and the date formatted as YYYY-MM-DD.

**Validates: Requirements 2.3**

---

### Property 6: Summary calculations are arithmetically correct

*For any* list of transactions, the calculated `totalIncome` SHALL equal the sum of all income transaction amounts, `totalExpenses` SHALL equal the sum of all expense transaction amounts, and `balance` SHALL equal `totalIncome − totalExpenses`.

**Validates: Requirements 3.1**

---

### Property 7: Negative balance is consistently indicated

*For any* list of transactions where total expenses exceed total income (resulting in a negative balance), the summary display SHALL show the balance prefixed with a minus sign and apply the deficit CSS class (red colour #CC0000 or equivalent).

**Validates: Requirements 3.3**

---

### Property 8: Deleting a transaction removes it from state and storage

*For any* non-empty transaction list, deleting a transaction by its `id` SHALL result in that transaction being absent from both `AppState.transactions` and the serialized value in `localStorage`, while all other transactions remain present.

**Validates: Requirements 4.2, 5.1**

---

### Property 9: Data persistence round-trip

*For any* valid application state (transaction list and spending limit), serializing the state to `localStorage` and then loading it back via `Store.load()` SHALL produce an in-memory state whose transactions are deeply equal to the original and whose spending limit equals the original.

**Validates: Requirements 5.1, 5.2, 7.2, 7.3**

---

### Property 10: Sort correctness and non-mutation

*For any* array of transactions and any valid sort order, `Sorter.sort()` SHALL return a new array that is correctly ordered by the specified sort key WITHOUT mutating the original array.

**Validates: Requirements 6.2**

---

### Property 11: Stable sort by insertedAt on key ties

*For any* two transactions that share the same primary sort key value, the one with the smaller `insertedAt` timestamp SHALL appear before the other in the sorted result for all sort orders.

**Validates: Requirements 6.4**

---

### Property 12: Spending limit banner visibility matches overage condition

*For any* total expense amount and any spending limit value (or null), the warning banner SHALL be visible if and only if the spending limit is set AND total expenses strictly exceed the spending limit; in all other cases the banner SHALL be hidden.

**Validates: Requirements 7.4, 7.5, 7.6, 7.7**

---

### Property 13: Invalid spending limit values are rejected

*For any* spending limit input that is zero, negative, greater than 999,999,999.99, or non-numeric, the validator SHALL reject it and the spending limit in storage SHALL remain unchanged.

**Validates: Requirements 7.1**

---

### Property 14: Theme persistence round-trip

*For any* theme value ('light' or 'dark'), calling `Store.setTheme()` followed by reading `localStorage` SHALL return that same theme value.

**Validates: Requirements 8.3**

---

## Error Handling

### localStorage Unavailable

`localStorage` can be unavailable (e.g., private-browsing quotas, security restrictions). All Store methods that access `localStorage` SHALL be wrapped in `try/catch`:

- **On initial load failure**: silently default to empty state + light theme.
- **On write failure during add/delete**: show a user-visible error message (via `View.showStorageError()`) and leave the in-memory state unchanged so the UI is not corrupted.

### Corrupted Storage Data

When `Store.load()` reads `pft_transactions` or `pft_spending_limit`, it SHALL attempt `JSON.parse`. If parsing throws or the result is not an array (for transactions) or number (for spending limit), the app SHALL:
- Discard the corrupted value.
- Initialise with an empty `Transaction_List` and `null` spending limit.
- Continue normally without showing an error to the user (silent recovery per Requirement 5.2).

### Transaction ID Generation

`crypto.randomUUID()` is used for generating transaction IDs. If unavailable (very old browsers), a fallback using `Math.random()` and `Date.now()` SHALL be used to produce a pseudo-unique string in the same format.

### Amount Precision

JavaScript floating-point arithmetic can introduce rounding errors when summing many decimal amounts. All display values SHALL be formatted using `Number.toFixed(2)` with the parsed float rounded to 2 decimal places at input time (e.g., `Math.round(amount * 100) / 100`), preventing drift over many additions.

---

## Testing Strategy

### Assessment: Is Property-Based Testing Applicable?

Yes. The app has several pure functions with well-defined input/output behavior that benefit from property-based testing:
- `Validator.validateTransaction` and `Validator.validateSpendingLimit` — pure input validation functions
- `Sorter.sort` — a pure sorting function
- Balance/summary calculation — a pure arithmetic function
- Storage serialization/deserialization — a round-trip property
- Banner visibility logic — a pure conditional function
- Amount and date formatting — pure formatting functions

PBT is not appropriate for DOM rendering structure checks, theme CSS application, or the inline `<head>` script — those use example-based tests.

### Recommended PBT Library

**fast-check** (JavaScript) — runs in the browser or Node.js, requires no build step when loaded via CDN for testing, and generates values for all required input types (strings, numbers, arrays, enums).

### Unit / Example-Based Tests

Focus on:
- Specific edge cases: empty transaction list message, zero balance display, null spending limit, theme default when storage is empty, storage write failure behavior, corrupted JSON recovery.
- DOM structural checks: form fields exist, sort control has correct options, categories in correct order, delete control present on each item.
- Integration points: Controller → Store → View flow for add, delete, and sort.

### Property-Based Tests

Each property test SHALL run a minimum of **100 iterations**. Each test SHALL include a comment tag in the format:

```
// Feature: personal-finance-tracker, Property N: <property_text>
```

| Property | Description | Generator Inputs |
|---|---|---|
| 1 | Valid transaction add → state + storage | Random valid Transaction objects |
| 2 | Whitespace descriptions rejected | Random whitespace-only strings |
| 3 | Invalid amounts rejected | Random values outside [0.01, 999,999,999.99] |
| 4 | Rendering completeness + delete controls | Random Transaction[] of length 1–50 |
| 5 | Transaction display formatting | Random Transaction objects |
| 6 | Summary arithmetic correctness | Random Transaction[] of mixed types |
| 7 | Negative balance CSS indication | Random Transaction[] where expenses > income |
| 8 | Delete removes from state + storage | Random Transaction[] + random pick for deletion |
| 9 | Persistence round-trip | Random valid AppState |
| 10 | Sort correctness + non-mutation | Random Transaction[], random SortOrder |
| 11 | Stable sort on key ties | Transaction pairs with identical primary key, differing insertedAt |
| 12 | Banner visibility ≡ (expenses > limit) | Random expense totals, random limits including null |
| 13 | Invalid spending limit rejected | Random invalid limit values |
| 14 | Theme persistence round-trip | Arbitrary of 'light', 'dark' |

### Dual Testing Approach Summary

- **Unit tests** cover specific examples, edge cases (empty list, null limit, corrupted storage, storage errors), DOM structure checks, and accessibility/keyboard behavior.
- **Property tests** cover universal behavioral guarantees that hold across the full input space.
- Together they provide comprehensive coverage: unit tests catch concrete regressions, property tests verify general correctness.
