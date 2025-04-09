const { MongoClient } = require("mongodb");


module.exports = function (app, io) {
  const mongoURI = process.env.MONGO_URI;
  const dbName = "test";
  const client = new MongoClient(mongoURI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  });

  // Connect to MongoDB once and use a shared client
  client
    .connect()
    .then(() => {
      console.log("✅ Connected to MongoDB");
    })
    .catch((err) => {
      console.error("❌ MongoDB Connection Error:", err);
    });

  const db = client.db(dbName);

  //  1. Get Live Data And Filter Data
  app.get("/get/oneminut/data", async (req, res) => {
    try {
      const { chain, time } = req.query;
      const timeInterval = parseInt(time);
      const validIntervals = [1, 3, 5, 10, 15, 30, 60];

      const collection = db.collection("oneMinuteData"); // Past Data
      const view = db.collection("oneMinuteView"); // Today's Live Data

      // Extract numbers from the chain
      const numbersToken = chain && chain.match(/\d+/g);
      let Query = {};
      if (numbersToken) Query.token = { $in: numbersToken };

      console.log("Extracted Tokens:", numbersToken);
      console.log("Query:", Query);

      let data = [];

      if (!time || timeInterval === 1) {
        // If no time interval or 1-minute interval, just merge both collections and return raw data
        data = await collection
          .aggregate([
            { $match: Query },
            {
              $unionWith: {
                coll: "oneMinuteView",
                pipeline: [{ $match: Query }],
              },
            },
            { $sort: { minute: -1 } },
          ])
          .toArray();
      } else if (validIntervals.includes(timeInterval)) {
        // Apply time-based aggregation after merging both collections
        data = await collection
          .aggregate([
            { $match: Query },
            {
              $unionWith: {
                coll: "oneMinuteView",
                pipeline: [{ $match: Query }],
              },
            },
            {
              $group: {
                _id: {
                  token: "$token",
                  interval: {
                    $dateTrunc: {
                      date: { $toDate: "$minute" },
                      unit: "minute",
                      binSize: timeInterval,
                    },
                  },
                },
                Lp: { $avg: "$avgLp" },
                totalVolume: { $sum: "$totalVolume" },
                high: { $max: "$highLp" },
                low: { $min: "$lowLp" },
                open: { $first: "$openLp" },
                close: { $last: "$closeLp" },
                count: { $sum: "$count" },
              },
            },
            {
              $project: {
                _id: 0,
                token: "$_id.token",
                minute: {
                  $dateToString: {
                    format: "%Y-%m-%d %H:%M",
                    date: "$_id.interval",
                  },
                },
                Lp: 1,
                totalVolume: 1,
                high: 1,
                low: 1,
                open: 1,
                close: 1,
                count: 1,
              },
            },
            { $sort: { minute: -1 } },
          ])
          .toArray();
      } else {
        return res
          .status(400)
          .json({ success: false, message: "Invalid time interval" });
      }

      res.json({ success: true, data });
    } catch (error) {
      console.error("Error fetching one-minute data:", error);
      res
        .status(500)
        .json({ success: false, message: "Internal server error" });
    }
  });





};
