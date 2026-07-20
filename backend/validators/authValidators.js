const yup = require('yup');

const registerSchema = yup.object().shape({
  companyName: yup.string().trim(),
  CompanyName: yup.string().trim(),
  adminName: yup.string().trim(),
  fullName: yup.string().trim(),
  adminEmail: yup.string().trim().email('Admin Email must be valid'),
  email: yup.string().trim().email('Email must be valid'),
  phoneNumber: yup.string().trim(),
  phone: yup.string().trim(),
  address: yup.string().trim(),
  companyAddress: yup.string().trim(),
  employeesCount: yup.number().integer().min(1, 'Employees Count must be at least 1'),
  password: yup.string().min(6, 'Password must be at least 6 characters').required('Password is required'),
  code: yup.string().trim().required('Verification code is required'),
  industry: yup.string().trim(),
  website: yup.string().trim().url('Website must be a valid URL').notRequired(),
}).test('signup-keys-check', 'Missing company name, admin name, or email', function(value) {
  const hasCompany = value.companyName || value.CompanyName;
  const hasName = value.adminName || value.fullName;
  const hasEmail = value.adminEmail || value.email;
  if (!hasCompany) {
    return this.createError({ path: 'companyName', message: 'Company Name is required' });
  }
  if (!hasName) {
    return this.createError({ path: 'adminName', message: 'Admin Name is required' });
  }
  if (!hasEmail) {
    return this.createError({ path: 'adminEmail', message: 'Email address is required' });
  }
  return true;
});

const loginSchema = yup.object().shape({
  email: yup.string().trim().email('Email must be valid').required('Email is required'),
  password: yup.string().required('Password is required'),
});

module.exports = { registerSchema, loginSchema };
