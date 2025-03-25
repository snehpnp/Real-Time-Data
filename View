db.createView("oneMinuteView", "stocks", [
  {
    $group: {
      _id: {
        token: "$token",
        minute: {
          $dateToString: { format: "%Y-%m-%d %H:%M", date: "$createdAt" }
        }
      },
      avgLp: { $avg: "$lp" }, // Average LP
      totalVolume: { $sum: { $toDouble: "$v" } }, // Total Volume
      highLp: { $max: "$lp" }, // Highest LP
      lowLp: { $min: "$lp" }, // Lowest LP
      openLp: { $first: "$lp" }, // First LP (Open Price)
      closeLp: { $last: "$lp" }, // Last LP (Close Price)
      count: { $sum: 1 } // Number of records
    }
  },
  {
    $project: {
      _id: 0,
      token: "$_id.token",
      minute: "$_id.minute",
      avgLp: 1,
      totalVolume: 1,
      highLp: 1,
      lowLp: 1,
      openLp: 1,
      closeLp: 1,
      count: 1,
      curTime :1,
      bp1:1,
      sp1:1,
      bq1 :1,
      sq1 :1,
      pc:1
    }
  }
]);
