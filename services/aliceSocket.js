const axios = require("axios");
const WebSocket = require("ws");
const CryptoJS = require("crypto-js");
const Stock = require("../models/Stock");
const Credential = require("../models/Credentials");
const { io } = require("../server"); // ✅ Import io instance
const AliceToken = require("../models/Alicetoken"); // ✅ Import AliceToken model

let ws;
let isSocketConnected = false; // Track WebSocket connection status

const userSubscriptions = {}; // Client ke tokens track karne ke liye

io.on("connection", (socket) => {
  console.log(`✅ Client connected: ${socket.id}`);

  // User ID receive karna (Agar zaroorat ho)
  socket.on("subscribe", (userId) => {
    console.log(`🆔 User ${userId} connected on socket ${socket.id}`);
  });

  // Stocks subscription (tokens list receive karna)
  socket.on("subscribeStocks", (stockSymbols) => {
    const tokens = stockSymbols.split("#"); // Split token string into array
    userSubscriptions[socket.id] = tokens;
    // console.log(`🔗 ${socket.id} subscribed to tokens:`, tokens);

    ConnectSocketNewToken(socket.id, stockSymbols); // New tokens ke liye connection establish karein
  });

  // Client disconnect hone par data remove karein
  socket.on("disconnect", () => {
    console.log(`🔴 Client disconnected: ${socket.id}`);
    delete userSubscriptions[socket.id];
  });
});

const ConnectSocketNewToken = async (socketId, stockSymbols) => {
  const numbersToken = stockSymbols && stockSymbols.match(/\d+/g);


  const credentialsGet = await Credential.findOne({});
  if (!credentialsGet) {
    console.error("❌ No credentials found!");
    return;
  }

  if (
    credentialsGet.channel_list == "" ||
    credentialsGet.channel_list == null
  ) {
    console.error("❌ No credentials found!");
    return;
  }

  const { channel_list } = credentialsGet;
  const numbersToken1 = channel_list && channel_list.match(/\d+/g);

  const newTokens = numbersToken.filter(
    (token) => !numbersToken1.includes(token)
  );

  const tokensMatch = stockSymbols.split("#"); // Split token string into array


  const matchedPra = tokensMatch.filter(item =>
    newTokens.some(token => item.endsWith(token))
  );
  




  if (newTokens.length > 0) {
    const json = {
      k: matchedPra.join("#"),
      t: "t",
    };
    console.log("✅ Subscribed to new tokens:", json);
    if (ws && isSocketConnected) {
      ws.send(JSON.stringify(json));
    } else {
      console.error(
        "❌ WebSocket is not connected. Cannot subscribe to new tokens."
      );
    }
  } else {
    console.log("ℹ️ No new tokens to subscribe.");
  }
};




const Alice_Socket = async () => {
  try {

    const credentialsGet = await Credential.findOne({});
    if (!credentialsGet) {
      console.error("❌ No credentials found!");
      return;
    }
    if (
      credentialsGet?.user_id == "" ||
      credentialsGet?.access_token == "" ||
      credentialsGet?.channel_list == "" ||
      credentialsGet?.access_token == null ||
      credentialsGet?.channel_list == null ||
      credentialsGet?.user_id == null
    ) {
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
          if (response.lp !== undefined && response.e !== undefined) {
            const now = new Date();
            const curTime = parseInt(`${now.getHours()}${now.getMinutes()}`);

            // ✅ Sirf relevant clients ko update bhejna
            Object.entries(userSubscriptions).forEach(([socketId, tokens]) => {
              if (tokens.includes(response.e + "|" + response.tk)) {
                io.to(socketId).emit("stockUpdate", {
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
              }
            });

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
    if (error?.response?.data == "Unauthorized") {
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
