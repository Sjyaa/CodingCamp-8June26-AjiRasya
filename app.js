// Personal Finance Tracker — app.js
// Single-file MVC-like architecture: Constants → Store → Validator → Sorter → View → Controller

'use strict';

// =============================================================================
// === UUID GENERATION ===
// =============================================================================

/**
 * Generates a UUID v4 string.
 * Prefers the browser-native `crypto.randomUUID()` (available in all modern
 * browsers). Falls back to a pseudo-UUID built from `Math.random()` and
 * `Date.now()` for environments where `crypto.randomUUID` is unavailable.
 *
 * @returns {string} A UUID v4 formatted string.
 */
function generateId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  // Fallback: pseudo-UUID v4 built from Math.random() + Date.now()
  // Uses Date.now() to seed the first group for extra uniqueness.
  const now = Date.now();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c, index) => {
    // Mix Date.now() bits into the first 8 chars, then pure Math.random()
    const r = (index < 8)
      ? (now >> (index * 4) ^ Math.random() * 16) & 0xf
      : Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

// =============================================================================
// === CONSTANTS ===
// =============================================================================

/**
 * Predefined transaction categories (Requirement 9.1).
 * Must remain in this exact order: Food, Transport, Housing, Entertainment,
 * Health, Salary, Other.
 */
const CATEGORIES = [
  'Food',
  'Transport',
  'Housing',
  'Entertainment',
  'Health',
  'Salary',
  'Other',
];

/**
 * Available sort orders for the transaction list (Requirement 6.1).
 */
const SORT_ORDERS = {
  DATE_DESC:    'date-desc',    // default — newest first
  AMOUNT_ASC:   'amount-asc',   // lowest amount first
  AMOUNT_DESC:  'amount-desc',  // highest amount first
  CATEGORY_ASC: 'category-asc', // alphabetical by category
};

/**
 * localStorage key names for all persisted values.
 */
const STORAGE_KEYS = {
  TRANSACTIONS:  'pft_transactions',
  SPENDING_LIMIT: 'pft_spending_limit',
  THEME:         'pft_theme',
};

// =============================================================================
// === STORE ===
// =============================================================================

/**
 * In-memory application state. Single source of truth for the UI.
 * Mirrors what is persisted in localStorage.
 *
 * @type {{
 *   transactions: Array<Object>,
 *   spendingLimit: number|null,
 *   theme: 'light'|'dark',
 *   sortOrder: string
 * }}
 */
const AppState = {
  transactions:  [],
  spendingLimit: null,
  theme:         'light',
  sortOrder:     SORT_ORDERS.DATE_DESC,
};

/**
 * Store — all localStorage interaction and in-memory state mutations.
 */
const Store = {
  /**
   * Reads persisted data from localStorage and populates AppState.
   * All localStorage access is wrapped in try/catch so the app degrades
   * gracefully when storage is unavailable (e.g. private-browsing quota).
   * Corrupted JSON or unexpected types silently fall back to empty defaults
   * (Requirements 5.2, 5.3, 8.4, 8.5, 8.6).
   */
  load() {
    // ── transactions ─────────────────────────────────────────────────────────
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.TRANSACTIONS);
      if (raw !== null) {
        const parsed = JSON.parse(raw);
        // Only accept a real array; discard anything else silently (Req 5.2)
        AppState.transactions = Array.isArray(parsed) ? parsed : [];
      }
    } catch (_e) {
      // localStorage unavailable or JSON malformed → silent empty default
      AppState.transactions = [];
    }

    // ── spending limit ────────────────────────────────────────────────────────
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.SPENDING_LIMIT);
      if (raw !== null) {
        const parsed = JSON.parse(raw);
        // Only accept a finite number; discard anything else silently (Req 5.3)
        AppState.spendingLimit = (typeof parsed === 'number' && isFinite(parsed)) ? parsed : null;
      }
    } catch (_e) {
      AppState.spendingLimit = null;
    }

    // ── theme ─────────────────────────────────────────────────────────────────
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.THEME);
      // Accept only the two valid theme strings; otherwise keep default 'light'
      if (raw === 'light' || raw === 'dark') {
        AppState.theme = raw;
      }
    } catch (_e) {
      AppState.theme = 'light';
    }

    // sortOrder is intentionally NOT persisted — always resets to DATE_DESC
    AppState.sortOrder = SORT_ORDERS.DATE_DESC;
  },

  /**
   * Serialises AppState.transactions and AppState.spendingLimit to
   * localStorage. Wrapped in try/catch: on any write failure (e.g. quota
   * exceeded or storage unavailable) an Error is thrown so the Controller can
   * call View.showStorageError().
   *
   * (Requirements 4.2, 5.1)
   *
   * @throws {Error} When localStorage.setItem fails for any reason.
   */
  save() {
    try {
      localStorage.setItem(
        STORAGE_KEYS.TRANSACTIONS,
        JSON.stringify(AppState.transactions)
      );
      localStorage.setItem(
        STORAGE_KEYS.SPENDING_LIMIT,
        JSON.stringify(AppState.spendingLimit)
      );
    } catch (e) {
      throw new Error('Failed to write to localStorage: ' + e.message);
    }
  },

  /**
   * Appends a transaction to AppState.transactions then persists the updated
   * state. The caller is responsible for constructing a valid Transaction
   * object (including a unique `id` from generateId()).
   *
   * (Requirements 1.2, 5.1)
   *
   * @param {Object} t - A valid Transaction object.
   * @throws {Error} Propagated from Store.save() on write failure.
   */
  addTransaction(t) {
    AppState.transactions.push(t);
    this.save();
  },

  /**
   * Removes the transaction with the given id from AppState.transactions then
   * persists the updated state. If no transaction with that id exists the
   * array is unchanged and save() is still called (idempotent).
   *
   * (Requirements 4.2, 5.1)
   *
   * @param {string} id - The id of the transaction to remove.
   * @throws {Error} Propagated from Store.save() on write failure.
   */
  deleteTransaction(id) {
    AppState.transactions = AppState.transactions.filter(t => t.id !== id);
    this.save();
  },

  /**
   * Updates the spending limit in memory and persists it to localStorage.
   * Wrapped in try/catch so a storage failure does not corrupt in-memory state
   * (Requirements 7.2).
   *
   * @param {number} n - The new spending limit value.
   */
  setSpendingLimit(n) {
    AppState.spendingLimit = n;
    try {
      localStorage.setItem(STORAGE_KEYS.SPENDING_LIMIT, JSON.stringify(n));
    } catch (_e) {
      // localStorage unavailable — in-memory state already updated; storage
      // write silently fails (caller may show a storage error if needed)
    }
  },

  /**
   * Updates the active theme in memory and persists it to localStorage.
   * (Requirement 8.3).
   *
   * @param {'light'|'dark'} theme - The theme string to apply.
   */
  setTheme(theme) {
    AppState.theme = theme;
    try {
      localStorage.setItem(STORAGE_KEYS.THEME, theme);
    } catch (_e) {
      // localStorage unavailable — in-memory state already updated
    }
  },

  /**
   * Updates the active sort order in memory only.
   * Sort order is intentionally NOT persisted — it resets to DATE_DESC on
   * every page load (Requirement 6.2).
   *
   * @param {string} order - One of the SORT_ORDERS values.
   */
  setSortOrder(order) {
    AppState.sortOrder = order;
  },
};

// =============================================================================
// === VALIDATOR ===
// =============================================================================

/**
 * Validator — pure validation functions with no side effects.
 */
const Validator = {
  /**
   * Validates all fields for a new transaction.
   *
   * Rules:
   *  - description: non-empty, not whitespace-only, max 100 chars (Req 1.1, 1.3)
   *  - amount:      numeric, in range 0.01–999,999,999.99 (Req 1.1, 1.4)
   *  - type:        one of 'income' | 'expense' (Req 1.1)
   *  - category:    one of the 7 predefined CATEGORIES values (Req 1.1, 9.1)
   *  - date:        non-empty, valid ISO 8601 YYYY-MM-DD calendar date (Req 1.1)
   *
   * Amount handling: parse as float, reject if NaN / <=0 / >999,999,999.99,
   * then round with Math.round(amount * 100) / 100 to prevent float drift.
   *
   * @param {{
   *   description: string,
   *   amount: string|number,
   *   type: string,
   *   category: string,
   *   date: string
   * }} fields
   * @returns {{ valid: boolean, errors: Object.<string, string> }}
   */
  validateTransaction(fields) {
    const errors = {};

    // ── description ──────────────────────────────────────────────────────────
    const desc = (fields.description ?? '');
    if (typeof desc !== 'string' || desc.trim().length === 0) {
      errors.description = 'Description is required and cannot be blank.';
    } else if (desc.length > 100) {
      errors.description = 'Description must be 100 characters or fewer.';
    }

    // ── amount ────────────────────────────────────────────────────────────────
    const rawAmount = fields.amount;
    const parsedAmount = typeof rawAmount === 'number' ? rawAmount : parseFloat(rawAmount);
    if (isNaN(parsedAmount)) {
      errors.amount = 'Amount must be a valid number.';
    } else if (parsedAmount <= 0) {
      errors.amount = 'Amount must be greater than zero.';
    } else if (parsedAmount > 999999999.99) {
      errors.amount = 'Amount must not exceed 999,999,999.99.';
    } else {
      // Round to 2 decimal places to prevent floating-point drift (Design §Amount Precision)
      const rounded = Math.round(parsedAmount * 100) / 100;
      if (rounded <= 0) {
        errors.amount = 'Amount must be greater than zero.';
      }
      // No error — rounded value will be used by the caller
    }

    // ── type ─────────────────────────────────────────────────────────────────
    if (fields.type !== 'income' && fields.type !== 'expense') {
      errors.type = 'Type must be "income" or "expense".';
    }

    // ── category ─────────────────────────────────────────────────────────────
    if (!CATEGORIES.includes(fields.category)) {
      errors.category = 'Category must be one of the predefined values.';
    }

    // ── date ─────────────────────────────────────────────────────────────────
    const date = (fields.date ?? '');
    if (typeof date !== 'string' || date.trim().length === 0) {
      errors.date = 'Date is required.';
    } else {
      // Check YYYY-MM-DD format
      const dateRegex = /^\d{4}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12]\d|3[01])$/;
      if (!dateRegex.test(date)) {
        errors.date = 'Date must be a valid date in YYYY-MM-DD format.';
      } else {
        // Verify it is a real calendar date (e.g. reject 2024-02-30)
        const [year, month, day] = date.split('-').map(Number);
        const d = new Date(year, month - 1, day);
        if (
          d.getFullYear() !== year ||
          d.getMonth() + 1 !== month ||
          d.getDate() !== day
        ) {
          errors.date = 'Date must be a valid calendar date.';
        }
      }
    }

    return {
      valid: Object.keys(errors).length === 0,
      errors,
    };
  },

  /**
   * Validates a spending limit input value (Requirement 7.1).
   *
   * Accepts a raw value that may be a string (from an input field) or a number.
   * Parses it as a float and checks that it falls within the allowed range of
   * 0.01 to 999,999,999.99 (inclusive).
   *
   * @param {string|number} raw - The raw spending limit value to validate.
   * @returns {{ valid: boolean, error?: string }} Result object. On success,
   *   `{ valid: true }`. On failure, `{ valid: false, error: string }`.
   */
  validateSpendingLimit(raw) {
    const value = parseFloat(raw);

    if (isNaN(value) || value <= 0 || value > 999999999.99) {
      return {
        valid: false,
        error: 'Please enter a valid spending limit between 0.01 and 999,999,999.99.',
      };
    }

    return { valid: true };
  },
};

// =============================================================================
// === SORTER ===
// =============================================================================

/**
 * Sorter — pure sorting utility. Never mutates the source array.
 */
const Sorter = {
  /**
   * Returns a new array of transactions sorted by the given order.
   * The original array is never mutated.
   *
   * Sort keys and tie-breaking:
   *  - 'date-desc'    : t.date descending (YYYY-MM-DD lexicographic), then insertedAt ascending
   *  - 'amount-asc'   : t.amount ascending, then insertedAt ascending
   *  - 'amount-desc'  : t.amount descending, then insertedAt ascending
   *  - 'category-asc' : t.category ascending (localeCompare), then insertedAt ascending
   *  - unknown order  : falls back to 'date-desc' behaviour
   *
   * (Requirements 6.1, 6.2, 6.4)
   *
   * @param {Array<Object>} transactions - The source transaction array.
   * @param {string} order - One of the SORT_ORDERS values.
   * @returns {Array<Object>} A new sorted array.
   */
  sort(transactions, order) {
    // Copy first — never mutate the source (Requirement 6.2)
    const copy = [...transactions];

    copy.sort((a, b) => {
      let primary = 0;

      switch (order) {
        case SORT_ORDERS.AMOUNT_ASC:
          primary = a.amount - b.amount;
          break;

        case SORT_ORDERS.AMOUNT_DESC:
          primary = b.amount - a.amount;
          break;

        case SORT_ORDERS.CATEGORY_ASC:
          primary = a.category.localeCompare(b.category);
          break;

        case SORT_ORDERS.DATE_DESC:
        default:
          // YYYY-MM-DD strings are lexicographically comparable
          // Descending → b before a
          if (b.date > a.date) return 1;
          if (b.date < a.date) return -1;
          primary = 0;
          break;
      }

      // Secondary sort: earlier insertedAt first (stable tie-break, Requirement 6.4)
      if (primary !== 0) return primary;
      return a.insertedAt - b.insertedAt;
    });

    return copy;
  },
};

// =============================================================================
// === VIEW ===
// =============================================================================

/**
 * View — all DOM manipulation. Never reads from localStorage directly.
 */
const View = {
  /**
   * Updates the Summary_Panel with the current balance, total income, and
   * total expenses (Requirements 3.1, 3.3).
   *
   * Formatting rules:
   *  - All three values are formatted to exactly 2 decimal places via toFixed(2).
   *  - When balance < 0: the balance element receives the "deficit" CSS class
   *    (which applies red colour #CC0000) and the value is prefixed with "−"
   *    (U+2212, MINUS SIGN).
   *  - When balance >= 0: the "deficit" class is removed and the value is shown
   *    without any prefix.
   *
   * @param {number} balance  - Current balance (totalIncome − totalExpenses).
   * @param {number} income   - Sum of all income transaction amounts.
   * @param {number} expenses - Sum of all expense transaction amounts.
   */
  renderSummary(balance, income, expenses) {
    const balanceEl  = document.getElementById('balance-value');
    const incomeEl   = document.getElementById('income-value');
    const expenseEl  = document.getElementById('expense-value');

    // ── income & expenses (always non-negative display values) ───────────────
    if (incomeEl)  incomeEl.textContent  = '$' + income.toFixed(2);
    if (expenseEl) expenseEl.textContent = '$' + expenses.toFixed(2);

    // ── balance ───────────────────────────────────────────────────────────────
    if (balanceEl) {
      if (balance < 0) {
        // Deficit: red colour via CSS class + "−" prefix (Requirement 3.3)
        balanceEl.classList.add('summary-value--deficit');
        balanceEl.textContent = '\u2212$' + Math.abs(balance).toFixed(2);
      } else {
        // Positive or zero balance: no deficit indicator
        balanceEl.classList.remove('summary-value--deficit');
        balanceEl.textContent = '$' + balance.toFixed(2);
      }
    }
  },

  /**
   * Shows or hides the spending warning banner based on whether total expenses
   * exceed the spending limit.
   *
   * Rules (Requirements 7.4, 7.6, 7.7):
   *  - Show banner when: limit !== null AND expenses > limit
   *  - Hide banner in all other cases (limit is null, or expenses <= limit)
   *
   * When shown, the banner displays the overage amount as:
   *   "— over by $X.XX"
   *
   * The #spending-banner element uses the HTML `hidden` attribute for
   * show/hide so that the aria-live="polite" region announces changes to
   * assistive technologies.
   *
   * @param {number} expenses - Total expense amount (non-negative).
   * @param {number|null} limit - The active spending limit, or null if unset.
   */
  renderSpendingBanner(expenses, limit) {
    const banner  = document.getElementById('spending-banner');
    const overage = document.getElementById('spending-overage');

    if (limit !== null && expenses > limit) {
      // Calculate how much over the limit, formatted to 2 decimal places
      const overAmount = (expenses - limit).toFixed(2);
      overage.textContent = `— over by $${overAmount}`;
      banner.hidden = false;
    } else {
      // No limit set, or expenses are within the limit — hide the banner
      overage.textContent = '';
      banner.hidden = true;
    }
  },

  /**
   * Displays inline validation error messages adjacent to each invalid form
   * field. Clears error spans for fields that are NOT present in the errors
   * object (Requirements 1.3, 1.4).
   *
   * The error span IDs follow the pattern:
   *   description → #desc-error
   *   amount      → #amount-error
   *   type        → #type-error
   *   category    → #category-error
   *   date        → #date-error
   *
   * @param {Object.<string, string>} errors - Map of field name → error message.
   *   e.g. { description: "Description is required.", amount: "Amount must be > 0." }
   */
  renderValidationErrors(errors) {
    // Map from field name (as used in the errors object) to error span ID
    const fieldToSpanId = {
      description: 'desc-error',
      amount:      'amount-error',
      type:        'type-error',
      category:    'category-error',
      date:        'date-error',
    };

    Object.entries(fieldToSpanId).forEach(([field, spanId]) => {
      const span = document.getElementById(spanId);
      if (!span) return;

      if (Object.prototype.hasOwnProperty.call(errors, field)) {
        // Show the error message for this field
        span.textContent = errors[field];
      } else {
        // Clear the error span for fields that are valid
        span.textContent = '';
      }
    });
  },

  /**
   * Resets all fields in the add-transaction form back to their default
   * empty/placeholder state (Requirement 1.5).
   *
   * Uses the native HTMLFormElement.reset() method which correctly handles
   * all input types (text, number, select, date).
   */
  clearForm() {
    const form = document.getElementById('add-transaction-form');
    if (form) {
      form.reset();
    }
    // Also clear any lingering validation error spans after the reset
    this.renderValidationErrors({});
  },

  /**
   * Applies the given theme to the entire page by setting the `data-theme`
   * attribute on the root <html> element (Requirement 8.2).
   *
   * The DOM attribute change is synchronous and takes effect within the next
   * paint cycle — well under the 100 ms requirement — so no setTimeout is
   * needed.
   *
   * Also updates the theme toggle button label and icon to reflect the new
   * theme.
   *
   * @param {'light'|'dark'} theme - The theme to apply.
   */
  applyTheme(theme) {
    // Apply data-theme attribute to <html> — CSS custom properties respond
    // to this selector, switching all themed colours instantly (Req 8.2)
    document.documentElement.setAttribute('data-theme', theme);

    // Update the toggle button label, icon, and aria-label to show the
    // opposite action (what will happen when clicked next).
    const toggleBtn   = document.getElementById('theme-toggle');
    const toggleLabel = toggleBtn && toggleBtn.querySelector('.theme-toggle-label');
    const toggleIcon  = toggleBtn && toggleBtn.querySelector('.theme-toggle-icon');

    if (theme === 'dark') {
      if (toggleLabel) toggleLabel.textContent = 'Light Mode';
      if (toggleIcon)  toggleIcon.textContent  = '☀️';
      // aria-label describes the action the button will perform (Requirement 11.2)
      if (toggleBtn)   toggleBtn.setAttribute('aria-label', 'Switch to light mode');
    } else {
      if (toggleLabel) toggleLabel.textContent = 'Dark Mode';
      if (toggleIcon)  toggleIcon.textContent  = '🌙';
      // aria-label describes the action the button will perform (Requirement 11.2)
      if (toggleBtn)   toggleBtn.setAttribute('aria-label', 'Switch to dark mode');
    }
  },

  /**
   * Displays a storage error message to the user in the #storage-error
   * element (Requirement 4.4, 8.2).
   *
   * The element is shown by removing the `hidden` attribute. A dismiss button
   * is injected (if not already present) so the user can close the message.
   *
   * @param {string} message - The error message to display.
   */
  showStorageError(message) {
    const container = document.getElementById('storage-error');
    if (!container) return;

    const textSpan = container.querySelector('.storage-error__text');
    if (textSpan) {
      textSpan.textContent = message;
    }

    // Add a dismiss button if one doesn't already exist
    if (!container.querySelector('.storage-error__dismiss')) {
      const dismissBtn = document.createElement('button');
      dismissBtn.type = 'button';
      dismissBtn.className = 'storage-error__dismiss btn';
      dismissBtn.textContent = 'Dismiss';
      dismissBtn.setAttribute('aria-label', 'Dismiss storage error');
      dismissBtn.addEventListener('click', () => {
        container.hidden = true;
        if (textSpan) textSpan.textContent = '';
      });
      container.appendChild(dismissBtn);
    }

    container.hidden = false;
  },

  /**
   * Renders the transaction history into #transaction-list.
   *
   * For each transaction a <li> is created containing:
   *  - description
   *  - formatted amount with "+" prefix for income and "−" (U+2212) for expense,
   *    always to 2 decimal places
   *  - type label ("Income" / "Expense") as visible text
   *  - category
   *  - date (YYYY-MM-DD)
   *  - delete button with data-id attribute
   *
   * Income items carry class "transaction income"; expense items carry
   * "transaction expense" — satisfying the dual-differentiator rule (colour +
   * text label, Requirements 2.3, 2.4).
   *
   * When the array is empty the list is replaced with a single item showing
   * the "no transactions recorded" message (Requirement 2.2).
   *
   * The list is fully replaced on every call so stale entries can never
   * linger (Requirement 2.1).
   *
   * @param {Array<Object>} transactions - The (already-sorted) array of
   *   Transaction objects to display.
   */
  renderTransactions(transactions) {
    const list = document.getElementById('transaction-list');
    if (!list) return;

    // Clear existing content (full replace on every render)
    list.innerHTML = '';

    // Empty state (Requirement 2.2)
    if (transactions.length === 0) {
      const empty = document.createElement('li');
      empty.className = 'transaction-list__empty';
      empty.id = 'empty-message';
      empty.textContent = 'No transactions recorded yet.';
      list.appendChild(empty);
      return;
    }

    // One <li> per transaction (Requirements 2.1, 2.3, 2.4, 4.1)
    transactions.forEach(t => {
      const isIncome = t.type === 'income';

      // Amount: "+" for income, "−" (U+2212) for expense, always 2 d.p.
      const prefix = isIncome ? '+' : '\u2212';
      const formattedAmount = `${prefix}$${t.amount.toFixed(2)}`;

      // Type label text — visible text differentiator so colour is NOT the
      // sole means of distinction (Requirement 2.4).
      const typeLabel = isIncome ? 'Income' : 'Expense';

      const li = document.createElement('li');
      // CSS classes enable colour styling; type label provides text differentiator.
      li.className = `transaction ${t.type}`; // e.g. "transaction income"

      li.innerHTML = `
        <div class="transaction__body">
          <span class="transaction__description">${_escapeHtml(t.description)}</span>
          <span class="transaction__meta">
            <span class="transaction__category">${_escapeHtml(t.category)}</span>
            <span class="transaction__date">${_escapeHtml(t.date)}</span>
          </span>
        </div>
        <div class="transaction__aside">
          <span class="transaction__type-label transaction__type-label--${t.type}">${typeLabel}</span>
          <span class="transaction__amount">${formattedAmount}</span>
          <button
            class="delete-btn"
            data-id="${_escapeHtml(t.id)}"
            aria-label="Delete transaction: ${_escapeHtml(t.description)}"
          >Delete</button>
        </div>
      `.trim();

      list.appendChild(li);
    });
  },
};

// =============================================================================
// === HELPERS ===
// =============================================================================

/**
 * Escapes characters that are special in HTML to prevent XSS when inserting
 * user-supplied strings via innerHTML.
 *
 * @param {string} str - The raw string to escape.
 * @returns {string} The HTML-safe string.
 */
function _escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
}

// =============================================================================
// === CONTROLLER ===
// =============================================================================

/**
 * Controller — wires Store, Validator, Sorter, and View together.
 * All event handling and application logic lives here.
 */
const Controller = {
  /**
   * Computes derived summary values from the current AppState.transactions.
   * Used in init() and after every state mutation so the UI stays in sync.
   *
   * @returns {{ totalIncome: number, totalExpenses: number, balance: number }}
   */
  _computeDerived() {
    let totalIncome   = 0;
    let totalExpenses = 0;

    AppState.transactions.forEach(t => {
      if (t.type === 'income') {
        totalIncome += t.amount;
      } else {
        totalExpenses += t.amount;
      }
    });

    // Round to avoid floating-point drift from repeated addition
    totalIncome   = Math.round(totalIncome   * 100) / 100;
    totalExpenses = Math.round(totalExpenses * 100) / 100;
    const balance = Math.round((totalIncome - totalExpenses) * 100) / 100;

    return { totalIncome, totalExpenses, balance };
  },

  /**
   * Bootstraps the application:
   *  1. Loads persisted state from localStorage into AppState.
   *  2. Applies the saved theme.
   *  3. Renders the summary panel, transaction list, and spending banner.
   *  4. Attaches all event listeners.
   *
   * (Requirements 5.2, 5.3, 6.1, 8.4, 8.5)
   */
  init() {
    // 1. Populate AppState from localStorage
    Store.load();

    // 2. Apply the persisted (or default) theme before any other render
    View.applyTheme(AppState.theme);

    // 3. Compute derived values and render the UI
    const { totalIncome, totalExpenses, balance } = this._computeDerived();

    View.renderSummary(balance, totalIncome, totalExpenses);
    View.renderTransactions(Sorter.sort(AppState.transactions, AppState.sortOrder));
    View.renderSpendingBanner(totalExpenses, AppState.spendingLimit);

    // 4. Attach event listeners ─────────────────────────────────────────────

    // Form submit — add a new transaction
    const form = document.getElementById('add-transaction-form');
    if (form) {
      form.addEventListener('submit', (e) => Controller.onFormSubmit(e));
    }

    // Transaction list — delegated delete clicks
    const list = document.getElementById('transaction-list');
    if (list) {
      list.addEventListener('click', (e) => {
        const id = e.target.dataset.id;
        if (id) {
          Controller.onDeleteClick(id);
        }
      });
    }

    // Sort control — order change
    const sortSelect = document.getElementById('sort-select');
    if (sortSelect) {
      sortSelect.addEventListener('change', (e) => Controller.onSortChange(e.target.value));
    }

    // Spending limit — save button
    const saveLimitBtn = document.getElementById('save-limit-btn');
    if (saveLimitBtn) {
      saveLimitBtn.addEventListener('click', () => Controller.onSpendingLimitSave());
    }

    // Theme toggle button
    const themeToggle = document.getElementById('theme-toggle');
    if (themeToggle) {
      themeToggle.addEventListener('click', () => Controller.onThemeToggle());
    }
  },

  /**
   * Handles form submission for adding a new transaction.
   * Validates all fields, builds a Transaction object, persists it, and
   * re-renders the affected UI sections.
   *
   * (Requirements 1.2, 1.3, 1.4, 1.5, 3.2, 4.4)
   *
   * @param {SubmitEvent} event - The form submit event.
   */
  onFormSubmit(event) {
    event.preventDefault();

    const fields = {
      description: document.getElementById('desc-input')?.value     ?? '',
      amount:      document.getElementById('amount-input')?.value   ?? '',
      type:        document.getElementById('type-input')?.value     ?? '',
      category:    document.getElementById('category-input')?.value ?? '',
      date:        document.getElementById('date-input')?.value     ?? '',
    };

    const { valid, errors } = Validator.validateTransaction(fields);

    if (!valid) {
      View.renderValidationErrors(errors);
      return;
    }

    // Clear any previously shown validation errors
    View.renderValidationErrors({});

    // Build Transaction object
    const transaction = {
      id:          generateId(),
      description: fields.description.trim(),
      amount:      Math.round(parseFloat(fields.amount) * 100) / 100,
      type:        fields.type,
      category:    fields.category,
      date:        fields.date,
      insertedAt:  Date.now(),
    };

    // Persist — show storage error and bail out on failure (Requirement 4.4)
    try {
      Store.addTransaction(transaction);
    } catch (e) {
      View.showStorageError('Failed to save transaction. Your data may not be persisted.');
      return;
    }

    // Clear the form after a successful add (Requirement 1.5)
    View.clearForm();

    // Re-render all affected sections within the same cycle (Requirements 3.2, 6.3)
    const { totalIncome, totalExpenses, balance } = this._computeDerived();
    View.renderSummary(balance, totalIncome, totalExpenses);
    View.renderTransactions(Sorter.sort(AppState.transactions, AppState.sortOrder));
    View.renderSpendingBanner(totalExpenses, AppState.spendingLimit);
  },

  /**
   * Handles a delete request for the transaction with the given id.
   * Removes the transaction from state and storage, then re-renders.
   *
   * On storage write error: shows a storage error message and re-renders with
   * the original (unmodified) transaction list so the deleted item remains
   * visible in the UI (Requirement 4.4).
   *
   * Store.deleteTransaction mutates AppState.transactions before calling
   * Store.save(), so we snapshot the array beforehand and roll back if
   * save() throws.
   *
   * (Requirements 4.2, 4.3, 4.4)
   *
   * @param {string} transactionId - The id of the transaction to delete.
   */
  onDeleteClick(transactionId) {
    // Snapshot the current list so we can roll back on storage failure
    const previousTransactions = AppState.transactions.slice();

    try {
      Store.deleteTransaction(transactionId);
    } catch (e) {
      // Storage write failed — roll back the in-memory mutation so the
      // displayed list stays consistent with storage (Requirement 4.4)
      AppState.transactions = previousTransactions;

      View.showStorageError('Failed to delete transaction. Please try again.');

      // Re-render with the restored (unchanged) transaction list
      const { totalIncome, totalExpenses, balance } = this._computeDerived();
      View.renderSummary(balance, totalIncome, totalExpenses);
      View.renderTransactions(Sorter.sort(AppState.transactions, AppState.sortOrder));
      View.renderSpendingBanner(totalExpenses, AppState.spendingLimit);
      return;
    }

    // Success — re-render all affected sections within the same cycle (Requirement 4.3)
    const { totalIncome, totalExpenses, balance } = this._computeDerived();
    View.renderSummary(balance, totalIncome, totalExpenses);
    View.renderTransactions(Sorter.sort(AppState.transactions, AppState.sortOrder));
    View.renderSpendingBanner(totalExpenses, AppState.spendingLimit);
  },

  /**
   * Handles a sort order change from the sort control dropdown.
   * Updates AppState.sortOrder and re-renders the transaction list.
   *
   * (Requirements 6.1, 6.2)
   *
   * @param {string} order - The new sort order value (one of SORT_ORDERS).
   */
  onSortChange(order) {
    Store.setSortOrder(order);
    View.renderTransactions(Sorter.sort(AppState.transactions, AppState.sortOrder));
  },

  /**
   * Handles saving a new spending limit from the limit input field.
   * Validates the value, persists it, and re-renders the spending banner.
   *
   * (Requirements 7.1, 7.2, 7.5)
   */
  onSpendingLimitSave() {
    const limitInput = document.getElementById('limit-input');
    const limitError = document.getElementById('limit-error');
    const raw = limitInput?.value ?? '';

    const { valid, error } = Validator.validateSpendingLimit(raw);

    if (!valid) {
      if (limitError) limitError.textContent = error;
      return;
    }

    // Clear any previous error
    if (limitError) limitError.textContent = '';

    const limitValue = Math.round(parseFloat(raw) * 100) / 100;
    Store.setSpendingLimit(limitValue);

    // Re-evaluate banner immediately with the new limit (Requirement 7.5)
    const { totalExpenses } = this._computeDerived();
    View.renderSpendingBanner(totalExpenses, AppState.spendingLimit);
  },

  /**
   * Handles the theme toggle button click.
   * Flips the active theme, persists it, and applies it to the page.
   *
   * (Requirements 8.1, 8.2, 8.3)
   */
  onThemeToggle() {
    const newTheme = AppState.theme === 'dark' ? 'light' : 'dark';
    Store.setTheme(newTheme);
    View.applyTheme(newTheme);
  },
};

// Bootstrap the application once the DOM is fully parsed.
document.addEventListener('DOMContentLoaded', () => Controller.init());
