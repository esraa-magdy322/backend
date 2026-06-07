const mongoose = require('mongoose');

const userSchema = new mongoose.Schema(
  {
    fullName: {
      type: String,
      required: [true, 'please add a FullName Value']
    },
    email:{
        type:String,
        required:[true,'please add an email value'],
        unique: true
    },
    CompanyName:{
        type:String
    },
    role:{
      type:String,
      required:[true,'please add the role'],
      enum: ['HR Manager', 'Manager', 'Employee',"admin"],

    },
    
    password: {
      type: String,
      required: [true, 'please add a password']
    }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model('User', userSchema);
