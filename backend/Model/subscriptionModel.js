const mongoose = require('mongoose');

const subscriptionSchema = new mongoose.Schema(
  {
    company: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Company',
      required: true,
      index: true,
    },
    plan: {
      type: String,
      enum: ['Basic', 'Professional', 'Enterprise'],
      default: 'Basic',
      required: true,
    },
    price: {
      type: Number,
      required: true,
      default: 0,
    },
    status: {
      type: String,
      enum: ['Pending', 'Active', 'Expired', 'Cancelled'],
      default: 'Pending',
    },
    paymentStatus: {
      type: String,
      enum: ['Pending', 'Paid', 'Failed', 'Refunded'],
      default: 'Pending',
    },
    startDate: {
      type: Date,
    },
    endDate: {
      type: Date,
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
    },
    gatewayReference: {
      type: String,
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

subscriptionSchema.index({ company: 1, status: 1 });

module.exports = mongoose.model('Subscription', subscriptionSchema);
