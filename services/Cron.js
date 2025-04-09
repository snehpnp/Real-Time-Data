const { MongoClient } = require("mongodb");
const cron = require("node-cron");

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

  cron.schedule("59 23 * * *", async () => {
    try {
      console.log(
        "🕐 Cron job started: Copying data from view to collection..."
      );
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

      console.log(
        `📌 Found ${viewData.length} records. Inserting into collection...`
      );
      await db.collection(TARGET_COLLECTION).insertMany(viewData);
      console.log("✅ Data successfully copied to the collection!");


      await db.collection("stocks").deleteMany({});
    } catch (error) {
      console.error("❌ Error copying view to collection:", error);
    }
  };



  // 7. Copy data from view to collection
  app.get("/copy/view/to/collection", async (req, res) => {
    try {
      console.log("🚀 Fetching data from view...");
      const viewData = await db.collection(VIEW_NAME).find().toArray();

      if (viewData.length === 0) {
        console.log("⚠️ No data found in the view!");
        return res
          .status(404)
          .json({ success: false, message: "No data found in the view!" });
      }

      console.log(
        `📌 Found ${viewData.length} records. Inserting into collection...`
      );
      await db.collection(TARGET_COLLECTION).insertMany(viewData);
      console.log("✅ Data successfully copied to the collection!");
      await db.collection("stocks").deleteMany({});

      res.json({
        success: true,
        message: "Data successfully copied to the collection!",
      });
    } catch (error) {
      console.error("❌ Error copying view to collection:", error);
      res
        .status(500)
        .json({ success: false, message: "Internal server error" });
    }
  });
};
