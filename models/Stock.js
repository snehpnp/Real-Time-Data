const mongoose = require("mongoose");

const StockSchema = new mongoose.Schema({
  _id: String,
  lp: Number, // Last Price
  exc: String, // Exchange
  curTime: Number, // Timestamp
  ft: String, // Future Trade Indicator
}, { timestamps: true });

module.exports = mongoose.model("Stock", StockSchema);
