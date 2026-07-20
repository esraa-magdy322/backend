const yup = require('yup');

const createSubscriptionSchema = yup.object().shape({
  companyId: yup.string().trim().required('Company ID is required'),
  plan: yup.string().trim().required('Subscription plan is required'),
  price: yup.number().positive('Price must be positive').required('Price is required'),
  currency: yup.string().trim().default('USD'),
  interval: yup.string().oneOf(['monthly', 'yearly', 'one-time']).required('Interval is required'),
  startDate: yup.date().notRequired(),
  endDate: yup.date().notRequired(),
  status: yup.string().oneOf(['pending', 'active', 'cancelled', 'expired']).notRequired(),
});

module.exports = { createSubscriptionSchema };
