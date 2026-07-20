const yup = require('yup');

const updateCompanySchema = yup.object().shape({
  name: yup.string().trim().notRequired(),
  address: yup.string().trim().notRequired(),
  phone: yup.string().trim().notRequired(),
  email: yup.string().trim().email('Email must be valid').notRequired(),
  industry: yup.string().trim().notRequired(),
  employeesCount: yup.number().integer().min(0).notRequired(),
  logoUrl: yup.string().trim().url('Logo URL must be valid').notRequired(),
  website: yup.string().trim().url('Website must be valid').notRequired(),
});

module.exports = { updateCompanySchema };
