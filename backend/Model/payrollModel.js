const mongoose = require('mongoose');

const payslipSchema = new mongoose.Schema(
  {
    company: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Company',
      required: true,
      index: true,
    },
    employeeName: {
      type: String,
      required: true,
      trim: true,
    },
    employeeId: {
      type: String,
      trim: true,
    },
    department: {
      type: String,
      trim: true,
      default: '—',
    },
    baseSalary: {
      type: Number,
      required: true,
      default: 0,
    },
    bonus: {
      type: Number,
      default: 0,
    },
    deductions: {
      type: Number,
      default: 0,
    },
    netPay: {
      type: Number,
      default: 0,
    },
    status: {
      type: String,
      enum: ['Paid', 'Processing', 'Pending'],
      default: 'Processing',
    },
    month: {
      type: String,   // e.g. "2026-06"
      required: true,
      trim: true,
    },
    payDate: {
      type: Date,
    },
    notes: {
      type: String,
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

payslipSchema.index({ company: 1, month: 1 });

module.exports = mongoose.model('Payslip', payslipSchema);
