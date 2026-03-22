const mongoose = require("mongoose");

async function connectDb(mongoUri) {
  mongoose.set("strictQuery", true);
  await mongoose.connect(mongoUri);
}

async function disconnectDb() {
  await mongoose.disconnect();
}

module.exports = {
  connectDb,
  disconnectDb
};
