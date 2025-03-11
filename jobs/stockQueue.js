const Bull = require("bull");
const { fetchStockData } = require("../services/fetchStocks");

const stockQueue = new Bull("stock-update-queue", {
  redis: { host: process.env.REDIS_HOST, port: process.env.REDIS_PORT },
});

stockQueue.process(async (job) => {
  console.log("Processing Stock Update Job");
  await fetchStockData();
});

const addStockJob = () => {
  stockQueue.add({}, { repeat: { every: 5000 } }); // Run every 5 seconds
};

module.exports = { stockQueue, addStockJob };
