require("dotenv").config();
const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");

const connectDB = require("./config/db");
const { errorHandler, notFound } = require("./middleware/errorHandler");
const Evidence = require("./models/Evidence");
const { seedInvestigation } = require("./seed/seedInvestigation");

const casesRouter = require("./routes/cases");
const evidenceRouter = require("./routes/evidence");
const recycleBinRouter = require("./routes/recycleBin");

const app = express();
const PORT = process.env.PORT || 5000;
const CORS_ORIGIN = process.env.CORS_ORIGIN || "http://localhost:5173";

app.use(cors({ origin: CORS_ORIGIN.split(",").map((s) => s.trim()) }));
app.use(express.json({ limit: "5mb" }));
app.use(express.urlencoded({ extended: true }));

app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    db: mongoose.connection.readyState === 1 ? "connected" : "disconnected",
  });
});

app.use("/api/cases", casesRouter);
app.use("/api/evidence", evidenceRouter);
app.use("/api/recycle-bin", recycleBinRouter);

app.use(notFound);
app.use(errorHandler);

async function start() {
  await connectDB();

  if (String(process.env.AUTO_SEED).toLowerCase() === "true") {
    const count = await Evidence.countDocuments();
    if (count === 0) {
      console.log("[seed] evidence collection is empty — loading the demo investigation case...");
      await seedInvestigation({ closeConnectionAfter: false });
    } else {
      console.log(`[seed] skipping auto-seed — ${count} evidence records already present.`);
    }
  }

  const server = app.listen(PORT, () => {
    console.log(`[server] MOSAIQ backend listening on http://localhost:${PORT}`);
    console.log(`[server] CORS allowed origin(s): ${CORS_ORIGIN}`);
  });

  // ---- Keep slow AI requests alive ----------------------------------------
  // Node closes an in-flight request after requestTimeout (5 min by default)
  // by DESTROYING the socket, which the browser sees as a network failure —
  // the frontend then wrongly reports that the backend is unreachable.
  // A local model answering its first request can exceed that, so the window
  // is widened here and the Ollama call aborts itself well before this point
  // (see OLLAMA_TIMEOUT_MS), meaning the client always receives real JSON.
  server.requestTimeout = 10 * 60 * 1000; // 10 minutes
  server.headersTimeout = 10 * 60 * 1000 + 5000;
}

start();
