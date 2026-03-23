function log(level, event, context = {}) {
  const payload = {
    ts: new Date().toISOString(),
    level,
    event,
    ...context
  };

  const line = JSON.stringify(payload);
  if (level === "error") {
    console.error(line);
    return;
  }

  console.log(line);
}

function logInfo(event, context = {}) {
  log("info", event, context);
}

function logWarn(event, context = {}) {
  log("warn", event, context);
}

function logError(event, context = {}) {
  log("error", event, context);
}

module.exports = {
  logInfo,
  logWarn,
  logError
};