const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true
    },

    amount: {
      type: Number,
      required: true,
      min: 0
    },

    type: {
      type: String,
      enum: ['income', 'expense'],
      required: true
    },

    category: {
      type: String,
      required: true,
      trim: true
    },

    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },

    date: {
      type: Date,
      default: Date.now
    },

    note: {
      type: String,
      trim: true,
      default: ''
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model('Transaction', transactionSchema);

