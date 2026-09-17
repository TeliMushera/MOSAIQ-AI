const mongoose = require("mongoose");

/**
 * Connects to MongoDB using MONGODB_URI from the environment.
 * The rest of the backend does not run without a database connection —
 * this keeps the demo honest: MOSAIQ is a database-backed application,
 * not a backend that silently falls back to in-memory data.
 */
async function connectDB() {
  const uri = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/mosaiq";

  mongoose.set("strictQuery", true);

  try {
    await mongoose.connect(uri);
    console.log(`[db] connected to MongoDB -> ${maskUri(uri)}`);
  } catch (err) {
    console.error("[db] failed to connect to MongoDB:", err.message);
    console.error(
      "[db] MOSAIQ requires MongoDB to be reachable. Start a local MongoDB " +
        "instance (e.g. `mongod`) or point MONGODB_URI at a MongoDB Atlas cluster, " +
        "then restart the backend."
    );
    process.exit(1);
  }

  mongoose.connection.on("error", (err) => {
    console.error("[db] connection error:", err.message);
  });
}

function maskUri(uri) {
  // Avoid printing credentials to the console/logs.
  return uri.replace(/\/\/([^:]+):([^@]+)@/, "//$1:****@");
}

module.exports = connectDB;
