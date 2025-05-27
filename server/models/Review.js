const mongoose = require("mongoose");

const Schema = mongoose.Schema;
const ReviewSchema = new Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  movieId: {
    type: String,
    required: true,
  },
  rating: { type: Number, required: true, min: 0, max: 5 },
  comment: { type: String },
});

module.exports = mongoose.model("Review", ReviewSchema);
