const asyncHandler = require("../utils/asyncHandler");
const Profile = require("../models/Profile");

const getMyProfile = asyncHandler(async (req, res) => {
  const profile = await Profile.findOne({ userId: req.user._id });

  res.json({
    success: true,
    profile
  });
});

const upsertMyProfile = asyncHandler(async (req, res) => {
  const profile = await Profile.findOneAndUpdate(
    { userId: req.user._id },
    { ...req.body, userId: req.user._id },
    { returnDocument: "after", upsert: true }
  );

  res.json({
    success: true,
    profile
  });
});

module.exports = {
  getMyProfile,
  upsertMyProfile
};
