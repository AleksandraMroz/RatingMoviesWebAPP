const mongoose = require("mongoose");

// Historia oglądania — każdy wpis = jeden seans (podstawa pod D3.js)
const WatchHistorySchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  movieId: { type: String, required: true },
  movieTitle: { type: String },
  posterPath: { type: String },
  runtime: { type: Number },
  watchedAt: { type: Date, default: Date.now },
  genres: [{ id: Number, name: String }],
}, { timestamps: true });

module.exports = mongoose.model("WatchHistory", WatchHistorySchema);
