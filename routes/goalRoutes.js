const express = require('express')
const router = express.Router()

const { getUsers, setUser, deleteUser, updateUser, loginUser } = require('../backend/controller/goalcontroller')
const { protect } = require('../backend/middelware/authMiddleware')

router.route('/signUp').get(protect, getUsers).post(setUser)
router.route('/login').post(loginUser)
router.route('/:id').put(protect, updateUser).delete(protect, deleteUser)
module.exports = router
