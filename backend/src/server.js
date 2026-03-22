const env = require("./config/env");
const { connectDb } = require("./config/db");
const app = require("./app");
const { initializeQueues } = require("./services/jobQueue");

async function start() {
  try {
    await connectDb(env.mongoUri);
    await initializeQueues();

    app.listen(env.port, () => {
      console.log(`Backend listening on http://localhost:${env.port}`);
    });
  } catch (error) {
    console.error("Failed to start server", error);
    process.exit(1);
  }
}

start();
