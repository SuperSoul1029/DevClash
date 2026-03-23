const { MongoMemoryServer } = require("mongodb-memory-server");
const mongoose = require("mongoose");
const app = require("../../src/app");
const { connectDb, disconnectDb } = require("../../src/config/db");

let mongoServer;

async function setupTestDb() {
  mongoServer = await MongoMemoryServer.create();
  const uri = mongoServer.getUri();
  await connectDb(uri);
}

async function teardownTestDb() {
  await disconnectDb();
  if (mongoServer) {
    await mongoServer.stop();
  }
}

async function resetTestDb() {
  const collections = mongoose.connection.collections;
  const names = Object.keys(collections);
  await Promise.all(names.map((name) => collections[name].deleteMany({})));
}

module.exports = {
  app,
  setupTestDb,
  teardownTestDb,
  resetTestDb
};
