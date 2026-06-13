# Implementation Plan: Personal Finance Tracker

## Overview

Build a single-page personal finance tracker using plain HTML, CSS, and vanilla JavaScript following the MVC-like architecture defined in the design. Implementation proceeds in layers: project skeleton → Store → Validator → Sorter → View → Controller → wiring → accessibility polish. Property-based tests (fast-check) are placed immediately after the pure functions they verify to catch regressions early.

---

## Tasks

- [x] 1. Set up project skeleton and constants
  - Create `index.html` at the root with all required DOM sections: `#summary-panel`, `#spending-banner`, `#spending-limit`, `#sort-control`, `#transaction-form`, `#transaction-list`, `#theme-toggle`
  - Add an inline `<script>` in `<head>` that reads `pft_theme` from `localStorage` and applies the theme class to `<html>` before paint (prevents flash)
  - Create `css/styles.css` with CSS custom properties for light/dark themes, base layout, and WCAG 2.1 AA colour tokens
  - Create `js/app.js` with section comment scaffolding: `// === CONSTANTS ===`, `// === STORE ===`, `// === VALIDATOR ===`, `// === SORTER ===`, `// === VIEW ===`, `// === CONTROLLER ===`
  - Define `CATEGORIES`, `SORT_ORDERS`, and `STORAGE_KEYS` constants
  - Populate the category `<select>` in the form with all 7 predefined options in the required order (Food, Transport, Housing, Entertainment, Health, Salary, Other)
  - _Requirements: 9.1, 9.2, 10.1, 10.2, 8.4_

- [x] 2. Implement the Store module
  - [x] 2.1 Implement `AppState` initialisation and `Store.load()`
    - Define the `AppState` object (`transactions`, `spendingLimit`, `theme`, `sortOrder`)
    - Implement `Store.load()`: reads `pft_transactions`, `pft_spending_limit`, and `pft_theme` from `localStorage` inside a `try/catch`; handles corrupted JSON and non-array results by silently falling back to empty defaults
    - _Requirements: 5.2, 5.3, 7.3, 8.4, 8.5, 8.6_

  - [x] 2.2 Implement `Store.save()`, `Store.addTransaction()`, and `Store.deleteTransaction()`
    - `Store.save()`: serialises `AppState.transactions` and `AppState.spendingLimit` to `localStorage` inside a `try/catch`; on write failure, throws so the Controller can call `View.showStorageError()`
    - `Store.addTransaction(t)`: pushes to `AppState.transactions`, calls `Store.save()`
    - `Store.deleteTransaction(id)`: filters out the matching transaction, calls `Store.save()`
    - Implement UUID generation via `crypto.randomUUID()` with a `Math.random()`/`Date.now()` fallback
    - _Requirements: 1.2, 4.2, 5.1_

  - [x] 2.3 Implement `Store.setSpendingLimit()`, `Store.setTheme()`, and `Store.setSortOrder()`
    - `Store.setSpendingLimit(n)`: updates `AppState.spendingLimit`, persists `pft_spending_limit`
    - `Store.setTheme(theme)`: updates `AppState.theme`, persists `pft_theme`
    - `Store.setSortOrder(order)`: updates `AppState.sortOrder` (in-memory only, not persisted)
    - _Requirements: 7.2, 8.3, 6.2_

  - [x] 2.4 Write property test for Store persistence round-trip (Property 9)
    - **Property 9: Data persistence round-trip**
    - Use `fc.record` to generate random valid `{ transactions: Transaction[], spendingLimit: number | null }` states, call `Store.save()` then `Store.load()`, assert deep equality
    - **Validates: Requirements 5.1, 5.2, 7.2, 7.3**

  - [x] 2.5 Write property test for theme persistence round-trip (Property 14)
    - **Property 14: Theme persistence round-trip**
    - Use `fc.constantFrom('light', 'dark')`, call `Store.setTheme()`, read `localStorage.getItem('pft_theme')`, assert equality
    - **Validates: Requirements 8.3**

  - [x] 2.6 Write property test for delete removes from state and storage (Property 8)
    - **Property 8: Deleting a transaction removes it from state and storage**
    - Generate a non-empty `Transaction[]`, pick a random transaction by index, call `Store.deleteTransaction(id)`, assert the id is absent from `AppState.transactions` and from the parsed `localStorage` value; all other transactions remain present
    - **Validates: Requirements 4.2, 5.1**

- [x] 3. Implement the Validator module
  - [x] 3.1 Implement `Validator.validateTransaction(fields)`
    - Validate `description`: non-empty, not whitespace-only, max 100 chars
    - Validate `amount`: numeric, in range 0.01–999,999,999.99 (store as `Math.round(amount * 100) / 100`)
    - Validate `type`: one of `'income'` | `'expense'`
    - Validate `category`: one of the 7 predefined values
    - Validate `date`: non-empty, valid ISO 8601 YYYY-MM-DD
    - Return `{ valid: boolean, errors: FieldErrors }` with per-field error messages
    - _Requirements: 1.1, 1.3, 1.4_

  - [x] 3.2 Write property test for whitespace-only descriptions rejected (Property 2)
    - **Property 2: Whitespace-only descriptions are rejected by validation**
    - Use `fc.stringOf(fc.constantFrom(' ', '\t', '\n'))` with `minLength: 1` to generate whitespace-only strings; assert `Validator.validateTransaction({ description: s, ... }).valid === false`
    - **Validates: Requirements 1.3**

  - [x] 3.3 Write property test for invalid amounts rejected (Property 3)
    - **Property 3: Invalid amounts are rejected by validation**
    - Use `fc.oneof(fc.constant(0), fc.double({ max: -0.01 }), fc.double({ min: 1e9 }), fc.constant(NaN), fc.string())` to generate invalid amounts; assert validator rejects each
    - **Validates: Requirements 1.4**

  - [x] 3.4 Implement `Validator.validateSpendingLimit(raw)`
    - Validate: numeric, in range 0.01–999,999,999.99
    - Return `{ valid: boolean, error?: string }`
    - _Requirements: 7.1_

  - [x] 3.5 Write property test for invalid spending limit values rejected (Property 13)
    - **Property 13: Invalid spending limit values are rejected**
    - Use `fc.oneof(fc.constant(0), fc.double({ max: -0.01 }), fc.double({ min: 1e9 }), fc.constant(NaN), fc.string())` to generate invalid inputs; assert `Validator.validateSpendingLimit(v).valid === false`
    - **Validates: Requirements 7.1**

- [x] 4. Checkpoint — ensure Validator and Store tests pass
  - Run all property and unit tests written so far; ensure all pass before proceeding.

- [x] 5. Implement the Sorter module
  - [x] 5.1 Implement `Sorter.sort(transactions, order)`
    - Return a **new** sorted array (do not mutate the source)
    - Sort by `date-desc` (default), `amount-asc`, `amount-desc`, `category-asc`
    - Use `insertedAt` as a stable secondary sort key (earlier insertions first) on all key ties
    - _Requirements: 6.1, 6.2, 6.4_

  - [x] 5.2 Write property test for sort correctness and non-mutation (Property 10)
    - **Property 10: Sort correctness and non-mutation**
    - Use `fc.array(transactionArbitrary)` and `fc.constantFrom(...Object.values(SORT_ORDERS))`; after `Sorter.sort(arr, order)`, assert: (1) original array is not mutated, (2) result length equals input length, (3) adjacent pairs satisfy the sort comparator for the given order
    - **Validates: Requirements 6.2**

  - [x] 5.3 Write property test for stable sort on key ties (Property 11)
    - **Property 11: Stable sort by insertedAt on key ties**
    - Generate pairs of transactions with identical primary key values but differing `insertedAt`; assert the one with smaller `insertedAt` appears first in the sorted output for all sort orders
    - **Validates: Requirements 6.4**

- [x] 6. Implement the View module
  - [x] 6.1 Implement `View.renderSummary(balance, income, expenses)`
    - Format all values to 2 decimal places
    - Apply deficit CSS class (red `#CC0000`) and minus prefix when balance is negative
    - _Requirements: 3.1, 3.3_

  - [x] 6.2 Implement `View.renderTransactions(transactions)`
    - Render one `<li>` per transaction; each item shows description, formatted amount (`+` / `−` prefix), type label, category, date (YYYY-MM-DD), and a delete `<button>` with `data-id`
    - Use distinct colour + text label to visually distinguish income from expense (colour not the sole differentiator)
    - When the array is empty, display the "no transactions recorded" message
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 4.1_

  - [x] 6.3 Write property test for transaction list rendering completeness (Property 4)
    - **Property 4: Transaction list rendering completeness**
    - Use `fc.array(transactionArbitrary, { minLength: 1, maxLength: 50 })`; call `View.renderTransactions(arr)`, count `<li>` elements and delete controls in the DOM; assert counts equal `arr.length`
    - **Validates: Requirements 2.1, 4.1**

  - [x] 6.4 Write property test for transaction display formatting (Property 5)
    - **Property 5: Transaction display formatting**
    - Use `fc.record` to generate valid transactions; call `View.renderTransactions([t])`; assert the rendered text contains the amount formatted to 2 decimal places with `+`/`−` prefix and the date in YYYY-MM-DD format
    - **Validates: Requirements 2.3**

  - [x] 6.5 Implement `View.renderSpendingBanner(expenses, limit)`
    - Show banner with "Spending limit exceeded" text and overage amount when `limit !== null && expenses > limit`
    - Hide banner in all other cases
    - _Requirements: 7.4, 7.6, 7.7_

  - [x] 6.6 Write property test for spending limit banner visibility (Property 12)
    - **Property 12: Spending limit banner visibility matches overage condition**
    - Use `fc.double({ min: 0 })` for expenses, `fc.option(fc.double({ min: 0.01 }))` for limit; call `View.renderSpendingBanner(expenses, limit)`; assert banner is visible iff `limit !== null && expenses > limit`
    - **Validates: Requirements 7.4, 7.5, 7.6, 7.7**

  - [x] 6.7 Implement `View.renderValidationErrors(errors)`, `View.clearForm()`, `View.applyTheme(theme)`, and `View.showStorageError(message)`
    - `renderValidationErrors`: inject inline error messages adjacent to each invalid field
    - `clearForm`: reset all form fields to default
    - `applyTheme`: toggle `data-theme` attribute on `<html>` within 100 ms
    - `showStorageError`: display a visible error message to the user
    - _Requirements: 1.3, 1.4, 1.5, 4.4, 8.2_

- [x] 7. Checkpoint — ensure View tests pass and DOM structure is correct
  - Run all View property and unit tests; verify DOM sections exist with correct IDs; ensure all pass before proceeding.

- [x] 8. Implement the Controller and wire everything together
  - [x] 8.1 Implement `Controller.init()`
    - Call `Store.load()`, compute derived values, call `View.renderSummary()`, `View.renderTransactions(Sorter.sort(...))`, `View.renderSpendingBanner()`, `View.applyTheme()`
    - Attach all event listeners (form submit, delete clicks via delegation, sort change, spending limit save, theme toggle)
    - _Requirements: 5.2, 5.3, 6.1, 8.4, 8.5_

  - [x] 8.2 Implement `Controller.onFormSubmit(event)`
    - Prevent default; read form fields; call `Validator.validateTransaction()`
    - On invalid: call `View.renderValidationErrors()`; on valid: build Transaction object (with UUID and `insertedAt: Date.now()`), call `Store.addTransaction()`, recompute derived values, call `View.renderSummary()`, `View.renderTransactions(Sorter.sort(...))`, `View.renderSpendingBanner()`, `View.clearForm()`
    - On storage write error: call `View.showStorageError()`
    - _Requirements: 1.2, 1.3, 1.4, 1.5, 3.2, 6.3_

  - [x] 8.3 Write property test for valid transaction addition reflected in state and storage (Property 1)
    - **Property 1: Valid transaction addition is reflected in state and storage**
    - Use `fc.record` to generate valid transaction field sets; call `Controller.onFormSubmit()` equivalent (or call `Store.addTransaction()` directly after validation passes); assert the transaction appears in `AppState.transactions` and in `JSON.parse(localStorage.getItem('pft_transactions'))`
    - **Validates: Requirements 1.2, 5.1**

  - [x] 8.4 Implement `Controller.onDeleteClick(transactionId)`
    - Call `Store.deleteTransaction(id)`, recompute derived values, call `View.renderSummary()`, `View.renderTransactions(Sorter.sort(...))`, `View.renderSpendingBanner()`
    - On storage write error: call `View.showStorageError()` and do NOT remove from displayed list
    - _Requirements: 4.2, 4.3, 4.4_

  - [x] 8.5 Implement `Controller.onSortChange(order)`, `Controller.onSpendingLimitSave()`, and `Controller.onThemeToggle()`
    - `onSortChange`: call `Store.setSortOrder()`, re-render transaction list with new order
    - `onSpendingLimitSave`: call `Validator.validateSpendingLimit()`; on valid: call `Store.setSpendingLimit()`, re-evaluate and update spending banner; on invalid: show inline error
    - `onThemeToggle`: call `Store.setTheme()`, call `View.applyTheme()`
    - _Requirements: 6.2, 7.1, 7.2, 7.5, 8.2, 8.3_

  - [x] 8.6 Write property test for summary arithmetic correctness (Property 6)
    - **Property 6: Summary calculations are arithmetically correct**
    - Use `fc.array(transactionArbitrary)`; compute `totalIncome`, `totalExpenses`, `balance` independently; assert they equal the values produced by the summary calculation logic
    - **Validates: Requirements 3.1**

  - [x] 8.7 Write property test for negative balance indication (Property 7)
    - **Property 7: Negative balance is consistently indicated**
    - Generate transaction arrays where sum of expenses > sum of income; call `View.renderSummary(balance, income, expenses)`; assert the balance element contains a minus prefix AND has the deficit CSS class
    - **Validates: Requirements 3.3**

- [x] 9. Implement responsive layout and WCAG 2.1 AA accessibility
  - [x] 9.1 Complete `css/styles.css` responsive layout
    - Single-column layout at ≤ 480 px using media queries; no horizontal scroll, content clipping, or overlapping from 320 px to 1920 px
    - CSS custom properties for all theme colour tokens; dark/light theme variants via `[data-theme="dark"]` selector
    - Ensure contrast ratios ≥ 4.5:1 (normal text) and ≥ 3:1 (large text / UI components) in both themes
    - _Requirements: 11.1, 11.3_

  - [x] 9.2 Implement keyboard navigation and focus indicators
    - Add visible `:focus-visible` styles to every focusable element
    - Verify logical Tab / Shift+Tab order through all interactive controls
    - Ensure all buttons and toggles respond to Enter and Space key events
    - Add `aria-live="polite"` to `#spending-banner` and validation error containers; add appropriate `aria-label` / `role` attributes
    - _Requirements: 11.2_

- [x] 10. Final checkpoint — full integration and test pass
  - Run all property-based tests (minimum 100 iterations each) and unit/example-based tests
  - Verify: empty-list message, zero balance display, null spending limit (no banner), theme default when storage empty, corrupted JSON silent recovery, storage write failure error message
  - Ensure all tests pass; ask the user if any questions arise before considering the implementation complete.

---

## Notes

- Tasks marked with `*` are optional and can be skipped for a faster MVP
- Each task references specific requirements for traceability
- Checkpoints (tasks 4, 7, 10) ensure incremental validation at natural boundaries
- Property tests use **fast-check** loaded via CDN in a test HTML file; they target the pure functions (`Validator`, `Sorter`, summary calculation, `View` render helpers) and the Store persistence layer
- Unit tests cover concrete edge cases and DOM structure checks not easily expressed as properties
- Amount precision: always use `Math.round(amount * 100) / 100` at input time and `Number.toFixed(2)` for display

---

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["2.1"] },
    { "id": 1, "tasks": ["2.2", "2.3", "3.1", "3.4"] },
    { "id": 2, "tasks": ["2.4", "2.5", "2.6", "3.2", "3.3", "3.5", "5.1"] },
    { "id": 3, "tasks": ["5.2", "5.3", "6.1", "6.2", "6.5", "6.7"] },
    { "id": 4, "tasks": ["6.3", "6.4", "6.6", "8.1"] },
    { "id": 5, "tasks": ["8.2", "8.4", "8.5", "9.1"] },
    { "id": 6, "tasks": ["8.3", "8.6", "8.7", "9.2"] }
  ]
}
```
