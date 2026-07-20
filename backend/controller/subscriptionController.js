const asyncHandler = require('express-async-handler');
const Company = require('../Model/companyModel');
const Subscription = require('../Model/subscriptionModel');
const { logActivity } = require('../utils/activityLogger');

const createSubscription = asyncHandler(async (req, res) => {
  const { companyId, plan, price, startDate, endDate } = req.body;
  const resolvedCompanyId = companyId || req.user.company;

  if (!resolvedCompanyId || !plan || !price) {
    res.status(400);
    throw new Error('Company, plan, and price are required');
  }

  const company = await Company.findById(resolvedCompanyId);
  if (!company) {
    res.status(404);
    throw new Error('Company not found');
  }

  const subscription = await Subscription.create({
    company: company._id,
    plan,
    price,
    status: 'Pending',
    paymentStatus: 'Pending',
    startDate: startDate ? new Date(startDate) : new Date(),
    endDate: endDate ? new Date(endDate) : null,
  });

  company.subscription = subscription._id;
  company.currentPlan = plan;
  company.subscriptionStatus = 'Pending';
  await company.save();

  await logActivity({
    action: 'subscription_created',
    actorId: req.user._id,
    companyId: company._id,
    targetType: 'Subscription',
    targetId: subscription._id,
    metadata: { plan, price },
  });

  res.status(201).json(subscription);
});

const getSubscription = asyncHandler(async (req, res) => {
  const companyId = req.params.companyId || req.user.company;
  if (!companyId) {
    res.status(400);
    throw new Error('Company ID is required');
  }

  const subscription = await Subscription.findOne({ company: companyId }).sort({ createdAt: -1 });
  if (!subscription) {
    res.status(404);
    throw new Error('Subscription not found');
  }

  res.status(200).json(subscription);
});

const updateSubscription = asyncHandler(async (req, res) => {
  const subscription = await Subscription.findById(req.params.id);

  if (!subscription) {
    res.status(404);
    throw new Error('Subscription not found');
  }

  const updateData = { ...req.body };
  if (updateData.startDate) updateData.startDate = new Date(updateData.startDate);
  if (updateData.endDate) updateData.endDate = new Date(updateData.endDate);

  const updatedSubscription = await Subscription.findByIdAndUpdate(req.params.id, updateData, {
    new: true,
    runValidators: true,
  });

  await logActivity({
    action: 'subscription_updated',
    actorId: req.user._id,
    companyId: updatedSubscription.company,
    targetType: 'Subscription',
    targetId: updatedSubscription._id,
    metadata: updateData,
  });

  res.status(200).json(updatedSubscription);
});

const activateSubscription = asyncHandler(async (req, res) => {
  const subscription = await Subscription.findById(req.params.id);
  if (!subscription) {
    res.status(404);
    throw new Error('Subscription not found');
  }

  subscription.status = 'Active';
  subscription.paymentStatus = 'Paid';
  subscription.startDate = subscription.startDate || new Date();
  subscription.endDate = subscription.endDate || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  await subscription.save();

  await Company.findByIdAndUpdate(subscription.company, {
    subscriptionStatus: 'Active',
    status: 'active',
    currentPlan: subscription.plan,
  });

  await logActivity({
    action: 'subscription_activated',
    actorId: req.user._id,
    companyId: subscription.company,
    targetType: 'Subscription',
    targetId: subscription._id,
  });

  res.status(200).json(subscription);
});

const cancelSubscription = asyncHandler(async (req, res) => {
  const subscription = await Subscription.findById(req.params.id);
  if (!subscription) {
    res.status(404);
    throw new Error('Subscription not found');
  }

  subscription.status = 'Cancelled';
  subscription.paymentStatus = 'Cancelled';
  await subscription.save();

  await Company.findByIdAndUpdate(subscription.company, {
    subscriptionStatus: 'Cancelled',
    status: 'suspended',
  });

  await logActivity({
    action: 'subscription_cancelled',
    actorId: req.user._id,
    companyId: subscription.company,
    targetType: 'Subscription',
    targetId: subscription._id,
  });

  res.status(200).json(subscription);
});

module.exports = {
  createSubscription,
  getSubscription,
  updateSubscription,
  activateSubscription,
  cancelSubscription,
};
