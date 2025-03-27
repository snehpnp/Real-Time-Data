const axios = require("axios");
const WebSocket = require("ws");
const CryptoJS = require("crypto-js");
const Stock = require("../models/Stock");
const Credential = require("../models/Credentials");
const { io } = require("../server"); // ✅ Import io instance

let ws;
let isSocketConnected = false; // Track WebSocket connection status

const Alice_Socket = async () => {
  try {
    console.log("🚀 Initializing AliceBlue WebSocket...");

    const credentialsGet = await Credential.findOne({});
    if (!credentialsGet) {
      console.error("❌ No credentials found!");
      return;
    }
    if(credentialsGet?.user_id == "" || credentialsGet?.access_token == "" || credentialsGet?.channel_list == "" ||  credentialsGet?.access_token == null || credentialsGet?.channel_list == null || credentialsGet?.user_id == null){
      console.error("❌ No credentials found!");
      return;
    }

    const {
      user_id: userId,
      access_token: userSession,
      channel_list,
    } = credentialsGet;

    const aliceBaseUrl =
      "https://ant.aliceblueonline.com/rest/AliceBlueAPIService/api/";
    const response = await axios.post(
      `${aliceBaseUrl}/ws/createSocketSess`,
      { loginType: "API" },
      {
        headers: {
          Authorization: `Bearer ${userId} ${userSession}`,
          "Content-Type": "application/json",
        },
      }
    );

    if (response.data.stat !== "Ok") {
      console.error("❌ Failed to create WebSocket session:", response.data);
      return;
    }

    ws = new WebSocket("wss://ws1.aliceblueonline.com/NorenWS/");

    ws.onopen = function () {
      console.log("✅ WebSocket Connected!");
      isSocketConnected = true;

      const encrcptToken = CryptoJS.SHA256(
        CryptoJS.SHA256(userSession).toString()
      ).toString();

      const initCon = {
        susertoken: encrcptToken,
        t: "c",
        actid: userId + "_API",
        uid: userId + "_API",
        source: "API",
      };

      ws.send(JSON.stringify(initCon));
    };

    ws.onmessage = async function (msg) {
      const response = JSON.parse(msg.data);

      if (response.tk) {
        try {
          if (
            response.lp !== undefined &&
            response.e !== undefined &&
            response.ft !== undefined
          ) {
            const now = new Date();
            const curTime = parseInt(`${now.getHours()}${now.getMinutes()}`);

            // Emit stock update via Socket.IO
            io.emit("stockUpdate", {
              token: response.tk,
              exchange: response.e,
              timestamp: curTime,
              lp: response.lp,
              t: response?.t,
              pc: response?.pc,
              v: response?.v,
              ft: response?.ft,
              bp1: response?.bp1,
              sp1: response?.sp1,
              bq1: response?.bq1,
              sq1: response?.sq1,
            });

            // Update stock data in the database
            // await Stock.updateOne(
            //   { _id: response.tk },
            //   {
            //     $set: {
            //       _id: response.tk,
            //       lp: response.lp,
            //       exc: response.e,
            //       curTime,
            //       ft: response.ft,
            //       t:response?.t,
            //       pc:response?.pc,
            //       v:response?.v,
            //       bp1:response?.bp1,
            //       sp1:response?.sp1,
            //       bq1:response?.bq1,
            //       sq1:response?.sq1,
            //     },
            //   }
            // );

            // INSERT INTO DATABASE
            await Stock.insertMany({
              token: response.tk,
              lp: response.lp,
              exc: response.e,
              curTime,
              ft: response.ft,
              t: response?.t,
              pc: response?.pc,
              v: response?.v,
              bp1: response?.bp1,
              sp1: response?.sp1,
              bq1: response?.bq1,
              sq1: response?.sq1,
            });
          }
        } catch (error) {
          console.error("❌ Error processing stock data:", error);
        }
      } else if (response.s === "OK") {
        let json = {
          k: channel_list,
          t: "t",
        };
        await ws.send(JSON.stringify(json));
      }
    };

    ws.onerror = function (error) {
      console.error("❌ WebSocket error:", error);
      isSocketConnected = false;
    };

    ws.onclose = async function () {
      console.log("🔴 WebSocket Disconnected!");
      isSocketConnected = false;
      await socketRestart();
    };
  } catch (error) {
    if(error?.response?.data == "Unauthorized"){
      console.error("❌ Unauthorized access. Please login again!");
      await Credential.updateOne({}, { $set: { access_token: null } });
 
    }
  }
};

// ✅ Function to restart WebSocket if disconnected
const socketRestart = async () => {
  if (!isSocketConnected) {
    console.log("♻️ Reconnecting WebSocket in 5 seconds...");
    setTimeout(Alice_Socket, 5000);
  }
};

// ✅ Function to check socket connection status
const getSocketStatus = () => {
  return isSocketConnected;
};

module.exports = { Alice_Socket, getSocketStatus };
