const { handleError } = require("../middelware/errorhandle")
const asyncHandler = require('express-async-handler')
const jwt = require('jsonwebtoken')
const bcrypt = require('bcryptjs')
const getUsers = asyncHandler(async (req, res) => {
    console.log(req.body)
    const goals = await User.find()
    res.status(200).json(goals)
})

const User = require('../Model/userModel')
const setUser = asyncHandler(async (req, res, next) => {
    console.log("Backend received data:", req.body);
    const { fullName, email, CompanyName, role, password } = req.body;

    if (!email || !fullName || !password) {
        res.status(400);
        return next(new Error('Please add all required fields (fullName, email, password)'));
    }

    const existingGoal = await User.findOne({ email });
    if (existingGoal) {
        return res.status(400).json({ message: "Email already exists" });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const user = await User.create({
        fullName,
        email,
        CompanyName,
        role,
        password: hashedPassword
    })

    if (user) {
        res.status(201).json({
            message: "Registetaion Sucess",
            token: generateToken(user._id)
        });
    } else {
        res.status(400);
        return next(new Error('Invalid user data'));
    }
})




const deleteUser = asyncHandler(async (req, res) => {
    const user = await User.findById(req.params.id)

    if (!user) {
        res.status(400)
        throw new Error('user not found')
    }

    await user.deleteOne()

    res.status(200).json({ id: req.params.id })
})


const updateUser = asyncHandler(async (req, res) => {
    const user = await User.findById(req.params.id)
    if (!user) {
        res.status(400)
        throw new Error('user not found')
    }
    const updatedGoal = await User.findByIdAndUpdate(req.params.id, req.body, {
        new: true,
    })
    res.status(200).json(updatedGoal)
})


const loginUser = asyncHandler(async (req, res, next) => {
    const { email, password } = req.body;

    const user = await User.findOne({ email });

    if (!user || !(await bcrypt.compare(password, user.password))) {
        res.status(400);
        return next(new Error("Invalid credentials"));
    }

    return res.json({
        message: "Login success",
        token: generateToken(user._id),
        role: user.role,
        fullName: user.fullName,
    });
});
const generateToken = (id) => {
    return jwt.sign({ id }, process.env.JWT_SECRET || 'secret123', {
        expiresIn: '30d',
    });
};

module.exports = {
    getUsers,
    setUser,
    deleteUser,
    updateUser,
    loginUser
}