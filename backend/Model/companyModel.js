const mongoose = require('mongoose');

const companySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Please add a company name'],
      unique: true,
      trim: true,
      index: true,
    },
    address: {
      type: String,
      required: [true, 'Please add a company address'],
      trim: true,
    },
    phone: {
      type: String,
      required: [true, 'Please add a company phone number'],
      trim: true,
    },
    email: {
      type: String,
      required: [true, 'Please add a company email'],
      lowercase: true,
      trim: true,
    },
    industry: {
      type: String,
      trim: true,
      default: 'General',
    },
    employeesCount: {
      type: Number,
      default: 0,
    },
    logoUrl: {
      type: String,
      trim: true,
    },
    website: {
      type: String,
      trim: true,
    },
    status: {
      type: String,
      enum: ['pending', 'active', 'suspended', 'expired'],
      default: 'pending',
    },
    subscriptionStatus: {
      type: String,
      enum: ['Pending', 'Active', 'Expired', 'Cancelled'],
      default: 'Pending',
    },
    currentPlan: {
      type: String,
      enum: ['Basic', 'Professional', 'Enterprise'],
      default: 'Basic',
    },
    companyAdmin: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    subscription: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Subscription',
    },
  },
  {
    timestamps: true,
  }
);

companySchema.index({ name: 'text', email: 1, phone: 1 });

module.exports = mongoose.model('Company', companySchema);
