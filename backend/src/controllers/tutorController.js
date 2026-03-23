const asyncHandler = require("../utils/asyncHandler");
const { queryTutorWithRag } = require("../services/ragService");

const queryTutor = asyncHandler(async (req, res) => {
  const { question, classLevel, subject } = req.body;
  const response = await queryTutorWithRag({
    question,
    classLevel,
    subject
  });

  return res.json({
    success: true,
    response
  });
});

module.exports = {
  queryTutor
};