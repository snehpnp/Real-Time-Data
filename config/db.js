const mongoose = require("mongoose");
const { createClient } = require("redis");

// MongoDB Connection
const connectMongo = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("✅ MongoDB Connected");
  } catch (err) {
    console.error("❌ MongoDB Connection Failed:", err);
    process.exit(1); // Exit the process if the database fails to connect
  }
};

// Redis Connection
const redisClient = createClient({
  url: process.env.REDIS_URL || "redis://localhost:6379", // Use URL format
});

redisClient.on("connect", () => console.log("✅ Redis Connected"));
redisClient.on("error", (err) => console.error("❌ Redis Error:", err));

const connectRedis = async () => {
  try {
    await redisClient.connect();
    console.log("✅ Redis Client Connected");
  } catch (err) {
    console.error("❌ Redis Connection Failed:", err);
  }
};

// Export Mongo and Redis
module.exports = { connectMongo, redisClient, connectRedis };
