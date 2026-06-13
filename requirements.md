# Requirements Document

## Introduction

A personal finance tracker web app that runs entirely in the browser using plain HTML, CSS, and vanilla JavaScript. All data is persisted in the browser's Local Storage — no backend or sign-in required. The app lets users record income and expense transactions, view a running balance, sort their transaction history, set a spending limit with visual warnings, and toggle between a light and dark theme.

Selected optional challenges: **Sort transactions (3)**, **Highlight spending over a set limit (4)**, **Dark/light mode toggle (5)**.

---

## Glossary

- **App**: The personal finance tracker web application.
- **Transaction**: A single financial record consisting of a description, amount, type (income or expense), category, and date.
- **Transaction_List**: The ordered collection of all Transactions stored for the user.
- **Balance**: The running total calculated as the sum of all income amounts minus the sum of all expense amounts.
- **Category**: A label used to classify a Transaction (e.g., Food, Transport, Salary).
- **Spending_Limit**: A user-defined numeric threshold for total expenses in a given period.
- **Storage**: The browser's Local Storage API used to persist all app data client-side.
- **Theme**: The visual colour scheme of the App, either `light` or `dark`.
- **Sort_Order**: The current ordering applied to the Transaction_List (by date, amount ascending, amount descending, or category).
- **Summary_Panel**: The UI section that displays the current Balance, total income, and total expenses.

---

## Requirements

### Requirement 1: Add a Transaction

**User Story:** As a user, I want to add an income or expense transaction with a description, amount, category, and date, so that I can keep a complete record of my finances.

#### Acceptance Criteria

1. THE App SHALL provide a form containing fields for: description (text, max 100 characters), amount (positive number in the range 0.01–999,999,999.99), type (income or expense), category (selectable from a predefined list), and date.
2. WHEN the user submits the form with all required fields filled, no field containing only whitespace, and an amount in the range 0.01–999,999,999.99, THE App SHALL add the Transaction to the Transaction_List and persist it to Storage.
3. WHEN the user submits the form with one or more required fields empty or containing only whitespace, THE App SHALL display an inline validation error adjacent to each invalid field and SHALL NOT add the Transaction.
4. WHEN the user submits the form with an amount that is non-numeric, zero, negative, or greater than 999,999,999.99, THE App SHALL display an inline validation error adjacent to the amount field and SHALL NOT add the Transaction.
5. WHEN a Transaction is successfully added, THE App SHALL clear the form fields and update the Summary_Panel before the next user interaction is processed.

---

### Requirement 2: View Transaction History

**User Story:** As a user, I want to see a list of all my transactions, so that I can review my financial history.

#### Acceptance Criteria

1. THE App SHALL display all Transactions in the Transaction_List on the main page.
2. WHEN the Transaction_List is empty, THE App SHALL display a message indicating that no transactions have been recorded.
3. EACH displayed Transaction SHALL show its description, amount formatted to 2 decimal places (prefixed with "+" for income and "−" for expense), type, category, and date formatted as YYYY-MM-DD.
4. THE App SHALL visually distinguish income Transactions from expense Transactions using both a distinct colour and a text label or icon, so that the distinction does not rely on colour alone.

---

### Requirement 3: Calculate and Display Balance

**User Story:** As a user, I want to see my current balance, total income, and total expenses, so that I know my overall financial position at a glance.

#### Acceptance Criteria

1. THE Summary_Panel SHALL display the current Balance, total income, and total expenses calculated from all Transactions in the Transaction_List.
2. WHEN a Transaction is added or deleted, THE App SHALL recalculate and update the Balance, total income, and total expenses in the Summary_Panel within the same rendering cycle as the action.
3. WHEN the Balance is negative, THE Summary_Panel SHALL display the Balance value in red (colour value #CC0000 or equivalent) AND prefixed with a minus sign to indicate a deficit.

---

### Requirement 4: Delete a Transaction

**User Story:** As a user, I want to delete a transaction, so that I can remove incorrect or unwanted entries.

#### Acceptance Criteria

1. THE App SHALL display a delete control alongside each Transaction in the Transaction_List.
2. WHEN the user activates the delete control for a Transaction, THE App SHALL immediately remove that Transaction from the Transaction_List and from Storage with no confirmation step.
3. WHEN a Transaction is deleted, THE App SHALL update the Summary_Panel within the same rendering cycle as the deletion.
4. WHEN a Storage write error occurs during deletion, THE App SHALL display an error message to the user and SHALL NOT remove the Transaction from the displayed Transaction_List.

---

### Requirement 5: Persist Data Across Sessions

**User Story:** As a user, I want my transaction data to be saved between browser sessions, so that I do not lose my records when I close or refresh the page.

#### Acceptance Criteria

1. WHEN a Transaction is added or deleted, THE App SHALL write the updated Transaction_List to Storage.
2. WHEN the App loads, THE App SHALL read the Transaction_List from Storage and render all persisted Transactions; IF the stored data is corrupted or unreadable, THE App SHALL discard the corrupted data and initialise with an empty Transaction_List.
3. IF no data exists in Storage, THE App SHALL initialise with an empty Transaction_List and a Balance of zero.

---

### Requirement 6: Sort Transactions

**User Story:** As a user, I want to sort my transaction list by amount or category, so that I can quickly find and analyse specific transactions.

#### Acceptance Criteria

1. THE App SHALL provide a visible sort control (dropdown or button group) allowing the user to sort the Transaction_List by: date descending (default, newest first), amount ascending, amount descending, or category (alphabetical).
2. WHEN the user selects a Sort_Order, THE App SHALL reorder the displayed Transaction_List according to that Sort_Order without modifying the persisted order in Storage.
3. WHEN a new Transaction is added while a non-default Sort_Order is active, THE App SHALL insert the new Transaction at its correct position within the current Sort_Order and display the updated list accordingly.
4. WHEN two Transactions have identical values for the active sort key, THE App SHALL use the Transaction's insertion date as a stable secondary sort key (earlier insertions first).

---

### Requirement 7: Highlight Spending Over a Set Limit

**User Story:** As a user, I want to set a spending limit and receive a visual warning when my total expenses exceed it, so that I can stay within my budget.

#### Acceptance Criteria

1. THE App SHALL provide an input field that allows the user to enter a Spending_Limit as a positive number in the range 0.01–999,999,999.99; WHEN the user enters a value outside this range or a non-numeric value, THE App SHALL display an inline validation error and SHALL NOT save the Spending_Limit.
2. WHEN the user saves a valid Spending_Limit, THE App SHALL persist the Spending_Limit to Storage.
3. IF a Spending_Limit has been saved in Storage, THE App SHALL read and apply that Spending_Limit when the App loads.
4. WHILE the total expenses exceed the Spending_Limit, THE App SHALL display a visible warning banner with the text "Spending limit exceeded" and the overage amount.
5. WHEN the Spending_Limit is updated, THE App SHALL re-evaluate whether total expenses exceed the new limit and update the warning indicator immediately.
6. WHEN total expenses fall at or below the Spending_Limit, THE App SHALL hide the warning banner.
7. IF no Spending_Limit has been set, THE App SHALL NOT display the warning banner.

---

### Requirement 8: Dark/Light Mode Toggle

**User Story:** As a user, I want to switch between a dark and light theme, so that I can use the app comfortably in different lighting conditions.

#### Acceptance Criteria

1. THE App SHALL provide a toggle control that switches the Theme between `light` and `dark`.
2. WHEN the user activates the toggle, THE App SHALL apply the selected Theme to the entire page within 100 milliseconds without requiring a reload.
3. WHEN the user activates the toggle, THE App SHALL persist the selected Theme to Storage.
4. WHEN the App loads, THE App SHALL read the Theme from Storage and apply it before the first DOM paint (implemented via an inline script in `<head>`) to prevent a flash of the non-preferred Theme.
5. IF no Theme preference has been saved in Storage, THE App SHALL default to the `light` Theme.
6. IF Storage is unavailable when the App loads, THE App SHALL silently default to the `light` Theme.

---

### Requirement 9: Predefined Transaction Categories

**User Story:** As a user, I want a set of built-in categories to choose from when adding a transaction, so that I can organise my finances without manual category entry.

#### Acceptance Criteria

1. THE App SHALL provide exactly the following predefined categories in this order: Food, Transport, Housing, Entertainment, Health, Salary, Other.
2. WHEN the user opens the category selector, THE App SHALL display all predefined categories as selectable options in the defined order.

---

### Requirement 10: Project Folder Structure

**User Story:** As a developer, I want the project to follow a strict folder and file structure, so that the codebase stays clean, consistent, and easy to maintain.

#### Acceptance Criteria

1. THE App SHALL contain exactly one CSS file located inside a `css/` directory; no additional CSS files SHALL exist anywhere in the project.
2. THE App SHALL contain exactly one JavaScript file located inside a `js/` directory; no additional JavaScript files SHALL exist anywhere in the project.
3. THE App's code SHALL use consistent indentation (2 or 4 spaces), meaningful variable and function names, and inline comments where logic is non-obvious, so that the code is readable and maintainable.

---

### Requirement 11: Responsive and Accessible UI

**User Story:** As a user, I want the app to be usable on both desktop and mobile screens and to be accessible via keyboard navigation, so that I can access my finances from any device.

#### Acceptance Criteria

1. THE App SHALL render in a single-column layout on viewport widths of 480 px or less, and SHALL render without horizontal scrolling, content clipping, or overlapping elements on all viewport widths from 320 px to 1920 px; all controls SHALL remain visible and usable at every supported width.
2. THE App SHALL display a visible focus indicator on every focusable element; Tab and Shift+Tab SHALL cycle through all interactive controls in a logical order; Enter and Space SHALL activate all buttons and toggle controls.
3. THE App SHALL maintain a colour contrast ratio of at least 4.5:1 for normal text and at least 3:1 for large text (18 pt or 14 pt bold) and UI component boundaries, in both the `light` and `dark` Theme, in accordance with WCAG 2.1 AA.
