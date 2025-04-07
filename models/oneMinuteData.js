const mongoose = require("mongoose");
const oneMinuteDataSchema = new mongoose.Schema(
  {
    _id: String,
    lp: Number,
    exc: String,
    curTime: Number,
    ft: String,
    t: String,
    pc: Number,
    v: Number,
    bp1: Number,
    sp1: Number,
    bq1: Number,
    sq1: Number,
    token: String,

    avgLp: Number,
    totalVolume: Number,
    highLp: Number,
    lowLp: Number,
    openLp: Number,
    closeLp: Number,
    count: Number,
  }
);

// Indexes
oneMinuteDataSchema.index({ token: 1, curTime: -1 });
oneMinuteDataSchema.index({ curTime: -1 });

// module.exports = oneMinuteDataSchema;

module.exports = mongoose.model("oneMinuteData", oneMinuteDataSchema);
