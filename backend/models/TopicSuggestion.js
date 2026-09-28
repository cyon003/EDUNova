const mongoose = require('mongoose');
const { topicRangesError } = require('../utils/lessonTopics');
const range = new mongoose.Schema({ title: String, startTimeSeconds: Number, endTimeSeconds: Number }, { _id: false });
const schema = new mongoose.Schema({
  course: { type: mongoose.Schema.Types.ObjectId, required: true },
  lessonId: { type: mongoose.Schema.Types.ObjectId, required: true },
  mediaVersion: { type: String, required: true },
  storage: String, storedName: String,
  transcriptionJobId: { type: mongoose.Schema.Types.ObjectId, required: true },
  transcriptResultToken: { type: String, required: true },
  algorithmVersion: { type: String, required: true },
  modelRevision: { type: String, required: true },
  status: { type: String, enum: ['queued', 'processing', 'completed', 'failed', 'superseded'], default: 'queued' },
  attempts: { type: Number, default: 0 },
  availableAt: Date, leaseUntil: Date, leaseToken: String, errorCode: String,
  generatedTopics: { type: [range], default: [], validate: value => !topicRangesError(value) },
  draftTopics: { type: [range], default: [], validate: value => !topicRangesError(value) },
  provenance: mongoose.Schema.Types.Mixed,
  diagnostics: mongoose.Schema.Types.Mixed,
  reviewStatus: { type: String, enum: ['pending', 'accepted', 'rejected'], default: 'pending' },
  reviewRevision: { type: Number, default: 0 },
  reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  reviewedAt: Date,
  acceptedTopicIds: [mongoose.Schema.Types.ObjectId],
  completedAt: Date,
}, { timestamps: true, collection: 'topic_suggestions', optimisticConcurrency: true });
schema.index({ transcriptionJobId: 1, transcriptResultToken: 1, algorithmVersion: 1, modelRevision: 1 }, { unique: true });
schema.index({ status: 1, availableAt: 1, leaseUntil: 1 });
schema.index({ course: 1, lessonId: 1, mediaVersion: 1 });
module.exports = mongoose.model('TopicSuggestion', schema);
