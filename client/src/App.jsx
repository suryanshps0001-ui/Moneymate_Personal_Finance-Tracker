import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
} from 'recharts';
import './App.css';

// API URLs
const API_URL = 'http://localhost:5000/api/transactions';
const AUTH_URL = 'http://localhost:5000/api/auth';
const BUDGET_URL = 'http://localhost:5000/api/budgets';

const EXPENSE_CATEGORIES = [
  'Food',
  'Housing',
  'Transport',
  'Shopping',
  'Health',
  'Education',
  'Entertainment',
  'Other',
];

const COLORS = ['#7c5cff', '#20c997', '#ff7373', '#00a8e1', '#ffc857'];

const getCurrentMonth = () => {
  const now = new Date();

  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(
    2,
    '0'
  )}`;
};

const getToday = () => {
  const now = new Date();

  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(
    2,
    '0'
  )}-${String(now.getDate()).padStart(2, '0')}`;
};

const formatCurrency = (amount) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2,
  }).format(Number(amount) || 0);

const getTransactionDate = (transaction) => {
  if (!transaction.date) return '';

  return String(transaction.date).slice(0, 10);
};

function App() {
  // Authentication
  const [token, setToken] = useState(
    () => localStorage.getItem('token') || ''
  );

  const [authMode, setAuthMode] = useState('login');
  const [authName, setAuthName] = useState('');
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authLoading, setAuthLoading] = useState(false);

  // Dashboard
  const [transactions, setTransactions] = useState([]);
  const [budgets, setBudgets] = useState([]);

  const [loading, setLoading] = useState(false);
  const [budgetLoading, setBudgetLoading] = useState(false);
  const [budgetSaving, setBudgetSaving] = useState(false);
  const [saving, setSaving] = useState(false);

  // Messages
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Transaction form
const [title, setTitle] = useState('');
const [type, setType] = useState('expense');
const [amount, setAmount] = useState('');
const [category, setCategory] = useState('Food');
const [note, setNote] = useState('');
const [transactionDate, setTransactionDate] = useState(getToday());
  // Budget form
  const [budgetCategory, setBudgetCategory] = useState('Food');
  const [budgetAmount, setBudgetAmount] = useState('');

  const currentMonth = getCurrentMonth();

  // Logout
  const logout = useCallback(() => {
    localStorage.removeItem('token');
    setToken('');
    setTransactions([]);
    setBudgets([]);
    setError('');
    setSuccess('');
  }, []);

  // Fetch transactions
  const fetchTransactions = useCallback(
    async (currentToken) => {
      if (!currentToken) return;

      setLoading(true);

      try {
        const response = await fetch(API_URL, {
          headers: {
            Authorization: `Bearer ${currentToken}`,
          },
        });

        const result = await response.json();

        if (response.status === 401 || response.status === 403) {
          logout();
          throw new Error('Session expired. Please login again.');
        }

        if (!response.ok || !result.success) {
          throw new Error(
            result.message || 'Failed to load transactions.'
          );
        }

        const data = Array.isArray(result.data) ? result.data : [];
        setTransactions(data);
      } catch (err) {
        setError(err.message || 'Unable to load transactions.');
        console.error('Transaction fetch error:', err);
      } finally {
        setLoading(false);
      }
    },
    [logout]
  );

  // Fetch budgets
  const fetchBudgets = useCallback(
    async (currentToken) => {
      if (!currentToken) return;

      setBudgetLoading(true);

      try {
        const response = await fetch(
          `${BUDGET_URL}?month=${currentMonth}`,
          {
            headers: {
              Authorization: `Bearer ${currentToken}`,
            },
          }
        );

        const result = await response.json();

        if (response.status === 401 || response.status === 403) {
          logout();
          throw new Error('Session expired. Please login again.');
        }

        if (!response.ok || !result.success) {
          throw new Error(
            result.message || 'Failed to load budgets.'
          );
        }

        setBudgets(
          Array.isArray(result.data) ? result.data : []
        );
      } catch (err) {
        setError(err.message || 'Unable to load budgets.');
        console.error('Budget fetch error:', err);
      } finally {
        setBudgetLoading(false);
      }
    },
    [currentMonth, logout]
  );

  // Load data after login
  useEffect(() => {
    if (!token) return;

    fetchTransactions(token);
    fetchBudgets(token);
  }, [token, fetchTransactions, fetchBudgets]);

  // Login and Signup
  async function handleAuth(event) {
    event.preventDefault();

    setError('');
    setSuccess('');

    if (!authEmail.trim() || !authPassword) {
      setError('Please enter your email and password.');
      return;
    }

    if (authMode === 'signup' && !authName.trim()) {
      setError('Please enter your name.');
      return;
    }

    setAuthLoading(true);

    try {
      const endpoint =
        authMode === 'login' ? 'login' : 'register';

      const payload =
        authMode === 'login'
          ? {
              email: authEmail.trim(),
              password: authPassword,
            }
          : {
              name: authName.trim(),
              email: authEmail.trim(),
              password: authPassword,
            };

      const response = await fetch(`${AUTH_URL}/${endpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(
          result.message || 'Authentication failed.'
        );
      }

      const receivedToken =
        result.token ||
        result.data?.token ||
        result.accessToken;

      if (!receivedToken) {
        throw new Error(
          'Login response did not contain a token. Check your backend response.'
        );
      }

      localStorage.setItem('token', receivedToken);
      setToken(receivedToken);
      setAuthPassword('');
      setError('');
      setSuccess('Successfully logged in.');
    } catch (err) {
      setError(err.message || 'Unable to authenticate.');
    } finally {
      setAuthLoading(false);
    }
  }

  // Add transaction
  async function addTransaction(event) {
    event.preventDefault();

    setError('');
    setSuccess('');

    const numericAmount = Number(amount);

    if (!title.trim()) {
      setError('Please enter a transaction title.');
      return;
    }

    if (
      !Number.isFinite(numericAmount) ||
      numericAmount <= 0
    ) {
      setError('Please enter a valid amount greater than zero.');
      return;
    }

    if (!category || !transactionDate) {
      setError('Please select a category and date.');
      return;
    }

    setSaving(true);

    try {
      const response = await fetch(API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          title: title.trim(),
          type,
          amount: numericAmount,
          category,
          note: note.trim(),
          date: transactionDate,
        }),
      });

      const result = await response.json();

      if (response.status === 401 || response.status === 403) {
        logout();
        throw new Error('Please login again.');
      }

      if (!response.ok || !result.success) {
        throw new Error(
          result.message || 'Failed to add transaction.'
        );
      }

      setTitle('');
      setAmount('');
      setNote('');
      setTransactionDate(getToday());

      await fetchTransactions(token);

      setSuccess('Transaction added successfully.');
    } catch (err) {
      setError(err.message || 'Unable to add transaction.');
    } finally {
      setSaving(false);
    }
  }

  // Delete transaction
  async function deleteTransaction(id) {
    if (!window.confirm('Delete this transaction?')) return;

    setError('');
    setSuccess('');

    try {
      const response = await fetch(`${API_URL}/${id}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const result = await response.json();

      if (response.status === 401 || response.status === 403) {
        logout();
        throw new Error('Please login again.');
      }

      if (!response.ok || !result.success) {
        throw new Error(
          result.message || 'Failed to delete transaction.'
        );
      }

      setTransactions((previous) =>
        previous.filter((transaction) => transaction._id !== id)
      );

      setSuccess('Transaction deleted successfully.');
    } catch (err) {
      setError(err.message || 'Unable to delete transaction.');
    }
  }

  // Add budget
  async function addBudget(event) {
    event.preventDefault();

    setError('');
    setSuccess('');

    const numericAmount = Number(budgetAmount);

    if (
      !budgetCategory ||
      !Number.isFinite(numericAmount) ||
      numericAmount <= 0
    ) {
      setError('Please enter a valid budget amount.');
      return;
    }

    setBudgetSaving(true);

    try {
      const response = await fetch(BUDGET_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          category: budgetCategory,
          amount: numericAmount,
          month: currentMonth,
        }),
      });

      const result = await response.json();

      if (response.status === 401 || response.status === 403) {
        logout();
        throw new Error('Please login again.');
      }

      if (!response.ok || !result.success) {
        throw new Error(
          result.message || 'Failed to save budget.'
        );
      }

      setBudgetAmount('');

      await fetchBudgets(token);

      setSuccess('Budget saved successfully.');
    } catch (err) {
      setError(err.message || 'Unable to save budget.');
    } finally {
      setBudgetSaving(false);
    }
  }

  // Delete budget
  async function deleteBudget(id) {
    if (!window.confirm('Delete this budget?')) return;

    setError('');
    setSuccess('');

    try {
      const response = await fetch(`${BUDGET_URL}/${id}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const result = await response.json();

      if (response.status === 401 || response.status === 403) {
        logout();
        throw new Error('Please login again.');
      }

      if (!response.ok || !result.success) {
        throw new Error(
          result.message || 'Failed to delete budget.'
        );
      }

      setBudgets((previous) =>
        previous.filter((budget) => budget._id !== id)
      );

      setSuccess('Budget deleted successfully.');
    } catch (err) {
      setError(err.message || 'Unable to delete budget.');
    }
  }

  // Dashboard calculations
  const currentMonthTransactions = useMemo(
    () =>
      transactions.filter(
        (transaction) =>
          getTransactionDate(transaction).slice(0, 7) ===
          currentMonth
      ),
    [transactions, currentMonth]
  );

  const income = currentMonthTransactions
    .filter((transaction) => transaction.type === 'income')
    .reduce(
      (sum, transaction) => sum + Number(transaction.amount || 0),
      0
    );

  const expenses = currentMonthTransactions
    .filter((transaction) => transaction.type === 'expense')
    .reduce(
      (sum, transaction) => sum + Number(transaction.amount || 0),
      0
    );

  const balance = income - expenses;

  // Budget progress
  const budgetData = budgets.map((budget) => {
    const spent = currentMonthTransactions
      .filter(
        (transaction) =>
          transaction.type === 'expense' &&
          transaction.category === budget.category
      )
      .reduce(
        (sum, transaction) =>
          sum + Number(transaction.amount || 0),
        0
      );

    const limit = Number(budget.amount);
    const percentage =
      limit > 0 ? (spent / limit) * 100 : 0;

    return {
      ...budget,
      spent,
      limit,
      percentage,
      progress: Math.min(percentage, 100),
      status:
        percentage >= 100
          ? 'exceeded'
          : percentage >= 80
            ? 'warning'
            : 'normal',
    };
  });

  // Chart data
  const expenseChartData = Object.values(
    currentMonthTransactions
      .filter((transaction) => transaction.type === 'expense')
      .reduce((groups, transaction) => {
        const key = transaction.category || 'Other';

        if (!groups[key]) {
          groups[key] = {
            name: key,
            value: 0,
          };
        }

        groups[key].value += Number(transaction.amount || 0);

        return groups;
      }, {})
  );

  const barChartData = [
    {
      name: 'Income',
      amount: income,
    },
    {
      name: 'Expenses',
      amount: expenses,
    },
  ];

  // Login screen
  if (!token) {
    return (
      <div className="auth-page">
        <div className="auth-card">
          <h1>MoneyMate</h1>
          <p>Manage your money. Build better habits.</p>

          <div className="auth-tabs">
            <button
              type="button"
              className={authMode === 'login' ? 'active' : ''}
              onClick={() => {
                setAuthMode('login');
                setError('');
              }}
            >
              Login
            </button>

            <button
              type="button"
              className={authMode === 'signup' ? 'active' : ''}
              onClick={() => {
                setAuthMode('signup');
                setError('');
              }}
            >
              Sign Up
            </button>
          </div>

          {error && <div className="error-message">{error}</div>}

          <form onSubmit={handleAuth}>
            {authMode === 'signup' && (
              <div className="form-group">
                <label htmlFor="authName">Full Name</label>
                <input
                  id="authName"
                  type="text"
                  value={authName}
                  onChange={(event) =>
                    setAuthName(event.target.value)
                  }
                  placeholder="Enter your name"
                  required
                />
              </div>
            )}

            <div className="form-group">
              <label htmlFor="authEmail">Email</label>
              <input
                id="authEmail"
                type="email"
                value={authEmail}
                onChange={(event) =>
                  setAuthEmail(event.target.value)
                }
                placeholder="Enter your email"
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="authPassword">Password</label>
              <input
                id="authPassword"
                type="password"
                value={authPassword}
                onChange={(event) =>
                  setAuthPassword(event.target.value)
                }
                placeholder="Enter your password"
                required
              />
            </div>

            <button
              type="submit"
              className="primary-button"
              disabled={authLoading}
            >
              {authLoading
                ? 'Please wait...'
                : authMode === 'login'
                  ? 'Login'
                  : 'Create Account'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  // Main dashboard
  return (
    <div className="app-container">
      <aside className="sidebar">
        <div className="sidebar-brand">
          <h2>MoneyMate</h2>
          <span>Personal Finance</span>
        </div>

        <nav className="sidebar-nav">
          <a href="#dashboard" className="nav-link">
            Dashboard
          </a>

          <a href="#transactions" className="nav-link">
            Transactions
          </a>

          <a href="#budgets" className="nav-link">
            Budget Management
          </a>

          <a href="#analytics" className="nav-link">
            Analytics
          </a>
        </nav>

        <button
          type="button"
          className="logout-button"
          onClick={logout}
        >
          Logout
        </button>
      </aside>

      <main className="main-content">
        <header className="dashboard-header" id="dashboard">
          <div>
            <h1>Dashboard</h1>
            <p>
              Here's your financial overview for {currentMonth}.
            </p>
          </div>

          <span className="month-badge">{currentMonth}</span>
        </header>

        {error && (
          <div className="error-message">
            {error}
            <button
              type="button"
              onClick={() => setError('')}
              aria-label="Dismiss error"
            >
              ×
            </button>
          </div>
        )}

        {success && (
          <div className="success-message">
            {success}
            <button
              type="button"
              onClick={() => setSuccess('')}
              aria-label="Dismiss message"
            >
              ×
            </button>
          </div>
        )}

        {/* Summary cards */}
        <section className="summary-grid">
          <div className="summary-card">
            <span>Total Income</span>
            <h2>{formatCurrency(income)}</h2>
          </div>

          <div className="summary-card">
            <span>Total Expenses</span>
            <h2>{formatCurrency(expenses)}</h2>
          </div>

          <div className="summary-card">
            <span>Remaining Balance</span>
            <h2>{formatCurrency(balance)}</h2>
          </div>

          <div className="summary-card">
            <span>Monthly Budgets</span>
            <h2>{budgets.length}</h2>
          </div>
        </section>

        {/* Add transaction */}
        <section className="content-card">
          <h2>Add Transaction</h2>

          <form
            className="transaction-form"
            onSubmit={addTransaction}
          >
            <div className="form-group">
              <label htmlFor="transactionTitle">Title</label>
              <input
                id="transactionTitle"
                type="text"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="e.g. Monthly Salary, Groceries, Rent"
                maxLength={100}
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="transactionType">Type</label>

              <select
                id="transactionType"
                value={type}
                onChange={(event) => {
                  const newType = event.target.value;

                  setType(newType);

                  setCategory(
                    newType === 'income' ? 'Salary' : 'Food'
                  );
                }}
              >
                <option value="expense">Expense</option>
                <option value="income">Income</option>
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="transactionAmount">Amount (₹)</label>

              <input
                id="transactionAmount"
                type="number"
                min="0.01"
                step="0.01"
                value={amount}
                onChange={(event) =>
                  setAmount(event.target.value)
                }
                placeholder="Enter amount"
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="transactionCategory">
                Category
              </label>

              <select
                id="transactionCategory"
                value={category}
                onChange={(event) =>
                  setCategory(event.target.value)
                }
              >
                {(type === 'income'
                  ? ['Salary', 'Freelance', 'Other']
                  : EXPENSE_CATEGORIES
                ).map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="transactionDate">Date</label>

              <input
                id="transactionDate"
                type="date"
                value={transactionDate}
                onChange={(event) =>
                  setTransactionDate(event.target.value)
                }
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="transactionNote">Note</label>

              <input
                id="transactionNote"
                type="text"
                value={note}
                onChange={(event) =>
                  setNote(event.target.value)
                }
                placeholder="Optional note"
              />
            </div>

            <button
              type="submit"
              className="primary-button"
              disabled={saving}
            >
              {saving ? 'Saving...' : 'Add Transaction'}
            </button>
          </form>
        </section>

        {/* Transactions list */}
        <section
          className="content-card"
          id="transactions"
        >
          <div className="section-heading">
            <h2>Recent Transactions</h2>

            <button
              type="button"
              className="secondary-button"
              onClick={() => fetchTransactions(token)}
              disabled={loading}
            >
              {loading ? 'Loading...' : 'Refresh'}
            </button>
          </div>

          {loading ? (
            <p>Loading transactions...</p>
          ) : transactions.length === 0 ? (
            <p>No transactions found. Add your first transaction.</p>
          ) : (
            <div className="table-wrapper">
              <table className="transactions-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Title</th>
                    <th>Category</th>
                    <th>Note</th>
                    <th>Type</th>
                    <th>Amount</th>
                    <th>Action</th>
                  </tr>
                </thead>

                <tbody>
                  {[...transactions]
                    .sort(
                      (a, b) =>
                        new Date(b.date || b.createdAt) -
                        new Date(a.date || a.createdAt)
                    )
                    .map((transaction) => (
                      <tr key={transaction._id}>
                        <td>{getTransactionDate(transaction)}</td>

                        <td>{transaction.title || '—'}</td>

                        <td>{transaction.category}</td>

                        <td>{transaction.note || '—'}</td>

                        <td>
                          <span
                            className={`transaction-type ${
                              transaction.type
                            }`}
                          >
                            {transaction.type}
                          </span>
                        </td>

                        <td
                          className={
                            transaction.type === 'income'
                              ? 'income-text'
                              : 'expense-text'
                          }
                        >
                          {transaction.type === 'income'
                            ? '+'
                            : '-'}
                          {formatCurrency(transaction.amount)}
                        </td>

                        <td>
                          <button
                            type="button"
                            className="delete-button"
                            onClick={() =>
                              deleteTransaction(transaction._id)
                            }
                          >
                            Delete
                          </button>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* Budget management */}
        <section
          className="content-card budget-section"
          id="budgets"
        >
          <div className="section-heading">
            <div>
              <h2>Budget Management</h2>
              <p>Set monthly spending limits by category.</p>
            </div>

            <span className="month-badge">{currentMonth}</span>
          </div>

          <form
            className="budget-form"
            onSubmit={addBudget}
          >
            <div className="form-group">
              <label htmlFor="budgetCategory">Category</label>

              <select
                id="budgetCategory"
                value={budgetCategory}
                onChange={(event) =>
                  setBudgetCategory(event.target.value)
                }
              >
                {EXPENSE_CATEGORIES.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="budgetAmount">
                Monthly Limit (₹)
              </label>

              <input
                id="budgetAmount"
                type="number"
                min="1"
                step="0.01"
                value={budgetAmount}
                onChange={(event) =>
                  setBudgetAmount(event.target.value)
                }
                placeholder="Enter budget amount"
                required
              />
            </div>

            <button
              type="submit"
              className="primary-button"
              disabled={budgetSaving}
            >
              {budgetSaving ? 'Saving...' : 'Add Budget'}
            </button>
          </form>

          <div className="budget-list">
            {budgetLoading ? (
              <p>Loading budgets...</p>
            ) : budgetData.length === 0 ? (
              <p>
                No budgets set for this month. Add a category and
                spending limit above.
              </p>
            ) : (
              budgetData.map((budget) => (
                <div
                  className="budget-item"
                  key={budget._id}
                >
                  <div className="budget-item-header">
                    <h3>{budget.category}</h3>

                    <button
                      type="button"
                      className="budget-delete"
                      onClick={() => deleteBudget(budget._id)}
                    >
                      Delete
                    </button>
                  </div>

                  <div className="budget-amounts">
                    <span>
                      Spent: {formatCurrency(budget.spent)}
                    </span>

                    <span>
                      Limit: {formatCurrency(budget.limit)}
                    </span>
                  </div>

                  <div
                    className="budget-progress"
                    role="progressbar"
                    aria-label={`${budget.category} budget usage`}
                    aria-valuenow={Math.min(
                      Math.round(budget.percentage),
                      100
                    )}
                    aria-valuemin="0"
                    aria-valuemax="100"
                  >
                    <div
                      className={`budget-progress-fill ${budget.status}`}
                      style={{
                        width: `${budget.progress}%`,
                      }}
                    />
                  </div>

                  <div
                    className={`budget-status ${budget.status}`}
                  >
                    {budget.status === 'exceeded'
                      ? `Budget exceeded by ${formatCurrency(
                          budget.spent - budget.limit
                        )}`
                      : budget.status === 'warning'
                        ? `${budget.percentage.toFixed(
                            0
                          )}% of budget used`
                        : `${budget.percentage.toFixed(
                            0
                          )}% used · ${formatCurrency(
                            budget.limit - budget.spent
                          )} remaining`}
                  </div>
                </div>
              ))
            )}
          </div>
        </section>

        {/* Charts */}
        <section
          className="charts-grid"
          id="analytics"
        >
          <div className="content-card chart-card">
            <h2>Income vs Expenses</h2>

            {income === 0 && expenses === 0 ? (
              <p>No financial data available for this month.</p>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={barChartData}>
                  <CartesianGrid strokeDasharray="3 3" />

                  <XAxis dataKey="name" />

                  <YAxis />

                  <Tooltip
                    formatter={(value) => formatCurrency(value)}
                  />

                  <Legend />

                  <Bar
                    dataKey="amount"
                    name="Amount"
                    fill="#7c5cff"
                    radius={[6, 6, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>

          <div className="content-card chart-card">
            <h2>Expense Categories</h2>

            {expenseChartData.length === 0 ? (
              <p>No expenses available for this month.</p>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={expenseChartData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={90}
                    label
                  >
                    {expenseChartData.map((entry, index) => (
                      <Cell
                        key={entry.name}
                        fill={COLORS[index % COLORS.length]}
                      />
                    ))}
                  </Pie>

                  <Tooltip
                    formatter={(value) => formatCurrency(value)}
                  />

                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </section>

        <footer className="dashboard-footer">
          MoneyMate · Personal Finance Tracker
        </footer>
      </main>
    </div>
  );
}

export default App;