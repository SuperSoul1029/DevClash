const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const routes = require("./routes");
const { notFoundHandler, errorHandler } = require("./middleware/errorHandler");
const requestContext = require("./middleware/requestContext");
const structuredLogger = require("./middleware/structuredLogger");
const apiRateLimiter = require("./middleware/rateLimit");
const { registerYoutubeProcessors } = require("./services/youtubeJobs");

const app = express();

registerYoutubeProcessors();

app.use(helmet());
app.use(cors());
app.use(express.json({ limit: "1mb" }));
app.use(morgan("dev"));
app.use(requestContext);
app.use(structuredLogger);

app.get("/health", (req, res) => {
  res.json({ success: true, status: "ok" });
});

app.use("/api", apiRateLimiter, routes);

app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;
