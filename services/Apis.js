const { MongoClient } = require("mongodb");

module.exports = function (app, io) {
  const mongoURI = process.env.MONGO_URI; // MongoDB connection string
  const dbName = "test"; // Your database name

  app.get("/get/oneminut/data", async (req, res) => {
    try {
      const { token, time } = req.query; 
      const timeInterval = parseInt(time); // Convert time string to number
      const validIntervals = [1, 3, 5, 10, 15, 30, 60]; // Allowed intervals

      const client = new MongoClient(mongoURI);
      await client.connect();
      const db = client.db(dbName);
      const collection = db.collection("oneMinuteView");

      let Query = {};
      if (token) Query.token = token; 

      let data = [];

      if (!time || timeInterval === 1) {
        // ✅ Return raw 1-minute data if time is not provided or time = 1
        data = await collection.find(Query).sort({ minute: -1 }).toArray();
      } else if (validIntervals.includes(timeInterval)) {
        // ✅ Aggregate data for time intervals (3, 5, 10, 15, 30, 60)
        data = await collection
          .aggregate([
            { $match: Query },
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
                    date: {
                      $dateAdd: { startDate: "$_id.interval", unit: "hour", amount: 5 },
                    },
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
            { $sort: { minute: -1 } }, // Sort by time (latest first)
          ])
          .toArray();
      } else {
        return res
          .status(400)
          .json({ success: false, message: "Invalid time interval" });
      }

      await client.close();
      res.json({ success: true, data });
    } catch (error) {
      console.error("Error fetching one-minute data:", error);
      res.status(500).json({ success: false, message: "Internal server error" });
    }
  });
};
