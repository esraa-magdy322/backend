const yup = require('yup');

const createPaymentSchema = yup.object().shape({
  companyId: yup.string().trim().notRequired(),
  subscriptionId: yup.string().trim().notRequired(),
  amount: yup.number().positive('Amount must be positive').required('Payment amount is required'),
  currency: yup.string().trim().default('USD'),
  method: yup.string().trim().required('Payment method is required'),
  transactionId: yup.string().trim().notRequired(),
  gateway: yup.string().trim().notRequired(),
  description: yup.string().trim().notRequired(),
  metadata: yup.object().notRequired(),
});

module.exports = { createPaymentSchema };
