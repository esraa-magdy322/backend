const express = require('express')
const path = require('path')
const dotenv = require('dotenv')
dotenv.config({ path: path.join(__dirname, '../.env') })
const port = process.env.PORT || 5000
const { handleError } = require('../backend/middlewares/errorHandler')
const colors = require('colors')
const connectDB = require('../backend/config/db')
const cors = require('cors');

const app = express()

app.use(cors({
  origin: process.env.FRONTEND_ORIGIN || '*',
  methods: ['GET','POST','PUT','DELETE','OPTIONS'],
  allowedHeaders: ['Content-Type','Authorization'],
}));
app.use(express.json())
app.use(express.urlencoded({ extended: false }))

// Middleware to ensure DB connection per request in serverless environment
app.use(async (req, res, next) => {
  try {
    await connectDB();
  } catch (dbErr) {
    console.error('[DB Middleware Error]:', dbErr.message);
  }
  next();
});

// Start cron jobs only in standard node environments (not Vercel)
if (!process.env.VERCEL) {
  try {
    const { startCronJobs } = require('../backend/utils/cronJobs');
    startCronJobs();
  } catch (cronErr) {
    console.warn('[Cron Warning]:', cronErr.message);
  }
}

app.use('/api', require('../routes/goalRoutes'))
app.use('/api/auth', require('../routes/authRoutes'))
app.use('/api/admin', require('../routes/adminRoutes'))
app.use('/api/companies', require('../routes/companyRoutes'))
app.use('/api/subscriptions', require('../routes/subscriptionRoutes'))
app.use('/api/payments', require('../routes/paymentRoutes'))
app.use('/api/payroll', require('../routes/payrollRoutes'))
app.use('/odoo', require('../routes/odooRoutes'))        // ← Odoo 19 companies
app.use(handleError)

if (!process.env.VERCEL && require.main === module) {
  app.listen(port, () => console.log(`Server started on port ${port}`.cyan.bold))
}

module.exports = app;
