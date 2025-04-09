const axios = require("axios");
const csvParser = require("csv-parser");
const { Readable } = require("stream");
const alice_tokens = require("../models/Alicetoken");
const TokensModel = require("../models/Token");
const moment = require("moment");
const Liveprice = require("../models/Liveprice");

const {IndexPrice} = require("./aliceSocket");

module.exports = function (app, io) {
  const TokenUrl = [
    {
      url: "https://v2api.aliceblueonline.com/restpy/static/contract_master/NFO.csv",
      key: "ALICE_NFO",
    },
    {
      url: "https://v2api.aliceblueonline.com/restpy/static/contract_master/NSE.csv",
      key: "ALICE_NSE",
    },
    {
      url: "https://v2api.aliceblueonline.com/restpy/static/contract_master/MCX.csv",
      key: "ALICE_MCX",
    },
    {
      url: "https://v2api.aliceblueonline.com/restpy/static/contract_master/CDS.csv",
      key: "ALICE_CDS",
    },
    {
      url: "https://v2api.aliceblueonline.com/restpy/static/contract_master/BFO.csv",
      key: "ALICE_BFO",
    },
    {
      url: "https://v2api.aliceblueonline.com/restpy/static/contract_master/BSE.csv",
      key: "ALICE_BSE",
    },
  ];

  const updateTokensDirectly = async () => {
    const totalStart = Date.now();
    let grandTotalInserted = 0;
    const details = [];

    const processCsvFromUrl = async ({ url }) => {
      const start = Date.now();
      const fileName = url.split("/").pop();
      let insertedCount = 0;

      try {
        const response = await axios.get(url);
        const csvData = response.data;
        const rows = [];

        await new Promise((resolve, reject) => {
          Readable.from(csvData)
            .pipe(csvParser())
            .on("data", (row) => rows.push(row))
            .on("end", resolve)
            .on("error", reject);
        });

        const insertDocs = [];

        for (const row of rows) {
          try {
            const tradesymbol = row["Trading Symbol"]?.trim();
            const instrument_token = row["Token"]?.trim();
            const segment = row["Exchange Segment"]?.trim();
            const symbol = row["Symbol"]?.trim();
            const expiry = row["Expiry Date"];
            const strike = parseFloat(row["Strike Price"]) || 0;
            const option_type = row["Option Type"]?.trim();
            const lotSize = parseInt(row["Lot Size"]) || 0;

            const Exch = row["Exch"]?.trim();
            const InstrumentType = row["Instrument Type"]?.trim();

            if (!tradesymbol || !instrument_token || !segment) continue;

            insertDocs.push({
              Exch,
              InstrumentType,
              symbol,
              expiry,
              strike,
              option_type,
              segment:
                InstrumentType == "FUTIDX"
                  ? "F"
                  : InstrumentType == "IF"
                  ? "BF"
                  : segment && segment?.split("_")[1]?.toUpperCase(),
              instrument_token: instrument_token,
              lotsize: lotSize,
              tradesymbol,
              exch_seg: segment && segment?.split("_")[0]?.toUpperCase(),
              createdAt: new Date(),
              unique_key: `${instrument_token}_${segment
                ?.split("_")[0]
                ?.toUpperCase()}`,
            });
          } catch (err) {
            console.error(
              `❌ Error preparing row in ${fileName}:`,
              err.message
            );
          }
        }

        try {
          const result = await alice_tokens.insertMany(insertDocs, {
            ordered: false,
          });
          insertedCount = result?.length;
        } catch (err) {
          if (err.writeErrors) {
            insertedCount = err.result?.result?.nInserted || 0;
            console.warn(`⚠️ Skipped duplicates in ${fileName}.`);
          } else {
            throw err;
          }
        }

        const timeTaken = ((Date.now() - start) / 1000).toFixed(2);
        console.log(
          `✅ Processed ${fileName} | Rows: ${rows?.length} | Inserted: ${insertedCount} | Time: ${timeTaken}s`
        );

        details.push({
          fileName,
          totalRows: rows.length,
          inserted: insertedCount,
          timeTaken: `${timeTaken}s`,
        });

        return insertedCount;
      } catch (err) {
        console.error(`❌ Error in processing ${fileName}:`, err?.message);
        details.push({
          fileName,
          totalRows: 0,
          inserted: 0,
          timeTaken: "0s",
          error: err?.message,
        });
        return 0;
      }
    };

    const results = await Promise.all(TokenUrl.map(processCsvFromUrl));
    grandTotalInserted = results.reduce((acc, val) => acc + val, 0);
    const totalTimeTaken = ((Date.now() - totalStart) / 1000).toFixed(2);

    console.log(
      `\n🚀 All Token Files Updated | Total Inserted: ${grandTotalInserted} | Total Time: ${totalTimeTaken}s\n`
    );

    return {
      totalInserted: grandTotalInserted,
      totalTime: `${totalTimeTaken}s`,
      files: details,
    };
  };

  const updateTokens = async () => {
  try {
    const LivepriceData = await Liveprice.find({}).sort({ expiry: 1 });

    if (LivepriceData && LivepriceData.length > 0) {
      LivepriceData.map(async (token) => {
        const { symbol, expiry, price, segment, instrument_token } = token;

        if (price == undefined || price == null || price == "") {
          return "No Price Found";
        }

        const numericPrice = parseFloat(price);

        const FindDataAliceToken = await alice_tokens.aggregate([
          {
            $match: {
              symbol: symbol,
              expiry: expiry,
            },
          },
          {
            $addFields: {
              strikeNumeric: { $toDouble: "$strike" },
            },
          },
          {
            $facet: {
              before: [
                { $match: { strikeNumeric: { $lt: numericPrice } } },
                { $sort: { strikeNumeric: -1 } },
                { $limit: 15 },
                { $sort: { strikeNumeric: 1 } }, // restore original order
              ],
              exact: [{ $match: { strikeNumeric: numericPrice } }],
              after: [
                { $match: { strikeNumeric: { $gt: numericPrice } } },
                { $sort: { strikeNumeric: 1 } },
                { $limit: 15 },
              ],
            },
          },
          {
            $project: {
              combined: {
                $concatArrays: ["$before", "$exact", "$after"],
              },
            },
          },
          { $unwind: "$combined" },
          { $replaceRoot: { newRoot: "$combined" } },
        ]);


        if (FindDataAliceToken && FindDataAliceToken.length > 0) {
          let UpdateReq = FindDataAliceToken.map((token) => {
            return {
              instrument_token: token.instrument_token,
              symbol: token.symbol,
              expiry: token.expiry,
              segment: token.segment,
              Exch: token.Exch,
              exch_seg: token.exch_seg,



            };
          });

          if (UpdateReq) {
            await TokensModel.bulkWrite(
              UpdateReq.map((token) => {
                return {
                  updateOne: {
                    filter: { instrument_token: token.instrument_token },
                    update: { $set: token },
                    upsert: true,
                  },
                };
              })
            );
          }
        }


      });
    }

    return "🚀 Tokens updated successfully in DB.";

  } catch (error) {
    console.error("❌ Error updating tokens:", error);
    return "Failed to update tokens.";
  }
  };

  // 1. UPDATE ALICE TOKENS DIRECTLY IN MONGODB
  app.get("/update/alice/token", async (req, res) => {
    try {
      const result = await updateTokensDirectly();
      res.json({
        success: true,
        message: "Alice tokens updated in MongoDB.",
        totalInserted: result.totalInserted,
        totalTime: result.totalTime,
        files: result.files,
      });
    } catch (error) {
      console.error("❌ Error updating tokens:", error);
      res.json({ success: false, message: "Token update failed." });
    }
  });

  // 2. Update Index Price Tokens
  app.get("/update/index/tokens", async (req, res) => {
    try {
      const tokens = await alice_tokens
        .find({ InstrumentType: "FUTIDX" })
        .select({
          instrument_token: 1,
          symbol: 1,
          expiry: 1,
          segment: 1,
          Exch: 1,
          exch_seg: 1,
        })
        .sort({ expiry: 1 });

      const groupedTokens = tokens.reduce((acc, token) => {
        if (!acc[token.symbol]) {
          acc[token.symbol] = token; // Keep only the first occurrence
        }
        return acc;
      }, {});

      const result = Object.values(groupedTokens);

      if (result.length > 0) {
        const data = result.map((token) => {
          return {
            instrument_token: token.instrument_token,
            exch_seg: token.exch_seg,
            symbol: token.symbol,
            expiry: token.expiry,
            segment: token.segment,
            Exch: token.Exch,
          };
        });

        if (data.length > 0) {
          await Liveprice.bulkWrite(
            data.map((token) => {
              return {
                updateOne: {
                  filter: { symbol: token.symbol },
                  update: { $set: token },
                  upsert: true,
                },
              };
            })
          );
        }
      }

      // Get current month range
      const startOfMonth = moment().startOf("month").format("YYYY-MM-DD");
      const endOfMonth = moment().endOf("month").format("YYYY-MM-DD");

      const bseTokens = await Promise.all(
        ["SENSEX", "BANKEX"].map(async (symbol) => {
          const token = await alice_tokens
            .findOne({
              InstrumentType: "IF",
              symbol: symbol,
              expiry: { $gte: startOfMonth, $lte: endOfMonth },
            })
            .sort({ expiry: -1 })
            .limit(1);

          return token;
        })
      );

      if (bseTokens && bseTokens.length > 0) {
        let BseChain = bseTokens.map((token) => {
          return {
            instrument_token: token.instrument_token,
            exch_seg: token.exch_seg,
            symbol: token.symbol,
            expiry: token.expiry,
            segment: token.segment,
            Exch: token.Exch,
          };
        });

        if (BseChain.length > 0) {
          await Liveprice.bulkWrite(
            BseChain.map((token) => {
              return {
                updateOne: {
                  filter: { symbol: token.symbol },
                  update: { $set: token },
                  upsert: true,
                },
              };
            })
          );
        }
      }

      return res.json({
        success: true,
        message: "Index Future Token Update in DB",
      });
    } catch (error) {
      console.error("❌ Error fetching tokens:", error);
      res.json({ success: false, message: "Token fetch failed." });
    }
  });

  //3. Update Cash Stock Tokens
  app.get("/update/cash/stock", async (req, res) => {
    try {
      let Tokens = [
        "RELIANCE",
        "HDFCBANK",
        "INFY",
        "TCS",
        "ICICIBANK",
        "HINDUNILVR",
        "HDFC",
        "KOTAKBANK",
        "SBIN",
        "BHARTIARTL",
        "ASIANPAINT",
        "MARUTI",
        "ITC",
        "NESTLEIND",
        "BAJFINANCE",
        "HCLTECH",
        "WIPRO",
        "TITAN",
        "ULTRACEMCO",
        "TATAMOTORS",
        "TATASTEEL",
        "POWERGRID",
        "DIVISLAB",
        "DRREDDY",
        "M&M",
        "BAJAJAUTO",
        "GRASIM",
        "ADANIPORTS",
        "HDFCBANK",
        "ICICIBANK",
        "AXISBANK",
        "KOTAKBANK",
        "SBIN",
        "INDUSINDBK",
        "YESBANK",
        "IDFCFIRSTB",
        "BANDHANBNK",
        "RBLBANK",
        "FEDERALBNK",
        "AUBANK",
      ];

      let stockTokens = await alice_tokens?.find({
        symbol: { $in: Tokens },
        Exch: "NSE",
        segment: "CM",
      });

      let stockTokenData = stockTokens?.map((token) => {
        return {
          instrument_token: token.instrument_token,
          exch_seg: token.exch_seg,
          symbol: token.symbol,
          expiry: token.expiry,
          segment: token.segment,
          Exch: token.Exch,
        };
      });

      if (stockTokenData?.length > 0) {
        await TokensModel?.bulkWrite(
          stockTokenData?.map((token) => {
            return {
              updateOne: {
                filter: { symbol: token.symbol },
                update: { $set: token },
                upsert: true,
              },
            };
          })
        );
      }

      return res.json({
        success: true,
        message: "successfully updated Stocks Token In DB.",
      });
    } catch (error) {
      console.error("❌ Error updating stock tokens:", error);
      res.json({ success: false, message: "Failed to update stock tokens." });
    }
  });

  //4. UPDATE ANY WHERE ALICE CREDENTIALS
  app.post("/update/alice-credentials", async (req, res) => {
    try {
      const { token, userid } = req.body;

      if (!token || !userid) {
        return res.json({
          success: false,
          message: "Token and User ID are required.",
        });
      }

      const UpdateCredentials = await Credential.updateOne(
        { user_id: userid },
        { access_token: token },
        { upsert: true }
      );

      if (!UpdateCredentials) {
        return res.json({
          success: false,
          message: "Credentials not found.",
        });
      }
      IndexPrice();

      res.json({
        success: true,
        message: "Credentials updated successfully.",
        UpdateCredentials,
      });
    } catch (error) {
      console.error("❌ Error updating credentials:", error);
      res.json({
        success: false,
        message: "Failed to update credentials.",
      });
    }
  });

  //5. UPDATE CHAIN TOKENS TO
  app.get("/update/chain-tokens", async (req, res) => {
   let response = await updateTokens();
   if(response){
    return res.json({ message: "Api Hit Succefully", data: response });
   }else{
    return res.json({ message: "Api Hit Succefully" ,data : "No data found"});
   }
  });
};
