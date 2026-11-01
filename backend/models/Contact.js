const mongoose = require("mongoose");

const contactSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
    maxlength: 100
  },
  email: {
    type: String,
    required: true,
    trim: true,
    lowercase: true,
    maxlength: 254
  },
  company: {
    type: String,
    trim: true,
    maxlength: 120,
    default: ""
  },
  message: {
    type: String,
    required: true,
    trim: true,
    maxlength: 2000
  },
  status: {
    type: String,
    enum: ["pending", "reviewed", "resolved"],
    default: "pending"
  }
}, { timestamps: true });

module.exports = mongoose.model("Contact", contactSchema);