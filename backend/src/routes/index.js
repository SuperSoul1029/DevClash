const express = require("express");
const authRoutes = require("./authRoutes");
const userRoutes = require("./userRoutes");
const curriculumRoutes = require("./curriculumRoutes");
const retentionRoutes = require("./retentionRoutes");
const plannerRoutes = require("./plannerRoutes");
const coverageRoutes = require("./coverageRoutes");
const progressRoutes = require("./progressRoutes");
const testRoutes = require("./testRoutes");
const practiceRoutes = require("./practiceRoutes");
const tutorRoutes = require("./tutorRoutes");
const mediaRoutes = require("./mediaRoutes");
const jobRoutes = require("./jobRoutes");
const healthRoutes = require("./healthRoutes");

const router = express.Router();

router.use("/auth", authRoutes);
router.use("/users", userRoutes);
router.use("/", curriculumRoutes);
router.use("/retention", retentionRoutes);
router.use("/planner", plannerRoutes);
router.use("/coverage", coverageRoutes);
router.use("/progress", progressRoutes);
router.use("/tests", testRoutes);
router.use("/practice", practiceRoutes);
router.use("/tutor", tutorRoutes);
router.use("/media", mediaRoutes);
router.use("/jobs", jobRoutes);
router.use("/health", healthRoutes);

module.exports = router;
