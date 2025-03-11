const axios = require("axios");
const Stock = require("../models/Stock");
const { redisClient } = require("../config/db");

// Function to fetch stock data from NSE/BSE
const fetchStockData = async () => {
  try {
    const [nseResponse, bseResponse] = await Promise.all([
      axios.get(process.env.NSE_API),
      axios.get(process.env.BSE_API),
    ]);

    const nseStocks = nseResponse.data.map((stock) => ({
      symbol: stock.symbol,
      price: stock.price,
      volume: stock.volume,
      exchange: "NSE",
    }));

    const bseStocks = bseResponse.data.map((stock) => ({
      symbol: stock.symbol,
      price: stock.price,
      volume: stock.volume,
      exchange: "BSE",
    }));

    const allStocks = [...nseStocks, ...bseStocks];

    await Stock.insertMany(allStocks, { ordered: false }).catch(() => {});

    allStocks.forEach((stock) => {
      redisClient.set(`stock:${stock.symbol}`, JSON.stringify(stock));
    });

    console.log("Stock data updated successfully");
  } catch (error) {
    console.error("Error fetching stock data", error);
  }
};

module.exports = { fetchStockData };
