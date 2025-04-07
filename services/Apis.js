const { MongoClient } = require("mongodb");
const cron = require("node-cron");

module.exports = function (app, io) {
  const mongoURI = process.env.MONGO_URI;
  const dbName = "test";
  const client = new MongoClient(mongoURI, { useNewUrlParser: true, useUnifiedTopology: true });

  // Connect to MongoDB once and use a shared client
  client.connect().then(() => {
    console.log("✅ Connected to MongoDB");
  }).catch(err => {
    console.error("❌ MongoDB Connection Error:", err);
  });

  const db = client.db(dbName);







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
            { $unionWith: { coll: "oneMinuteView", pipeline: [{ $match: Query }] } },
            { $sort: { minute: -1 } },
          ])
          .toArray();
      } else if (validIntervals.includes(timeInterval)) {
        // Apply time-based aggregation after merging both collections
        data = await collection
          .aggregate([
            { $match: Query },
            { $unionWith: { coll: "oneMinuteView", pipeline: [{ $match: Query }] } },
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
        return res.status(400).json({ success: false, message: "Invalid time interval" });
      }
  
      res.json({ success: true, data });
    } catch (error) {
      console.error("Error fetching one-minute data:", error);
      res.status(500).json({ success: false, message: "Internal server error" });
    }
  });
  













  // app.get("/get/oneminut/data", async (req, res) => {
  //   try {
  //     const { chain, time } = req.query;
  //     const timeInterval = parseInt(time);
  //     const validIntervals = [1, 3, 5, 10, 15, 30, 60];

  //     const collection = db.collection("oneMinuteView");

  //     const numbersToken = chain && chain?.match(/\d+/g);

  //     let Query = {};
  //     if (numbersToken) Query.token = { $in: numbersToken }; 
      

  //     let data = [];

  //     if (!time || timeInterval === 1) {
  //       data = await collection.find(Query).sort({ minute: -1 }).toArray();
  //     } else if (validIntervals.includes(timeInterval)) {
  //       data = await collection
  //         .aggregate([
  //           { $match: Query },
  //           {
  //             $group: {
  //               _id: {
  //                 token: "$token",
  //                 interval: {
  //                   $dateTrunc: {
  //                     date: { $toDate: "$minute" },
  //                     unit: "minute",
  //                     binSize: timeInterval,
  //                   },
  //                 },
  //               },
  //               Lp: { $avg: "$avgLp" },
  //               totalVolume: { $sum: "$totalVolume" },
  //               high: { $max: "$highLp" },
  //               low: { $min: "$lowLp" },
  //               open: { $first: "$openLp" },
  //               close: { $last: "$closeLp" },
  //               count: { $sum: "$count" },
  //             },
  //           },
  //           {
  //             $project: {
  //               _id: 0,
  //               token: "$_id.token",
  //               minute: {
  //                 $dateToString: {
  //                   format: "%Y-%m-%d %H:%M",
  //                   date: "$_id.interval",
  //                 },
  //               },
  //               Lp: 1,
  //               totalVolume: 1,
  //               high: 1,
  //               low: 1,
  //               open: 1,
  //               close: 1,
  //               count: 1,
  //             },
  //           },
  //           { $sort: { minute: -1 } },
  //         ])
  //         .toArray();
  //     } else {
  //       return res.status(400).json({ success: false, message: "Invalid time interval" });
  //     }

  //     res.json({ success: true, data });
  //   } catch (error) {
  //     console.error("Error fetching one-minute data:", error);
  //     res.status(500).json({ success: false, message: "Internal server error" });
  //   }
  // });

  cron.schedule("59 23 * * *", async () => {
    try {
      console.log("🕐 Cron job started: Copying data from view to collection...");
      await copyViewToCollection();
    } catch (error) {
      console.error("❌ Cron job error (Copy View to Collection):", error);
    }
  });

  cron.schedule("0 1 * * *", async () => {
    try {
      console.log("🕐 Cron job started: Truncating stocks collection...");
      await db.collection("stocks").deleteMany({});
      console.log("✅ Stocks collection truncated successfully!");
    } catch (error) {
      console.error("❌ Error truncating stocks collection:", error);
    }
  });

  const VIEW_NAME = "oneMinuteView";
  const TARGET_COLLECTION = "oneMinuteData";

  const copyViewToCollection = async () => {
    try {
      console.log("🚀 Fetching data from view...");
      const viewData = await db.collection(VIEW_NAME).find().toArray();

      if (viewData.length === 0) {
        console.log("⚠️ No data found in the view!");
        return;
      }

      console.log(`📌 Found ${viewData.length} records. Inserting into collection...`);
      await db.collection(TARGET_COLLECTION).insertMany(viewData);
      console.log("✅ Data successfully copied to the collection!");
    } catch (error) {
      console.error("❌ Error copying view to collection:", error);
    }
  };

  app.get("/copy/view/to/collection", async (req, res) => {
    try {
      console.log("🚀 Fetching data from view...");
      const viewData = await db.collection(VIEW_NAME).find().toArray();

      if (viewData.length === 0) {
        console.log("⚠️ No data found in the view!");
        return res.status(404).json({ success: false, message: "No data found in the view!" });
      }

      console.log(`📌 Found ${viewData.length} records. Inserting into collection...`);
      await db.collection(TARGET_COLLECTION).insertMany(viewData);
      console.log("✅ Data successfully copied to the collection!");

      res.json({ success: true, message: "Data successfully copied to the collection!" });
    } catch (error) {
      console.error("❌ Error copying view to collection:", error);
      res.status(500).json({ success: false, message: "Internal server error" });
    }
  });
};
