const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('../Model/userModel');

let isConnected = false;

const connectDB = async () => {
    if (isConnected || mongoose.connection.readyState >= 1) {
        return;
    }

    try {
        if (!process.env.VERCEL) {
            try {
                const dns = require('dns');
                dns.setServers(['8.8.8.8', '8.8.4.4']);
            } catch (dnsErr) {
                console.warn("[DB] Custom DNS setServers warning:", dnsErr.message);
            }
        }

        const mongoUrl = process.env.MONGO_URL || process.env.MONGO_URI;
        if (!mongoUrl) {
            console.error("[DB] MONGO_URL or MONGO_URI missing in environment variables.");
            throw new Error("MONGO_URL missing in environment variables");
        }

        const connect = await mongoose.connect(mongoUrl, {
            serverSelectionTimeoutMS: 8000,
        });
        isConnected = true;
        console.log(`MongoDB Connected: ${connect.connection.host}`);

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

    } catch (error) {
        console.error("[DB Error]:", error.message);
        throw error;
    }
};

module.exports = connectDB;