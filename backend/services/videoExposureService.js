const Exposure = require("../models/LessonVideoExposure");
const { mergeRanges, uniqueSeconds, MAX_STORED_RANGES } = require("../utils/videoExposure");
async function saveRanges(filter, incoming) {
  // Compare-and-swap protects concurrent tabs without requiring transactions.
  for (let attempt = 0; attempt < 5; attempt++) {
    const existing = await Exposure.findOne(filter).lean();
    const watchedRanges = mergeRanges([...(existing?.watchedRanges || []), ...incoming]);
    if (watchedRanges.length > MAX_STORED_RANGES) throw Object.assign(new Error("Exposure storage range limit reached"), { status: 413 });
    const values = { watchedRanges, totalUniqueWatchedSeconds: uniqueSeconds(watchedRanges) };
    if (!existing) {
      try { return await Exposure.create({ ...filter, ...values }); }
      catch (error) { if (error.code === 11000) continue; throw error; }
    }
    const saved = await Exposure.findOneAndUpdate({ ...filter, __v: existing.__v }, { $set: values, $inc: { __v: 1 } }, { returnDocument: "after", runValidators: true });
    if (saved) return saved;
  }
  throw Object.assign(new Error("Exposure update busy; retry a later batch"), { status: 503 });
}
module.exports = { saveRanges };
