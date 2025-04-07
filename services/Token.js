const axios = require("axios");
const csvParser = require("csv-parser");
const { Readable } = require("stream");
const alice_tokens = require("../models/Alicetoken");

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
                  ? "f"
                  : segment && segment?.split("_")[1],
              instrument_token,
              lotsize: lotSize,
              tradesymbol,
              exch_seg: segment && segment?.split("_")[0],

              createdAt: new Date(),
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
          insertedCount = result.length;
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
          `✅ Processed ${fileName} | Rows: ${rows.length} | Inserted: ${insertedCount} | Time: ${timeTaken}s`
        );
        return insertedCount;
      } catch (err) {
        console.error(`❌ Error in processing ${fileName}:`, err.message);
        return 0;
      }
    };

    const results = await Promise.all(TokenUrl.map(processCsvFromUrl));
    grandTotalInserted = results.reduce((acc, val) => acc + val, 0);
    const totalTimeTaken = ((Date.now() - totalStart) / 1000).toFixed(2);

    console.log(
      `\n🚀 All Token Files Updated | Total Inserted: ${grandTotalInserted} | Total Time: ${totalTimeTaken}s\n`
    );
  };

  app.get("/update/alice/token", async (req, res) => {
    try {
      await updateTokensDirectly();
      res.json({
        success: true,
        message: "Alice tokens updated in MongoDB (via API).",
      });
    } catch (error) {
      console.error("❌ Error updating tokens:", error);
      res.status(500).json({ success: false, message: "Token update failed." });
    }
  });

  app.get("/createChain", async (req, res) => {
    try {
      const tokens = await alice_tokens
        .find({ segment: "f" })
        .select({
          instrument_token: 1,
          symbol: 1,
          expiry: 1,
          segment: 1,
          Exch: 1,
        })
        .sort({ expiry: 1 });

        console.log("tokens", tokens);


      const groupedTokens = tokens.reduce((acc, token) => {
        if (!acc[token.symbol]) {
          acc[token.symbol] = token; // Keep only the first occurrence
        }
        return acc;
      }, {});

      const result = Object.values(groupedTokens);


      let NseChain = "";
      result.map((token) => {
        NseChain += token?.Exch + "|" + token?.instrument_token + "#";
      });

      NseChain = NseChain && NseChain.slice(0, -1);

      console.log("NseChain", NseChain);




      const GetNseTokens = await alice_tokens
        .find({ Exch: "NSE", InstrumentType: "IF", symbol: "SENSEX" })
        .sort({ expiry: 1 });

      // console.log("NSE Tokens:", GetNseTokens);

      res.json({ success: true, tokens });
    } catch (error) {
      console.error("❌ Error fetching tokens:", error);
      res.status(500).json({ success: false, message: "Token fetch failed." });
    }
  });
};
