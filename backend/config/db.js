const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('../Model/userModel');

const connectDB = async () => {
    try {

        const dns = require('dns');
        dns.setServers(['8.8.8.8', '8.8.4.4']);

        const connect = await mongoose.connect(process.env.MONGO_URL);

        let admin = await User.findOne({
            email: "admin@gmail.com"
        });

        const hashedPassword = await bcrypt.hash("123456", 10);

        if (!admin) {
            await User.create({
                fullName: "Super Admin",
                email: "admin@gmail.com",
                phone: "+1234567890",
                password: hashedPassword,
                role: "superadmin",
                isActive: true,
            });
            console.log("Super Admin created");
        } else {
            admin.role = 'superadmin';
            admin.isActive = true;
            admin.password = hashedPassword;
            if (!admin.phone) admin.phone = "+1234567890";
            await admin.save();
            console.log("Super Admin account corrected");
        }

        console.log(`MongoDB Connected: ${connect.connection.host}`);

    } catch (error) {

        console.error(error.message);
        process.exit(1);

    }
};

module.exports = connectDB;