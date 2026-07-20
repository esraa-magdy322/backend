const asyncHandler = require('express-async-handler');
const Company = require('../Model/companyModel');
const { logActivity } = require('../utils/activityLogger');

const getCompanyProfile = asyncHandler(async (req, res) => {
  const companyId = req.user.company;
  if (!companyId) {
    res.status(400);
    throw new Error('Company association is missing');
  }

  const company = await Company.findById(companyId)
    .populate({ path: 'companyAdmin', select: 'fullName email phone role' })
    .populate({ path: 'subscription', select: 'plan paymentStatus status startDate endDate price' });

  if (!company) {
    res.status(404);
    throw new Error('Company not found');
  }

  res.status(200).json(company);
});

const updateCompanyProfile = asyncHandler(async (req, res) => {
  const companyId = req.user.company;
  if (!companyId) {
    res.status(400);
    throw new Error('Company association is missing');
  }

  const company = await Company.findById(companyId);
  if (!company) {
    res.status(404);
    throw new Error('Company not found');
  }

  const updateData = { ...req.body };
  if (updateData.name) updateData.name = updateData.name.trim();
  if (updateData.email) updateData.email = updateData.email.toLowerCase().trim();
  if (updateData.phone) updateData.phone = updateData.phone.trim();
  if (updateData.address) updateData.address = updateData.address.trim();

  const updatedCompany = await Company.findByIdAndUpdate(companyId, updateData, {
    new: true,
    runValidators: true,
  });

  await logActivity({
    action: 'company_profile_updated',
    actorId: req.user._id,
    companyId: updatedCompany._id,
    targetType: 'Company',
    targetId: updatedCompany._id,
    metadata: updateData,
  });

  res.status(200).json(updatedCompany);
});

const updateCompanyLogo = asyncHandler(async (req, res) => {
  const companyId = req.user.company;
  if (!companyId) {
    res.status(400);
    throw new Error('Company association is missing');
  }

  const { logoUrl } = req.body;
  if (!logoUrl) {
    res.status(400);
    throw new Error('Logo URL is required');
  }

  const company = await Company.findByIdAndUpdate(
    companyId,
    { logoUrl: logoUrl.trim() },
    { new: true, runValidators: true }
  );

  await logActivity({
    action: 'company_logo_updated',
    actorId: req.user._id,
    companyId: company._id,
    targetType: 'Company',
    targetId: company._id,
    metadata: { logoUrl },
  });

  res.status(200).json(company);
});

module.exports = {
  getCompanyProfile,
  updateCompanyProfile,
  updateCompanyLogo,
};
