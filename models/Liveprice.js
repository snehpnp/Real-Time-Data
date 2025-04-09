const mongoose = require("mongoose");

const tokenssSchema = new mongoose.Schema({

    instrument_token: String,
    exch_seg: String,
    symbol: String,
    expiry: String,
    segment: String,
    Exch: String,
    price: String,
}, { timestamps: true });

module.exports = mongoose.model("liveprice", tokenssSchema,"liveprice");
