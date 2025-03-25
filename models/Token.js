const mongoose = require("mongoose");

const tokenssSchema = new mongoose.Schema({
    token: String,
    exchange: String,


}, { timestamps: true });

module.exports = mongoose.model("Token", tokenssSchema,"Tokens");
