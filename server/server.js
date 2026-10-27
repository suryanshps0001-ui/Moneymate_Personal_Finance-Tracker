
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const Transaction = require('./models/Transaction');
const User = require('./models/User');
const Budget = require('./models/Budget');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// =====================================
// AUTHENTICATION MIDDLEWARE
// =====================================

const authenticateToken = (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      success: false,
      message: 'Please login first'
    });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.userId = decoded.userId;
    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: 'Invalid or expired token'
    });
  }
};

// =====================================
// HOME & HEALTH
// =====================================

app.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'Personal Finance Tracker API is running!'
  });
});

app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    message: 'Server is healthy'
  });
});

// =====================================
// SIGNUP
// =====================================

app.post('/api/auth/signup', async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Name, email and password are required'
      });
    }

    if (typeof password !== 'string' || password.length < 8) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 8 characters'
      });
    }

    if (typeof name !== 'string' || typeof email !== 'string') {
      return res.status(400).json({
        success: false,
        message: 'Invalid name or email'
      });
    }

    const normalizedEmail = email.trim().toLowerCase();

    const existingUser = await User.findOne({
      email: normalizedEmail
    });

    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: 'An account with this email already exists'
      });
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    const user = await User.create({
      name: name.trim(),
      email: normalizedEmail,
      password: hashedPassword
    });

    const token = jwt.sign(
      { userId: user._id.toString() },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    return res.status(201).json({
      success: true,
      message: 'Account created successfully',
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email
      }
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: 'An account with this email already exists'
      });
    }

    console.error('Signup error:', error.message);

    return res.status(500).json({
      success: false,
      message: 'Failed to create account'
    });
  }
});

// =====================================
// LOGIN
// =====================================

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email and password are required'
      });
    }

    const user = await User.findOne({
      email: email.trim().toLowerCase()
    });

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      });
    }

    const passwordMatches = await bcrypt.compare(
      password,
      user.password
    );

    if (!passwordMatches) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      });
    }

    const token = jwt.sign(
      { userId: user._id.toString() },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    return res.json({
      success: true,
      message: 'Login successful',
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email
      }
    });
  } catch (error) {
    console.error('Login error:', error.message);

    return res.status(500).json({
      success: false,
      message: 'Login failed'
    });
  }
});

// =====================================
// GET CURRENT USER
// =====================================

app.get('/api/auth/me', authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.userId).select('-password');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.json({
      success: true,
      user: {
        id: user._id,
        name: user.name,
        email: user.email
      }
    });
  } catch (error) {
    console.error('Fetch user error:', error.message);

    res.status(500).json({
      success: false,
      message: 'Failed to fetch user'
    });
  }
});

// =====================================
// GET USER'S TRANSACTIONS
// =====================================

app.get('/api/transactions', authenticateToken, async (req, res) => {
  try {
    const transactions = await Transaction.find({
      user: req.userId
    }).sort({ date: -1 });

    res.json({
      success: true,
      data: transactions
    });
  } catch (error) {
    console.error('Fetch transactions error:', error.message);

    res.status(500).json({
      success: false,
      message: 'Failed to fetch transactions'
    });
  }
});

// =====================================
// ADD TRANSACTION
// =====================================

app.post('/api/transactions', authenticateToken, async (req, res) => {
  try {
    const { title, amount, type, category, date, note } = req.body;

    if (
      typeof title !== 'string' ||
      !title.trim() ||
      !['income', 'expense'].includes(type) ||
      typeof category !== 'string' ||
      !category.trim() ||
      amount === undefined ||
      amount === null ||
      amount === '' ||
      !Number.isFinite(Number(amount)) ||
      Number(amount) <= 0
    ) {
      return res.status(400).json({
        success: false,
        message: 'Valid title, positive amount, type and category are required'
      });
    }

    const transaction = await Transaction.create({
      title: title.trim(),
      amount: Number(amount),
      type,
      category: category.trim(),
      date: date || Date.now(),
      note: typeof note === 'string' ? note.trim() : '',
      user: req.userId
    });

    res.status(201).json({
      success: true,
      message: 'Transaction added successfully',
      data: transaction
    });
  } catch (error) {
    console.error('Add transaction error:', error.message);

    res.status(400).json({
      success: false,
      message: error.message
    });
  }
});

// =====================================
// DELETE USER'S TRANSACTION
// =====================================

app.delete('/api/transactions/:id', authenticateToken, async (req, res) => {
  try {
    const transaction = await Transaction.findOneAndDelete({
      _id: req.params.id,
      user: req.userId
    });

    if (!transaction) {
      return res.status(404).json({
        success: false,
        message: 'Transaction not found'
      });
    }

    res.json({
      success: true,
      message: 'Transaction deleted successfully'
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: 'Invalid transaction ID'
    });
  }
});

// =====================================
// GET MONTHLY BUDGETS
// GET /api/budgets?month=2026-10
// =====================================

app.get('/api/budgets', authenticateToken, async (req, res) => {
  try {
    const { month } = req.query;

    if (!month || !/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) {
      return res.status(400).json({
        success: false,
        message: 'Provide a valid month in YYYY-MM format'
      });
    }

    const budgets = await Budget.find({
      user: req.userId,
      month
    }).sort({ category: 1 });

    res.json({
      success: true,
      data: budgets
    });
  } catch (error) {
    console.error('Fetch budgets error:', error.message);

    res.status(500).json({
      success: false,
      message: 'Failed to fetch budgets'
    });
  }
});

// =====================================
// CREATE OR UPDATE MONTHLY BUDGET
// POST /api/budgets
// =====================================

app.post('/api/budgets', authenticateToken, async (req, res) => {
  try {
    const { category, amount, month } = req.body;

    if (
      typeof category !== 'string' ||
      !category.trim() ||
      category.trim().length > 100 ||
      amount === undefined ||
      amount === null ||
      amount === '' ||
      !Number.isFinite(Number(amount)) ||
      Number(amount) <= 0 ||
      !month ||
      typeof month !== 'string' ||
      !/^\d{4}-(0[1-9]|1[0-2])$/.test(month)
    ) {
      return res.status(400).json({
        success: false,
        message: 'Valid category, positive amount and month (YYYY-MM) are required'
      });
    }

    const cleanCategory = category.trim();

    const budget = await Budget.findOneAndUpdate(
      {
        user: req.userId,
        category: cleanCategory,
        month
      },
      {
        $set: {
          amount: Number(amount)
        },
        $setOnInsert: {
          user: req.userId,
          category: cleanCategory,
          month
        }
      },
      {
        new: true,
        upsert: true,
        runValidators: true,
        setDefaultsOnInsert: true
      }
    );

    res.json({
      success: true,
      message: 'Budget saved successfully',
      data: budget
    });
  } catch (error) {
    console.error('Save budget error:', error.message);

    res.status(500).json({
      success: false,
      message: 'Failed to save budget'
    });
  }
});

// =====================================
// DELETE MONTHLY BUDGET
// DELETE /api/budgets/:id
// =====================================

app.delete('/api/budgets/:id', authenticateToken, async (req, res) => {
  try {
    const budget = await Budget.findOneAndDelete({
      _id: req.params.id,
      user: req.userId
    });

    if (!budget) {
      return res.status(404).json({
        success: false,
        message: 'Budget not found'
      });
    }

    res.json({
      success: true,
      message: 'Budget deleted successfully'
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: 'Invalid budget ID'
    });
  }
});

// =====================================
// CONNECT DATABASE & START SERVER
// =====================================

if (!process.env.MONGODB_URI || !process.env.JWT_SECRET) {
  console.error(
    'Error: MONGODB_URI and JWT_SECRET must be set in your .env file'
  );
  process.exit(1);
}

mongoose
  .connect(process.env.MONGODB_URI)
  .then(() => {
    console.log('MongoDB connected successfully!');

    app.listen(PORT, () => {
      console.log(`Server running at http://localhost:${PORT}`);
    });
  })
  .catch((error) => {
    console.error('MongoDB connection failed:', error.message);
    process.exit(1);
  });

