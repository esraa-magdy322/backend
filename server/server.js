const express = require('express')
const dotenv = require('dotenv').config({ path: '../.env' })
const port = process.env.PORT || 5000
const { handleError } = require('../backend/middlewares/errorHandler')
const colors = require('colors')
const connectDB = require('../backend/config/db')
const cors = require('cors');

connectDB()
const { startCronJobs } = require('../backend/utils/cronJobs');
startCronJobs();

const app = express()
app.use(cors({
  origin: process.env.FRONTEND_ORIGIN || '*',
  methods: ['GET','POST','PUT','DELETE','OPTIONS'],
  allowedHeaders: ['Content-Type','Authorization'],
}));
app.use(express.json())
app.use(express.urlencoded({ extended: false }))

app.use('/api', require('../routes/goalRoutes'))
app.use('/api/auth', require('../routes/authRoutes'))
app.use('/api/admin', require('../routes/adminRoutes'))
app.use('/api/companies', require('../routes/companyRoutes'))
app.use('/api/subscriptions', require('../routes/subscriptionRoutes'))
app.use('/api/payments', require('../routes/paymentRoutes'))
app.use('/api/payroll', require('../routes/payrollRoutes'))
app.use('/odoo', require('../routes/odooRoutes'))        // ← Odoo 19 companies
if (process.env.NODE_ENV !== 'production' && !process.env.VERCEL) {
  app.listen(port, () => console.log(`Server started on port ${port}`.cyan.bold))
} else if (!process.env.VERCEL) {
  app.listen(port, () => console.log(`Server started on port ${port}`.cyan.bold))
}

module.exports = app;
