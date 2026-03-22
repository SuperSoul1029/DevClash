const asyncHandler = require("../utils/asyncHandler");
const Topic = require("../models/Topic");
const Subject = require("../models/Subject");

function tokenize(text) {
  return String(text || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
}

function scoreTopic(topic, tokens) {
  const haystack = `${topic.name} ${topic.chapter} ${topic.subjectName || ""}`.toLowerCase();
  return tokens.reduce((score, token) => (haystack.includes(token) ? score + 1 : score), 0);
}

const queryTutor = asyncHandler(async (req, res) => {
  const { question, classLevel, subject } = req.body;
  const tokens = tokenize(question);

  const topicQuery = {};
  if (classLevel) {
    topicQuery.classLevel = classLevel;
  }

  const subjectQuery = {};
  if (subject) {
    subjectQuery.name = { $regex: subject, $options: "i" };
  }
  if (classLevel) {
    subjectQuery.classLevel = classLevel;
  }

  const subjects = await Subject.find(subjectQuery).select("_id name classLevel").lean();
  if (subjects.length > 0) {
    topicQuery.subjectId = { $in: subjects.map((item) => item._id) };
  }

  const subjectById = new Map(subjects.map((item) => [String(item._id), item]));
  const topics = await Topic.find(topicQuery).limit(60).lean();
  const ranked = topics
    .map((topic) => {
      const topicSubject = subjectById.get(String(topic.subjectId));
      return {
        ...topic,
        subjectName: topicSubject?.name,
        score: scoreTopic(topic, tokens)
      };
    })
    .sort((left, right) => right.score - left.score);

  const references = ranked.filter((topic) => topic.score > 0).slice(0, 3);

  if (references.length === 0) {
    return res.json({
      success: true,
      response: {
        answer:
          "I cannot confidently answer this from the available curriculum sources. Please refine the question with class level and chapter context.",
        confidence: 0.2,
        abstained: true,
        citations: []
      }
    });
  }

  const citations = references.map((topic) => ({
    sourceType: "curriculum_topic",
    sourceId: topic._id,
    label: `${topic.subjectName || "Subject"} - ${topic.chapter} - ${topic.name}`
  }));

  const answer = [
    `Based on the covered sources, focus first on ${references[0].name} in ${references[0].chapter}.`,
    "Use a three-step learning loop: concept recall, one worked example, then one transfer question under time pressure.",
    "Track mistakes by concept tag so your next practice set can prioritize weak areas instead of random revision."
  ].join(" ");

  return res.json({
    success: true,
    response: {
      answer,
      confidence: 0.74,
      abstained: false,
      citations
    }
  });
});

module.exports = {
  queryTutor
};