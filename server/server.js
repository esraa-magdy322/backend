const express = require('express')
const dotenv = require('dotenv').config({ path: '../.env' })
const port = process.env.PORT || 5000
const { handleError } = require('../backend/middelware/errorhandle')
const colors = require('colors')
const connectDB = require('../backend/config/db')
const cors = require('cors');

connectDB()

const app = express()
app.use(cors());
app.use(express.json())
app.use(express.urlencoded({ extended: false }))

app.use('/api', require('../routes/goalRoutes'))
app.use(handleError)

if (process.env.NODE_ENV !== 'production' && !process.env.VERCEL) {
  app.listen(port, () => console.log(`Server started on port ${port}`.cyan.bold))
}

module.exports = app;
