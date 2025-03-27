  const axios = require("axios");
  const WebSocket = require("ws");
  const CryptoJS = require("crypto-js");
  const Stock = require("../models/Stock");
  const Credential = require("../models/Credentials");
  const { io } = require("../server"); // ✅ Import io instance

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
        console.log(`🔗 ${socket.id} subscribed to tokens:`, tokens);
    });

    // Client disconnect hone par data remove karein
    socket.on("disconnect", () => {
        console.log(`🔴 Client disconnected: ${socket.id}`);
        delete userSubscriptions[socket.id]; 
    });
});

console.log(userSubscriptions);



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

                if (response.lp !== undefined && response.e !== undefined) {
                    const now = new Date();
                    const curTime = parseInt(`${now.getHours()}${now.getMinutes()}`);
    
                    // ✅ Sirf relevant clients ko update bhejna
                    Object.entries(userSubscriptions).forEach(([socketId, tokens]) => {
                     
                        if (tokens.includes(response.e +"|"+response.tk)) {
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
    
                    // ✅ Agar database me store karna ho
                    // await Stock.insertMany({ token: response.tk, lp: response.lp, exc: response.e, curTime, ...response });
                }
            } catch (error) {
                console.error("❌ Error processing stock data:", error);
            }
        }else if (response.s === "OK") {
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
