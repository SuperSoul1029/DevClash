const bcrypt = require("bcryptjs");
const env = require("../src/config/env");
const { connectDb, disconnectDb } = require("../src/config/db");
const User = require("../src/models/User");
const Profile = require("../src/models/Profile");
const Subject = require("../src/models/Subject");
const Topic = require("../src/models/Topic");
const TopicProgress = require("../src/models/TopicProgress");
const SubjectProgress = require("../src/models/SubjectProgress");
const RevisionEvent = require("../src/models/RevisionEvent");
const PlannerTask = require("../src/models/PlannerTask");
const GeneratedExam = require("../src/models/GeneratedExam");
const ExamAttempt = require("../src/models/ExamAttempt");
const VideoJob = require("../src/models/VideoJob");

const subjectsSeed = [
  { name: "Physics", code: "PHY", classLevel: "11" },
  { name: "Chemistry", code: "CHE", classLevel: "11" },
  { name: "Mathematics", code: "MTH", classLevel: "11" },
  { name: "Biology", code: "BIO", classLevel: "11" },
  { name: "Physics", code: "PHY", classLevel: "12" },
  { name: "Chemistry", code: "CHE", classLevel: "12" },
  { name: "Mathematics", code: "MTH", classLevel: "12" },
  { name: "Biology", code: "BIO", classLevel: "12" }
];

async function run() {
  try {
    await connectDb(env.mongoUri);

    await Promise.all([
      User.deleteMany({}),
      Profile.deleteMany({}),
      Subject.deleteMany({}),
      Topic.deleteMany({}),
      TopicProgress.deleteMany({}),
      SubjectProgress.deleteMany({}),
      RevisionEvent.deleteMany({}),
      PlannerTask.deleteMany({}),
      GeneratedExam.deleteMany({}),
      ExamAttempt.deleteMany({}),
      VideoJob.deleteMany({})
    ]);

    const passwordHash = await bcrypt.hash("password123", 10);
    const user = await User.create({
      fullName: "Demo Student",
      email: "student@devclash.local",
      passwordHash,
      role: "student"
    });

    await Profile.create({
      userId: user._id,
      classLevel: "11",
      targetExam: "JEE",
      timezone: "Asia/Kolkata"
    });

    const subjects = await Subject.insertMany(subjectsSeed);

    const phy11 = subjects.find((subject) => subject.code === "PHY" && subject.classLevel === "11");
    const mth12 = subjects.find((subject) => subject.code === "MTH" && subject.classLevel === "12");

    await Topic.insertMany([
      {
        subjectId: phy11._id,
        classLevel: "11",
        chapter: "Motion",
        name: "Motion in a Straight Line",
        slug: "motion-straight-line",
        prerequisiteTopicIds: []
      },
      {
        subjectId: mth12._id,
        classLevel: "12",
        chapter: "Calculus",
        name: "Integrals",
        slug: "integrals",
        prerequisiteTopicIds: []
      }
    ]);

    console.log("Seed complete:");
    console.log("- Demo user: student@devclash.local / password123");
    console.log(`- Subjects created: ${subjects.length}`);
    process.exit(0);
  } catch (error) {
    console.error("Seed failed", error);
    process.exit(1);
  } finally {
    await disconnectDb();
  }
}

run();
