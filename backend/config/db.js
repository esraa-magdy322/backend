const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('../Model/userModel');

const connectDB = async () => {
    try {
        const connect = await mongoose.connect(process.env.MONGO_URL);

        const admin = await User.findOne({
            email: "admin@gmail.com"
        });

        if (!admin) {
            const hashedPassword = await bcrypt.hash("123456", 10);
            await User.create({
                fullName: "Admin",
                email: "admin@gmail.com",
                password: hashedPassword,
                role: "admin"
            });
            console.log("Admin created");
        }

        console.log(`MongoDB Connected: ${connect.connection.host}`);
    } catch (error) {
        console.error("MongoDB Connection Error: ", error.message);
        // Do not process.exit in serverless environment
        throw error;
    }
};

module.exports = connectDB;