const asyncHandler = require('express-async-handler');
const bcrypt = require('bcryptjs');
const User = require('../Model/userModel');
const Company = require('../Model/companyModel');
const Subscription = require('../Model/subscriptionModel');
const Role = require('../Model/roleModel');
const VerificationCode = require('../Model/verificationCodeModel');
const { generateToken } = require('../utils/generateToken');
const { logActivity } = require('../utils/activityLogger');
const { sendMail } = require('../utils/mailer');

const registerCompanyAdmin = asyncHandler(async (req, res) => {
  const {
    companyName,
    CompanyName,
    adminName,
    fullName,
    adminEmail,
    email,
    phoneNumber,
    phone,
    address,
    companyAddress,
    employeesCount,
    password,
    industry,
    website,
    code,
  } = req.body;

  const resolvedCompanyName = companyName || CompanyName;
  const resolvedAdminName = adminName || fullName;
  const resolvedEmail = adminEmail || email;
  const resolvedPhone = phoneNumber || phone || '0000000000';
  const resolvedAddress = address || companyAddress || 'Default Company Address';
  const resolvedEmployeesCount = employeesCount || 1;

  if (
    !resolvedCompanyName ||
    !resolvedAdminName ||
    !resolvedEmail ||
    !password
  ) {
    res.status(400);
    throw new Error('All registration fields are required');
  }

  if (!code) {
    res.status(400);
    throw new Error('Verification code is required');
  }

  const verificationRecord = await VerificationCode.findOne({ email: resolvedEmail.toLowerCase() });
  if (!verificationRecord || verificationRecord.code !== code) {
    res.status(400);
    throw new Error('Invalid or expired verification code');
  }

  const existingUser = await User.findOne({ email: resolvedEmail.toLowerCase() });
  if (existingUser) {
    res.status(400);
    throw new Error('Email already exists');
  }

  const existingCompany = await Company.findOne({ name: resolvedCompanyName.trim() });
  if (existingCompany) {
    res.status(400);
    throw new Error('Company already exists');
  }

  // Verification passed, delete verification code
  await VerificationCode.deleteOne({ _id: verificationRecord._id });

  const company = await Company.create({
    name: resolvedCompanyName.trim(),
    address: resolvedAddress.trim(),
    phone: resolvedPhone.trim(),
    email: resolvedEmail.toLowerCase().trim(),
    industry: industry?.trim() || 'General',
    employeesCount: Number(resolvedEmployeesCount),
    status: 'pending',
    subscriptionStatus: 'Pending',
    currentPlan: 'Basic',
    website: website?.trim(),
  });

  const roleDoc = await Role.findOne({ name: 'COMPANY_ADMIN' });
  const defaultRoleRef = roleDoc?._id;

  const hashedPassword = await bcrypt.hash(password, 10);

  const user = await User.create({
    fullName: resolvedAdminName.trim(),
    email: resolvedEmail.toLowerCase().trim(),
    phone: resolvedPhone.trim(),
    password: hashedPassword,
    role: 'company_admin',
    roleRef: defaultRoleRef,
    company: company._id,
  });

  company.companyAdmin = user._id;
  await company.save();

  const subscription = await Subscription.create({
    company: company._id,
    plan: 'Basic',
    price: 0,
    status: 'Pending',
    paymentStatus: 'Pending',
    startDate: new Date(),
  });

  company.subscription = subscription._id;
  await company.save();

  await logActivity({
    action: 'company_registration',
    actorId: user._id,
    companyId: company._id,
    targetType: 'Company',
    targetId: company._id,
    metadata: {
      subscription: subscription._id,
      plan: 'Basic',
    },
  });

  res.status(201).json({
    message: 'Registration successful. Proceed to subscription.',
    token: generateToken(user._id),
    role: user.role,
    fullName: user.fullName,
    companyId: company._id,
  });
});

const loginUser = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  const user = await User.findOne({ email: email.toLowerCase() }).select('+password');
  if (!user) {
    res.status(401);
    throw new Error('Invalid credentials');
  }

  const isPasswordValid = await bcrypt.compare(password, user.password);
  if (!isPasswordValid) {
    res.status(401);
    throw new Error('Invalid credentials');
  }

  if (!user.isActive) {
    res.status(403);
    throw new Error('Account is inactive');
  }

  if (user.company) {
    const company = await Company.findById(user.company);
    if (company && (company.status === 'suspended' || company.subscriptionStatus === 'Expired')) {
      res.status(403);
      throw new Error('عفواً، اشتراك شركتك منتهي أو تم إيقافه. يرجى التواصل مع الإدارة للتجديد.');
    }
  }

  await logActivity({
    action: 'login',
    actorId: user._id,
    companyId: user.company,
    targetType: 'User',
    targetId: user._id,
    metadata: {
      role: user.role,
    },
  });

  res.status(200).json({
    message: 'Login successful',
    token: generateToken(user._id),
    role: user.role,
    fullName: user.fullName,
    companyId: user.company,
  });
});

const getCurrentUser = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id)
    .populate({ path: 'company', select: 'name address phone email industry employeesCount currentPlan subscriptionStatus' })
    .populate({ path: 'roleRef', select: 'name description permissions' })
    .select('-password');

  if (!user) {
    res.status(404);
    throw new Error('User not found');
  }

  res.status(200).json(user);
});

const sendVerificationCode = asyncHandler(async (req, res) => {
  const { email } = req.body;
  if (!email) {
    res.status(400);
    throw new Error('Email is required');
  }

  const normalizedEmail = email.toLowerCase().trim();

  const existingUser = await User.findOne({ email: normalizedEmail });
  if (existingUser) {
    res.status(400);
    throw new Error('Email already exists');
  }

  // Generate a random 6-digit verification code
  const code = Math.floor(100000 + Math.random() * 900000).toString();

  // Save to DB (expires in 10 minutes)
  await VerificationCode.findOneAndUpdate(
    { email: normalizedEmail },
    { code, createdAt: new Date() },
    { upsert: true, new: true }
  );

  console.log(`\n==============================================`);
  console.log(`Verification Code for ${normalizedEmail} is: ${code}`);
  console.log(`==============================================\n`);

  // Send email
  const emailHtml = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #ddd; border-radius: 10px; background-color: #0F2C59; color: white;">
      <h2 style="color: #D4AF37; text-align: center;">HRX Platform Verification</h2>
      <p>Hello,</p>
      <p>Thank you for choosing HRX. To complete your signup process, please use the following 6-digit verification code:</p>
      <div style="text-align: center; margin: 30px 0;">
        <span style="font-size: 32px; font-weight: bold; letter-spacing: 5px; color: #D4AF37; background: #1A3668; padding: 10px 20px; border-radius: 5px; border: 1px solid #D4AF37;">${code}</span>
      </div>
      <p>This code is valid for 10 minutes. Please do not share this code with anyone.</p>
      <p>Best regards,<br/>The HRX Team</p>
    </div>
  `;

  await sendMail({
    to: normalizedEmail,
    subject: 'HRX Signup Verification Code',
    html: emailHtml,
  });

  const responsePayload = { message: 'Verification code sent successfully' };
  if (process.env.NODE_ENV === 'development') {
    responsePayload.code = code;
  }

  res.status(200).json(responsePayload);
});

const updateUserProfile = asyncHandler(async (req, res) => {
  const { fullName, phone, password } = req.body;
  
  const user = await User.findById(req.user._id);
  if (!user) {
    res.status(404);
    throw new Error('User not found');
  }

  if (fullName) user.fullName = fullName.trim();
  if (phone) user.phone = phone.trim();
  
  if (password) {
    if (password.length < 6) {
      res.status(400);
      throw new Error('Password must be at least 6 characters');
    }
    user.password = await bcrypt.hash(password, 10);
  }

  await user.save();

  res.status(200).json({
    message: 'Profile updated successfully',
    role: user.role,
    fullName: user.fullName,
    phone: user.phone,
    token: generateToken(user._id),
  });
});

module.exports = {
  registerCompanyAdmin,
  loginUser,
  getCurrentUser,
  sendVerificationCode,
  updateUserProfile,
};
