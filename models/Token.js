const mongoose = require("mongoose");

const tokenssSchema = new mongoose.Schema(
  {
    instrument_token: {
      type: String,
      required: true,
      unique: true,
    },
    exch_seg: String,
    symbol: String,
    expiry: String,
    segment: String,
    Exch: String,
    price: String,
  },
  { timestamps: true }
);

module.exports = mongoose.model("Token", tokenssSchema, "Tokens");
