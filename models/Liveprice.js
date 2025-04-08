const mongoose = require("mongoose");

const tokenssSchema = new mongoose.Schema({

    exchange: String,
    symbol: String,
    expiry: String,
    segment: String,
    instrument_token: String,
    price: String,


}, { timestamps: true });

module.exports = mongoose.model("liveprice", tokenssSchema,"liveprice");
