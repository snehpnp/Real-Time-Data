const axios = require("axios");
const WebSocket = require("ws");
const CryptoJS = require("crypto-js");
const Stock = require("../models/Stock");
const Credential = require("../models/Credentials");
const {  redisClient } = require("../config/db");
require("dotenv").config();

let ws;

const Alice_Socket = async () => {
  try {
    console.log("Initializing AliceBlue WebSocket...");
    const now = new Date();
    const curtime = parseInt(`${now.getHours()}${now.getMinutes()}`);

    const credentialsGet = await Credential.findOne({});

    const {
      user_id: userId,
      access_token: userSession,
      channel_list,
    } = credentialsGet;

    const aliceBaseUrl =
      "https://ant.aliceblueonline.com/rest/AliceBlueAPIService/api/";
    const loginPayload = { loginType: "API" };
    const response = await axios.post(
      `${aliceBaseUrl}/ws/createSocketSess`,
      loginPayload,
      {
        headers: {
          Authorization: `Bearer ${userId} ${userSession}`,
          "Content-Type": "application/json",
        },
      }
    );

    if (response.data.stat !== "Ok") return;

    ws = new WebSocket("wss://ws1.aliceblueonline.com/NorenWS/");

    ws.onopen = () => {
      const encryptedToken = CryptoJS.SHA256(
        CryptoJS.SHA256(userSession).toString()
      ).toString();

      ws.send(
        JSON.stringify({
          susertoken: encryptedToken,
          t: "c",
          actid: `${userId}_API`,
          uid: `${userId}_API`,
          source: "API",
        })
      );
    };

    ws.onmessage = async (msg) => {
      const data = JSON.parse(msg.data);

      if (data.tk && data.lp && data.e && data.ft) {
        const now = new Date();
        const curTime = parseInt(`${now.getHours()}${now.getMinutes()}`);

        await Stock.updateOne(
          { _id: data.tk },
          {
            $set: {
              _id: data.tk,
              lp: data.lp,
              exc: data.e,
              curTime,
              ft: data.ft,
            },
          },
          { upsert: true }
        );

        // Cache in Redis
          await redisClient.set(`stock:${data.tk}`, JSON.stringify(data));
      } else if (data.s === "OK") {
        ws.send(JSON.stringify({ k: channel_list, t: "t" }));
      }
    };

    ws.onclose = () => {
      console.log("AliceBlue WebSocket closed. Reconnecting in 5s...");
      setTimeout(Alice_Socket, 5000);
    };
  } catch (error) {
    console.error("Error in Alice_Socket:", error);
  }
};

module.exports = { Alice_Socket };
