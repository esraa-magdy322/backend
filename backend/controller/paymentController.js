const asyncHandler = require('express-async-handler');
const Payment = require('../Model/paymentModel');
const Company = require('../Model/companyModel');
const Subscription = require('../Model/subscriptionModel');
const { logActivity } = require('../utils/activityLogger');

const createPayment = asyncHandler(async (req, res) => {
  const { companyId, subscriptionId, amount, currency, method, transactionId, gateway, description, metadata } = req.body;
  const resolvedCompanyId = companyId || req.user.company;

  if (!resolvedCompanyId || !amount || !method) {
    res.status(400);
    throw new Error('companyId, amount, and method are required');
  }

  const company = await Company.findById(resolvedCompanyId);
  if (!company) {
    res.status(404);
    throw new Error('Company not found');
  }

  const payment = await Payment.create({
    company: resolvedCompanyId,
    subscription: subscriptionId,
    amount,
    currency: currency || 'USD',
    method: method.trim(),
    transactionId: transactionId?.trim(),
    gateway: gateway?.trim() || 'stripe',
    status: 'Paid',
    description: description?.trim(),
    metadata,
  });

  if (subscriptionId) {
    await Subscription.findByIdAndUpdate(subscriptionId, {
      paymentStatus: 'Paid',
      status: 'Active',
    });
  }

  await Company.findByIdAndUpdate(resolvedCompanyId, {
    subscriptionStatus: 'Active',
    status: 'active',
  });

  await logActivity({
    action: 'payment_received',
    actorId: req.user._id,
    companyId: resolvedCompanyId,
    targetType: 'Payment',
    targetId: payment._id,
    metadata: { amount, currency, method, transactionId },
  });

  res.status(201).json(payment);
});

const getCompanyPayments = asyncHandler(async (req, res) => {
  const companyId = req.params.companyId || req.user.company;
  if (!companyId) {
    res.status(400);
    throw new Error('Company ID is required');
  }

  const payments = await Payment.find({ company: companyId }).sort({ createdAt: -1 });
  res.status(200).json(payments);
});

const getPaymentById = asyncHandler(async (req, res) => {
  const payment = await Payment.findById(req.params.id);
  if (!payment) {
    res.status(404);
    throw new Error('Payment not found');
  }

  res.status(200).json(payment);
});

const updatePaymentStatus = asyncHandler(async (req, res) => {
  const { status } = req.body;
  const payment = await Payment.findById(req.params.id);
  if (!payment) {
    res.status(404);
    throw new Error('Payment not found');
  }

  payment.status = status || payment.status;
  await payment.save();

  await logActivity({
    action: 'payment_status_updated',
    actorId: req.user._id,
    companyId: payment.company,
    targetType: 'Payment',
    targetId: payment._id,
    metadata: { status },
  });

  res.status(200).json(payment);
});

module.exports = {
  createPayment,
  getCompanyPayments,
  getPaymentById,
  updatePaymentStatus,
};
