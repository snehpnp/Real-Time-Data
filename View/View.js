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
      count: { $sum: 1 } ,// Number of records
      exc: { $exc: 1 } ,
      ft : { $ft: 1 } ,
      t : { $t: 1 } ,
      pc : { $pc: 1 } ,
      v : { $v: 1 } 



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
      pc:1,
      exc:1,
      ft:1,
      t:1,
      v:1

    }
  }
]);


db.createView("chainView", "Tokens", [
])