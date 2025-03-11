const mongoose = require("mongoose");

const CredentialsSchema = new mongoose.Schema({
    user_id: String,
    access_token: String,
    request_token: String,
    channel_list:String,

}, { timestamps: true });

module.exports = mongoose.model("Credentials", CredentialsSchema,"Credential");
