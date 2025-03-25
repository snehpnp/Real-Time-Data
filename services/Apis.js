const { MongoClient } = require("mongodb");

module.exports = function (app, io) {
  const mongoURI = process.env.MONGO_URI; // Update if needed
  const dbName = "test"; // Replace with your actual database name

  app.get("/get/oneminut/data", async (req, res) => {
    try {
      const { token } = req.query;

      let Query = {};

      if (token) {
        Query = { token: token };
      }

      const client = new MongoClient(mongoURI);
      await client.connect();
      const db = client.db(dbName);
      const collection = db.collection("oneMinuteView");

      const data = await collection.find(Query).sort({ minute: -1 }).toArray();

      await client.close();
      res.json({ success: true, data });
    } catch (error) {
      console.error("Error fetching one-minute data:", error);
      res
        .status(500)
        .json({ success: false, message: "Internal server error" });
    }
  });
};
