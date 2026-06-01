const mongoose = require("mongoose");

// Własne listy użytkownika (poza standardowymi watched/watchlist/favourite)
const ListSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  name: { type: String, required: true },
  description: { type: String },
  isPublic: { type: Boolean, default: true },
  movies: [{
    movieId: { type: String },
    movieTitle: { type: String },
    posterPath: { type: String },
    addedAt: { type: Date, default: Date.now },
  }],
}, { timestamps: true });

module.exports = mongoose.model("List", ListSchema);
