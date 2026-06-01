const mongoose = require("mongoose");

const Schema = mongoose.Schema;
const UserSchema = new Schema({
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  avatarUrl: { type: String, default: null },
  lastActiveAt: { type: Date, default: Date.now },
}, { timestamps: true });

module.exports = mongoose.model("User", UserSchema);
