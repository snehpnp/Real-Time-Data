const mongoose = require("mongoose");

const oneMinuteDataSchema = new mongoose.Schema(
  {
    _id: String,
    lp: Number, // Last Price
    exc: String, // Exchange
    curTime: Number, // Timestamp
    ft: String, // Future Trade Indicator
    t: String, // Trade Indicator
    pc: String, // Previous Close
    v: String, // Volume
    bp1: String, // Best Buy Price
    sp1: String, // Best Sell Price
    bq1: String, // Best Buy Quantity
    sq1: String, // Best Sell Quantity
    token: String,

    avgLp: Number,
    totalVolume: Number,
    highLp: Number,
    lowLp: Number,
    openLp: Number,
    closeLp: Number,
    count: Number,
  },
  { timestamps: true }
);

module.exports = mongoose.model("oneMinuteData", oneMinuteDataSchema);
