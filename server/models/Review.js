const mongoose = require("mongoose");

const Schema = mongoose.Schema;
const ReviewSchema = new Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  movieId: { type: String, required: true },
  movieTitle: { type: String },
  posterPath: { type: String },
  runtime: { type: Number },
  rating: { type: Number, min: 0, max: 5 },
  comment: { type: String },
  watchStatus: {
    type: String,
    enum: ["watched", "watchlist", "favourite"],
    default: null,
  },
  watchedDate: { type: Date },
}, { timestamps: true });

module.exports = mongoose.model("Review", ReviewSchema);
