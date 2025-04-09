// Refactored version of Alice WebSocket Manager with security, modularity, and reliability

const axios = require("axios");
const WebSocket = require("ws");
const CryptoJS = require("crypto-js");
const Stock = require("../models/Stock");
const Credential = require("../models/Credentials");
const { io } = require("../server");
const Liveprices = require("../models/Liveprice");
const TokensModel = require("../models/Token");

let ws = null;
let isSocketConnected = false;
let retryCount = 0;
const MAX_RETRIES = 5;

const userSubscriptions = new Map(); // socketId => [tokens]

/** Util: Generate current time as HHMM */
const getCurrentTime = () => {
  const now = new Date();
  return parseInt(`${now.getHours()}${now.getMinutes()}`);
};

/** Util: Send logs using logging library or console */
const log = (...args) => console.log("[AliceSocket]", ...args);

/** Client Socket Setup */
io.on("connection", (socket) => {
  log(`Client connected: ${socket.id}`);

  socket.on("subscribe", (userId) => {
    log(`User ${userId} connected on socket ${socket.id}`);
  });

  socket.on("subscribeStocks", (stockSymbols) => {
    const tokens = stockSymbols.split("#");
    userSubscriptions.set(socket.id, tokens);
    subscribeToNewTokens(socket.id, stockSymbols);
  });

  socket.on("disconnect", () => {
    log(`Client disconnected: ${socket.id}`);
    userSubscriptions.delete(socket.id);
  });
});

const subscribeToNewTokens = async (socketId, stockSymbols) => {
  const newTokenNumbers = stockSymbols.match(/\d+/g) || [];

  const credentials = await Credential.findOne({});
  if (!credentials?.channel_list) {
    log("No valid credentials found!");
    return;
  }

  const existingTokenNumbers = credentials.channel_list.match(/\d+/g) || [];
  const newTokens = newTokenNumbers.filter(
    (token) => !existingTokenNumbers.includes(token)
  );
  const matchedTokens = stockSymbols
    .split("#")
    .filter((item) => newTokens.some((token) => item.endsWith(token)));

  if (newTokens.length > 0) {
    const json = { k: matchedTokens.join("#"), t: "t" };
    if (ws && isSocketConnected) {
      ws.send(JSON.stringify(json));
    } else {
      log("WebSocket not connected. Cannot subscribe now.");
    }
  } else {
    log("No new tokens to subscribe.");
  }
};


// UPDATE INDEX PRICE
const IndexPrice = async () => {
  const credentials = await Credential.findOne({}).sort({updatedAt: -1})
  if (!credentials?.channel_list) {
    log("No valid credentials found!");
    return "No valid credentials found!";
  }

  const LivepricesToken = await Liveprices.find({});

  if (!LivepricesToken || LivepricesToken.length === 0) {
    console.log("❌ No live prices data found!");
    return "❌ No live prices data found!";
  }

  const LivePriceChannel = LivepricesToken.map(
    (item) => `${item.Exch?.toUpperCase()}|${item.instrument_token}`
  ).join("#");

  if (LivePriceChannel) {
    const json = { k: LivePriceChannel, t: "t" };
    if (ws && isSocketConnected) {
      ws.send(JSON.stringify(json));
      return json;

    } else {

      setTimeout(() => 
        IndexPrice(), 2000
      ); 
      

      Alice_Socket();

      return "WebSocket not connected. Attempting to reconnect..."; 


    }
  } else {
    log("No new tokens to subscribe.");
    return "No new tokens to subscribe.";
  }
};

// UPDATE Lice Price And Send Another Users
const Alice_Socket = async () => {
  try {
    const credentials = await Credential.findOne({});
    if (
      !credentials ||
      !credentials.user_id ||
      !credentials.access_token ||
      !credentials.channel_list
    ) {
      log("No valid credentials found!");
      return;
    }

    const {
      user_id: userId,
      access_token: userSession,
      channel_list,
    } = credentials;

    const GetTokens = await TokensModel.find({});
    if (!GetTokens || GetTokens.length === 0) {
      console.log("❌ No tokens data found!");
      return "❌ No tokens data found!";
    }
    const tokenNumbers = GetTokens.map((item) =>  item.Exch +"|"+ item.instrument_token  ).join("#");
    let json 
    if (tokenNumbers) {
       json = { k: tokenNumbers, t: "t" };
    }else {
      json = { k: channel_list, t: "t" };
    }

   
    const baseUrl =
      "https://ant.aliceblueonline.com/rest/AliceBlueAPIService/api/";

    const response = await axios.post(
      `${baseUrl}/ws/createSocketSess`,
      { loginType: "API" },
      {
        headers: {
          Authorization: `Bearer ${userId} ${userSession}`,
          "Content-Type": "application/json",
        },
      }
    );

    if (response.data.stat !== "Ok") {
      log("Failed to create WebSocket session:", response.data);
      return;
    }

    ws = new WebSocket("wss://ws1.aliceblueonline.com/NorenWS/");

    ws.on("open", () => {
      log("WebSocket connected!");
      isSocketConnected = true;
      retryCount = 0;

      const encryptedToken = CryptoJS.SHA256(
        CryptoJS.SHA256(userSession).toString()
      ).toString();

      const initPayload = {
        susertoken: encryptedToken,
        t: "c",
        actid: userId + "_API",
        uid: userId + "_API",
        source: "API",
      };

      ws.send(JSON.stringify(initPayload));
    });

    ws.on("message", async (data) => {
      const message = JSON.parse(data);

      if (message.tk && message.lp !== undefined && message.e !== undefined) {
        const currentTime = getCurrentTime();

        for (const [socketId, tokens] of userSubscriptions.entries()) {
          if (tokens.includes(`${message.e}|${message.tk}`)) {
            io.to(socketId).emit("stockUpdate", {
              token: message.tk,
              exchange: message.e,
              timestamp: currentTime,
              lp: message.lp,
              ...message,
            });
          }
        }

        await Stock.insertMany({
          token: message.tk,
          lp: message.lp,
          exc: message.e,
          curTime: currentTime,
          ...message,
        });

        // if (currentTime >= 900 && currentTime <= 930) {
          await Liveprices.updateOne(
            { instrument_token: message.tk },
            {
              $set: {
                price: message.lp,
              },
            }
          );
        // }
      } else if (message.s === "OK") {
        ws.send(JSON.stringify(json));
      }
    });

    ws.on("error", (error) => {
      log("WebSocket error:", error);
      isSocketConnected = false;
    });

    ws.on("close", () => {
      log("WebSocket closed. Attempting reconnect...");
      isSocketConnected = false;
      reconnectSocket();
    });
  } catch (error) {
    if (error?.response?.data === "Unauthorized") {
      log("Unauthorized access. Clearing token.");
      await Credential.updateOne({}, { $set: { access_token: "" } });
    } else {
      log("Error in WebSocket setup:", error.message);
    }
    reconnectSocket();
  }
};

/** Retry with backoff */
const reconnectSocket = () => {
  if (!isSocketConnected && retryCount < MAX_RETRIES) {
    retryCount++;
    const delay = retryCount * 5000; // backoff: 5s, 10s, 15s...
    log(
      `Reconnecting WebSocket in ${
        delay / 1000
      }s (Attempt ${retryCount}/${MAX_RETRIES})`
    );
    setTimeout(Alice_Socket, delay);
  } else if (retryCount >= MAX_RETRIES) {
    log("Max reconnect attempts reached. Manual intervention required.");
  }
};

/** Public Methods */
const getSocketStatus = () => isSocketConnected;

module.exports = { Alice_Socket, getSocketStatus, IndexPrice };
