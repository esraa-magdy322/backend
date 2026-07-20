const asyncHandler = require('express-async-handler');
const Company = require('../Model/companyModel');
const Payment = require('../Model/paymentModel');
const Subscription = require('../Model/subscriptionModel');
const User = require('../Model/userModel');
const { logActivity } = require('../utils/activityLogger');

const getDashboardStats = asyncHandler(async (req, res) => {
  const totalCompanies = await Company.countDocuments();
  const activeCompanies = await Company.countDocuments({ subscriptionStatus: 'Active' });
  const pendingCompanies = await Company.countDocuments({ subscriptionStatus: 'Pending' });
  const expiredCompanies = await Company.countDocuments({ subscriptionStatus: 'Expired' });

  const revenueAggregate = await Payment.aggregate([
    { $match: { status: 'Paid' } },
    {
      $group: {
        _id: null,
        totalRevenue: { $sum: '$amount' },
      },
    },
  ]);

  const totalRevenue = revenueAggregate[0]?.totalRevenue || 0;

  res.status(200).json({
    totalCompanies,
    activeCompanies,
    pendingCompanies,
    expiredCompanies,
    totalRevenue,
  });
});

const getCompanies = asyncHandler(async (req, res) => {
  const { search, name, subscriptionStatus, plan, status } = req.query;
  const filter = {};

  if (name) {
    filter.name = { $regex: name, $options: 'i' };
  }

  if (search) {
    filter.$or = [
      { name: { $regex: search, $options: 'i' } },
      { email: { $regex: search, $options: 'i' } },
      { phone: { $regex: search, $options: 'i' } },
    ];
  }
  if (subscriptionStatus) {
    filter.subscriptionStatus = subscriptionStatus;
  }
  if (plan) {
    filter.currentPlan = plan;
  }
  if (status) {
    filter.status = status;
  }

  const companies = await Company.find(filter)
    .populate({ path: 'companyAdmin', select: 'fullName email phone role' })
    .populate({ path: 'subscription', select: 'plan status paymentStatus endDate' })
    .sort({ createdAt: -1 });

  // إذا كانت الشركة بدون بريد إلكتروني → نأخذه من الأدمن المسجّل
  const companiesWithEmail = companies.map((c) => {
    const obj = c.toObject();
    if (!obj.email && obj.companyAdmin?.email) {
      obj.email = obj.companyAdmin.email;
    }
    return obj;
  });

  res.status(200).json(companiesWithEmail);
});

const getCompanyById = asyncHandler(async (req, res) => {
  const company = await Company.findById(req.params.id)
    .populate({ path: 'companyAdmin', select: 'fullName email phone role' })
    .populate({ path: 'subscription', select: 'plan status paymentStatus startDate endDate price' });

  if (!company) {
    res.status(404);
    throw new Error('Company not found');
  }

  res.status(200).json(company);
});

const createCompany = asyncHandler(async (req, res) => {
  const {
    name,
    address,
    phone,
    email,
    industry,
    employeesCount,
    currentPlan,
    status,
    subscriptionStatus,
    logoUrl,
    website,
    companyAdminId,
  } = req.body;

  if (!name || !address || !phone || !email) {
    res.status(400);
    throw new Error('Company name, address, phone and email are required');
  }

  const existingCompany = await Company.findOne({ name: name.trim() });
  if (existingCompany) {
    res.status(400);
    throw new Error('Company already exists');
  }

  const company = await Company.create({
    name: name.trim(),
    address: address.trim(),
    phone: phone.trim(),
    email: email.toLowerCase().trim(),
    industry: industry?.trim() || 'General',
    employeesCount: Number(employeesCount) || 0,
    currentPlan: currentPlan || 'Basic',
    status: status || 'pending',
    subscriptionStatus: subscriptionStatus || 'Pending',
    logoUrl,
    website,
    companyAdmin: companyAdminId,
  });

  await logActivity({
    action: 'company_created',
    actorId: req.user._id,
    companyId: company._id,
    targetType: 'Company',
    targetId: company._id,
    metadata: { companyName: company.name },
  });

  res.status(201).json(company);
});

const updateCompany = asyncHandler(async (req, res) => {
  const company = await Company.findById(req.params.id);
  if (!company) {
    res.status(404);
    throw new Error('Company not found');
  }

  const updateData = { ...req.body };
  if (updateData.name) updateData.name = updateData.name.trim();
  if (updateData.email) updateData.email = updateData.email.toLowerCase().trim();
  if (updateData.phone) updateData.phone = updateData.phone.trim();
  if (updateData.address) updateData.address = updateData.address.trim();

  const updatedCompany = await Company.findByIdAndUpdate(req.params.id, updateData, {
    new: true,
    runValidators: true,
  });

  await logActivity({
    action: 'company_updated',
    actorId: req.user._id,
    companyId: updatedCompany._id,
    targetType: 'Company',
    targetId: updatedCompany._id,
    metadata: updateData,
  });

  res.status(200).json(updatedCompany);
});

const deleteCompany = asyncHandler(async (req, res) => {
  const company = await Company.findById(req.params.id);
  if (!company) {
    res.status(404);
    throw new Error('Company not found');
  }

  await company.deleteOne();

  await logActivity({
    action: 'company_deleted',
    actorId: req.user._id,
    companyId: company._id,
    targetType: 'Company',
    targetId: company._id,
    metadata: { name: company.name },
  });

  res.status(200).json({ message: 'Company deleted successfully', id: req.params.id });
});

const activateCompany = asyncHandler(async (req, res) => {
  const company = await Company.findById(req.params.id);
  if (!company) {
    res.status(404);
    throw new Error('Company not found');
  }

  company.status = 'active';
  company.subscriptionStatus = 'Active';
  await company.save();

  await logActivity({
    action: 'company_activated',
    actorId: req.user._id,
    companyId: company._id,
    targetType: 'Company',
    targetId: company._id,
  });

  res.status(200).json(company);
});

const suspendCompany = asyncHandler(async (req, res) => {
  const company = await Company.findById(req.params.id);
  if (!company) {
    res.status(404);
    throw new Error('Company not found');
  }

  company.status = 'suspended';
  company.subscriptionStatus = 'Cancelled';
  await company.save();

  await logActivity({
    action: 'company_suspended',
    actorId: req.user._id,
    companyId: company._id,
    targetType: 'Company',
    targetId: company._id,
  });

  res.status(200).json(company);
});

module.exports = {
  getDashboardStats,
  getCompanies,
  getCompanyById,
  createCompany,
  updateCompany,
  deleteCompany,
  activateCompany,
  suspendCompany,
};
