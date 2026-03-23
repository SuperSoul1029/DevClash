const AppError = require("../utils/appError");

function validate(schema, source = "body") {
  return (req, res, next) => {
    const parsed = schema.safeParse(req[source]);

    if (!parsed.success) {
      return next(
        new AppError("Validation failed", 400, parsed.error.issues.map((issue) => ({
          path: issue.path.join("."),
          message: issue.message
        })))
      );
    }

    req[source] = parsed.data;
    return next();
  };
}

module.exports = validate;
