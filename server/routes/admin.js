const express = require("express");
const router = express.Router();
const mongoose = require("mongoose");
const User = require("../models/User");
const bcrypt = require("bcrypt");
const axios = require("axios");
const jwt = require("jsonwebtoken");
const multer = require("multer");
const path = require("path");
const adminLayout = "../views/layouts/admin";
const jwtSecret = process.env.JWT_SECRET;

const API_KEY = "987aea1677d0b14e760954964e938196";
const Review = require("../models/Review");
const WatchHistory = require("../models/WatchHistory");
const Follow = require("../models/Follow");
const List = require("../models/List");
const { computeAchievements } = require("../achievements");

// Multer — upload avatarów
const avatarStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, "public/uploads/avatars"),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `avatar_${req.userId}_${Date.now()}${ext}`);
  },
});
const avatarUpload = multer({
  storage: avatarStorage,
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = /jpeg|jpg|png|webp/;
    cb(null, allowed.test(file.mimetype));
  },
});

const authMiddleware = (req, res, next) => {
  const token = req.cookies.token;
  if (!token) return res.status(401).json({ message: "Unauthorized" });
  try {
    const decoded = jwt.verify(token, jwtSecret);
    req.userId = decoded.userId;
    // Aktualizuj lastActiveAt (bez blokowania requesta)
    User.findByIdAndUpdate(req.userId, { lastActiveAt: new Date() }).catch(() => {});
    next();
  } catch (error) {
    res.status(401).json({ message: "Unauthorized" });
  }
};

/**
 * GET /admin - Login Page
 */
router.get("/admin", async (req, res) => {
  try {
    const locals = {
      title: "Admin",
      description: "Strona, gdzie ocenisz obejrzane filmy",
    };
    res.render("admin/index", { locals, layout: adminLayout });
  } catch (error) {
    console.log(error);
  }
});

/**
 * POST /admin - Check Login
 */
router.post("/admin", async (req, res) => {
  try {
    const { username, password } = req.body;
    const user = await User.findOne({ username });

    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.render("admin/index", {
        locals: {
          title: "Admin",
          description: "Strona, gdzie ocenisz obejrzane filmy",
          errorMessage: "Nieprawidłowa nazwa użytkownika lub hasło",
        },
        layout: adminLayout,
      });
    }

    const token = jwt.sign({ userId: user._id }, jwtSecret);
    res.cookie("token", token, { httpOnly: true });
    req.session.isLoggedIn = true;
    res.redirect("/dashboard");
  } catch (error) {
    console.log(error);
    res.render("admin/index", {
      locals: {
        title: "Admin",
        description: "Strona, gdzie ocenisz obejrzane filmy",
        errorMessage: "Błąd! Spróbuj ponownie później :(",
      },
      layout: adminLayout,
    });
  }
});

/**
 * POST /add-rating - Dodaj lub zaktualizuj ocenę
 */
router.post("/add-rating", authMiddleware, async (req, res) => {
  const { movieId, rating, comment } = req.body;
  const userId = req.userId;

  try {
    const movieResponse = await axios.get(
      `https://api.themoviedb.org/3/movie/${movieId}?api_key=${API_KEY}&language=pl-PL`
    );
    const movie = movieResponse.data;

    await Review.findOneAndUpdate(
      { userId, movieId },
      {
        userId,
        movieId,
        movieTitle: movie.title,
        posterPath: movie.poster_path,
        runtime: movie.runtime,
        rating: Number(rating),
        comment,
      },
      { upsert: true, new: true }
    );

    res.render("ratingSuccess", {
      title: "Ocena dodana",
      message: "Ocena została pomyślnie dodana!",
      currentRoute: "/movies",
    });
  } catch (error) {
    console.error("Error adding rating:", error);
    res.status(500).send("Error adding rating.");
  }
});

/**
 * POST /set-watch-status - Ustaw status listy (watched/watchlist/favourite)
 */
router.post("/set-watch-status", authMiddleware, async (req, res) => {
  const { movieId, status } = req.body;
  const userId = req.userId;

  try {
    const movieResponse = await axios.get(
      `https://api.themoviedb.org/3/movie/${movieId}?api_key=${API_KEY}&language=pl-PL`
    );
    const movie = movieResponse.data;

    const updateData = {
      userId,
      movieId,
      movieTitle: movie.title,
      posterPath: movie.poster_path,
      runtime: movie.runtime,
      watchStatus: status,
    };

    if (status === "watched") {
      updateData.watchedDate = new Date();
    }

    await Review.findOneAndUpdate(
      { userId, movieId },
      updateData,
      { upsert: true, new: true }
    );

    // Zapisz do WatchHistory gdy oznaczono jako obejrzane
    if (status === "watched") {
      const alreadyLogged = await WatchHistory.findOne({ userId, movieId });
      if (!alreadyLogged) {
        await WatchHistory.create({
          userId,
          movieId,
          movieTitle: movie.title,
          posterPath: movie.poster_path,
          runtime: movie.runtime,
          genres: movie.genres || [],
          watchedAt: new Date(),
        });
      }
    }

    res.json({ success: true, status });
  } catch (error) {
    console.error("Error setting watch status:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /my-status/:movieId - Pobierz status danego filmu dla zalogowanego użytkownika
 */
router.get("/my-status/:movieId", authMiddleware, async (req, res) => {
  const { movieId } = req.params;
  const userId = req.userId;
  try {
    const review = await Review.findOne({ userId, movieId });
    res.json({
      watchStatus: review ? review.watchStatus : null,
      rating: review ? review.rating : null,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /movies/rate
 */
router.get("/movies/rate", authMiddleware, async (req, res) => {
  const movieId = req.query.movieId;
  try {
    const response = await axios.get(
      `https://api.themoviedb.org/3/movie/${movieId}?api_key=${API_KEY}&language=pl-PL`
    );
    const movie = response.data;

    const creditsResponse = await axios.get(
      `https://api.themoviedb.org/3/movie/${movieId}/credits?api_key=${API_KEY}&language=pl-PL`
    );
    movie.credits = creditsResponse.data;

    const existingReview = await Review.findOne({ userId: req.userId, movieId });

    res.render("movies", {
      movie,
      movieId,
      existingReview,
      currentRoute: "/movies/rate",
    });
  } catch (error) {
    console.error("Error fetching movie details:", error);
    res.render("movies", { movie: {}, movieId, existingReview: null, currentRoute: "/movies/rate" });
  }
});

/**
 * GET /dashboard
 */
router.get("/dashboard", authMiddleware, async (req, res) => {
  try {
    const userId = req.userId;
    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).render("admin/dashboard", {
        message: "User not found",
        currentRoute: "/dashboard",
      });
    }

    const reviews = await Review.find({ userId });

    const watched = reviews.filter(r => r.watchStatus === "watched");
    const watchlist = reviews.filter(r => r.watchStatus === "watchlist");
    const favourites = reviews.filter(r => r.watchStatus === "favourite");
    const rated = reviews.filter(r => r.rating != null);

    const [totalWatchHistory, followingCount, followersCount, lists] = await Promise.all([
      WatchHistory.aggregate([{ $match: { userId: mongoose.Types.ObjectId(userId) } }, { $group: { _id: null, total: { $sum: "$runtime" } } }]),
      Follow.countDocuments({ followerId: userId }),
      Follow.countDocuments({ followingId: userId }),
      List.countDocuments({ userId }),
    ]);

    const watchHistoryGenres = await WatchHistory.find({ userId }, "genres");
    const genreSet = new Set();
    watchHistoryGenres.forEach(w => (w.genres || []).forEach(g => genreSet.add(g.id)));

    const achievementStats = {
      ratedCount: rated.length,
      watchedCount: watched.length,
      watchlistCount: watchlist.length,
      favouritesCount: favourites.length,
      totalMinutes: totalWatchHistory[0]?.total || 0,
      followingCount,
      followersCount,
      listsCount: lists,
      hasFiveStar: rated.some(r => r.rating === 5),
      commentsCount: rated.filter(r => r.comment && r.comment.trim()).length,
      genresCount: genreSet.size,
    };

    const achievements = computeAchievements(achievementStats);

    res.render("admin/dashboard", {
      username: user.username,
      avatarUrl: user.avatarUrl,
      ratedMoviesCount: rated.length,
      watchedCount: watched.length,
      watchlistCount: watchlist.length,
      favouritesCount: favourites.length,
      ratings: rated,
      watched,
      watchlist,
      favourites,
      achievements,
      currentRoute: "/dashboard",
      passwordReset: req.query.passwordReset,
      error: req.query.error,
    });
  } catch (error) {
    console.error("Error fetching ratings:", error);
    res.render("admin/dashboard", {
      message: "Error fetching data",
      currentRoute: "/dashboard",
    });
  }
});

/**
 * POST /register
 */
router.post("/register", async (req, res) => {
  try {
    const { username, password } = req.body;
    const hashedPassword = await bcrypt.hash(password, 10);
    try {
      await User.create({ username, password: hashedPassword });
      res.render("admin/index", {
        locals: {
          title: "Admin",
          description: "Strona, gdzie ocenisz obejrzane filmy",
          successMessage: "Konto zarejestrowane pomyślnie! Teraz możesz się zalogować!",
        },
        layout: adminLayout,
      });
    } catch (error) {
      const msg = error.code === 11000
        ? "Taka nazwa użytkownika jest już zajęta!"
        : "Nie podano nazwy użytkownika!";
      res.render("admin/index", {
        locals: {
          title: "Admin",
          description: "Strona, gdzie ocenisz obejrzane filmy",
          errorMessageR: msg,
        },
        layout: adminLayout,
      });
    }
  } catch (error) {
    console.log(error);
    res.render("admin/index", {
      locals: {
        title: "Admin",
        description: "Strona, gdzie ocenisz obejrzane filmy",
        errorMessageR: "Błąd! Spróbuj ponownie później :(",
      },
      layout: adminLayout,
    });
  }
});

/**
 * GET /logout
 */
router.get("/logout", (req, res) => {
  res.clearCookie("token");
  req.session.isLoggedIn = false;
  res.redirect("/");
});

/**
 * POST /reset-password
 */
router.post("/reset-password", authMiddleware, async (req, res) => {
  const { newPassword } = req.body;
  const userId = req.userId;
  try {
    if (!newPassword) throw new Error("New Password is required.");
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await User.findByIdAndUpdate(userId, { password: hashedPassword });
    res.redirect("/dashboard?passwordReset=true");
  } catch (error) {
    console.error("Error resetting password:", error);
    res.redirect("/dashboard?error=reset");
  }
});

/**
 * GET /api/dashboard-stats - Dane dla D3.js
 */
router.get("/api/dashboard-stats", authMiddleware, async (req, res) => {
  try {
    const userId = req.userId;

    const [watchHistory, reviews] = await Promise.all([
      WatchHistory.find({ userId }),
      Review.find({ userId }),
    ]);

    // 1. Łączny czas
    const totalMinutes = watchHistory.reduce((sum, w) => sum + (w.runtime || 0), 0);

    // 2. Aktywność dzień po dniu (ostatnie 365 dni)
    const activityMap = {};
    watchHistory.forEach(w => {
      const day = new Date(w.watchedAt).toISOString().slice(0, 10);
      activityMap[day] = (activityMap[day] || 0) + 1;
    });
    const activityData = Object.entries(activityMap).map(([date, count]) => ({ date, count }));

    // 3. Rozkład gatunków
    const genreMap = {};
    watchHistory.forEach(w => {
      (w.genres || []).forEach(g => {
        genreMap[g.name] = (genreMap[g.name] || 0) + 1;
      });
    });
    const genreData = Object.entries(genreMap)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);

    // 4. Średnia ocena miesięcznie
    const ratingsByMonth = {};
    reviews.filter(r => r.rating != null).forEach(r => {
      const month = new Date(r.createdAt).toISOString().slice(0, 7);
      if (!ratingsByMonth[month]) ratingsByMonth[month] = { sum: 0, count: 0 };
      ratingsByMonth[month].sum += r.rating;
      ratingsByMonth[month].count += 1;
    });
    const ratingsOverTime = Object.entries(ratingsByMonth)
      .map(([month, { sum, count }]) => ({ month, avg: +(sum / count).toFixed(2), count }))
      .sort((a, b) => a.month.localeCompare(b.month));

    // 5. Czas oglądania miesięcznie
    const minutesByMonth = {};
    watchHistory.forEach(w => {
      const month = new Date(w.watchedAt).toISOString().slice(0, 7);
      minutesByMonth[month] = (minutesByMonth[month] || 0) + (w.runtime || 0);
    });
    const watchTimeByMonth = Object.entries(minutesByMonth)
      .map(([month, minutes]) => ({ month, hours: +(minutes / 60).toFixed(1) }))
      .sort((a, b) => a.month.localeCompare(b.month));

    // 6. Rozkład ocen (ile filmów z oceną 1,2,3,4,5)
    const ratingDist = [1, 2, 3, 4, 5].map(star => ({
      star,
      count: reviews.filter(r => r.rating === star).length,
    }));

    // 7. Szacowany czas listy "Do obejrzenia"
    const watchlistRuntime = reviews
      .filter(r => r.watchStatus === "watchlist")
      .reduce((sum, r) => sum + (r.runtime || 90), 0);

    res.json({
      totalMinutes,
      totalHours: Math.floor(totalMinutes / 60),
      watchedCount: watchHistory.length,
      ratedCount: reviews.filter(r => r.rating != null).length,
      watchlistMinutes: watchlistRuntime,
      activityData,
      genreData,
      ratingsOverTime,
      watchTimeByMonth,
      ratingDist,
    });
  } catch (error) {
    console.error("Error fetching dashboard stats:", error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /following - Strona obserwowanych użytkowników
 */
router.get("/following", authMiddleware, async (req, res) => {
  try {
    const userId = req.userId;

    // Pobierz listę obserwowanych
    const follows = await Follow.find({ followerId: userId }).populate("followingId");
    const followingUsers = follows.map(f => f.followingId).filter(Boolean);

    // Dla każdego obserwowanego zbierz statystyki
    const usersWithStats = await Promise.all(followingUsers.map(async (user) => {
      const [watchHistory, recentRatings, followersCount] = await Promise.all([
        WatchHistory.find({ userId: user._id }),
        Review.find({ userId: user._id, rating: { $exists: true, $ne: null } })
          .sort({ createdAt: -1 })
          .limit(3),
        Follow.countDocuments({ followingId: user._id }),
      ]);

      const totalMinutes = watchHistory.reduce((sum, w) => sum + (w.runtime || 0), 0);
      const totalHours = Math.floor(totalMinutes / 60);
      const remainingMinutes = totalMinutes % 60;

      return {
        _id: user._id,
        username: user.username,
        avatarUrl: user.avatarUrl,
        lastActiveAt: user.lastActiveAt,
        totalMinutes,
        totalHours,
        remainingMinutes,
        watchedCount: watchHistory.length,
        followersCount,
        recentRatings,
      };
    }));

    res.render("following", {
      users: usersWithStats,
      currentRoute: "/following",
      isLoggedIn: true,
    });
  } catch (error) {
    console.error("Error fetching following:", error);
    res.status(500).send("Błąd serwera");
  }
});

/**
 * GET /discover - Odkryj użytkowników (ranking aktywności)
 */
router.get("/discover", authMiddleware, async (req, res) => {
  try {
    const userId = req.userId;

    // Wszyscy użytkownicy poza zalogowanym
    const allUsers = await User.find({ _id: { $ne: userId } });

    // Pobierz follows zalogowanego (żeby wiedzieć kogo już obserwuje)
    const myFollows = await Follow.find({ followerId: userId });
    const followingIds = new Set(myFollows.map(f => f.followingId.toString()));

    const usersWithStats = await Promise.all(allUsers.map(async (user) => {
      const [watchHistory, followersCount, reviewsCount] = await Promise.all([
        WatchHistory.find({ userId: user._id }),
        Follow.countDocuments({ followingId: user._id }),
        Review.countDocuments({ userId: user._id, rating: { $exists: true, $ne: null } }),
      ]);

      const totalMinutes = watchHistory.reduce((sum, w) => sum + (w.runtime || 0), 0);
      const totalHours = Math.floor(totalMinutes / 60);

      const genreMap = {};
      watchHistory.forEach(w => {
        (w.genres || []).forEach(g => {
          genreMap[g.name] = (genreMap[g.name] || 0) + 1;
        });
      });
      const topGenre = Object.entries(genreMap).sort((a, b) => b[1] - a[1])[0];

      return {
        _id: user._id,
        username: user.username,
        avatarUrl: user.avatarUrl,
        lastActiveAt: user.lastActiveAt,
        totalMinutes,
        totalHours,
        watchedCount: watchHistory.length,
        reviewsCount,
        followersCount,
        topGenre: topGenre ? topGenre[0] : null,
        isFollowing: followingIds.has(user._id.toString()),
      };
    }));

    // Sortuj wg łącznego czasu oglądania
    usersWithStats.sort((a, b) => b.totalMinutes - a.totalMinutes);

    res.render("discover", {
      users: usersWithStats,
      currentRoute: "/discover",
      isLoggedIn: true,
    });
  } catch (error) {
    console.error("Error fetching discover:", error);
    res.status(500).send("Błąd serwera");
  }
});

/**
 * POST /follow/:userId - Obserwuj użytkownika
 */
router.post("/follow/:targetId", authMiddleware, async (req, res) => {
  try {
    const followerId = req.userId;
    const followingId = req.params.targetId;
    if (followerId === followingId) return res.status(400).json({ error: "Nie możesz obserwować siebie" });

    await Follow.findOneAndUpdate(
      { followerId, followingId },
      { followerId, followingId },
      { upsert: true }
    );
    res.json({ success: true, action: "followed" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * DELETE /follow/:userId - Przestań obserwować
 */
router.delete("/follow/:targetId", authMiddleware, async (req, res) => {
  try {
    await Follow.findOneAndDelete({ followerId: req.userId, followingId: req.params.targetId });
    res.json({ success: true, action: "unfollowed" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /lists - Listy zalogowanego użytkownika
 */
router.get("/lists", authMiddleware, async (req, res) => {
  try {
    const lists = await List.find({ userId: req.userId }).sort({ createdAt: -1 });
    res.json(lists);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /lists - Utwórz nową listę
 */
router.post("/lists", authMiddleware, async (req, res) => {
  try {
    const { name, description, isPublic } = req.body;
    const list = await List.create({ userId: req.userId, name, description, isPublic: isPublic !== "false" });
    res.json({ success: true, list });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /lists/:listId/add - Dodaj film do listy
 */
router.post("/lists/:listId/add", authMiddleware, async (req, res) => {
  try {
    const { movieId, movieTitle, posterPath } = req.body;
    const list = await List.findOne({ _id: req.params.listId, userId: req.userId });
    if (!list) return res.status(404).json({ error: "Lista nie istnieje" });

    const alreadyAdded = list.movies.some(m => m.movieId === movieId);
    if (!alreadyAdded) {
      list.movies.push({ movieId, movieTitle, posterPath });
      await list.save();
    }
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * DELETE /lists/:listId - Usuń listę
 */
router.delete("/lists/:listId", authMiddleware, async (req, res) => {
  try {
    await List.findOneAndDelete({ _id: req.params.listId, userId: req.userId });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /upload-avatar
 */
router.post("/upload-avatar", authMiddleware, avatarUpload.single("avatar"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, error: "Brak pliku" });
    const avatarUrl = `/uploads/avatars/${req.file.filename}`;
    await User.findByIdAndUpdate(req.userId, { avatarUrl });
    res.json({ success: true, avatarUrl });
  } catch (error) {
    console.error("Error uploading avatar:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /profile/:username - Publiczny profil użytkownika
 */
router.get("/profile/:username", async (req, res) => {
  try {
    const user = await User.findOne({ username: req.params.username });
    if (!user) return res.status(404).send("Nie znaleziono użytkownika");

    const reviews = await Review.find({ userId: user._id });
    const watched = reviews.filter(r => r.watchStatus === "watched");
    const watchlist = reviews.filter(r => r.watchStatus === "watchlist");
    const favourites = reviews.filter(r => r.watchStatus === "favourite");
    const rated = reviews.filter(r => r.rating != null);

    const [followersCount, followingCount, publicLists, profileWatchHistory, profileLists] = await Promise.all([
      Follow.countDocuments({ followingId: user._id }),
      Follow.countDocuments({ followerId: user._id }),
      List.find({ userId: user._id, isPublic: true }).sort({ createdAt: -1 }),
      WatchHistory.aggregate([{ $match: { userId: mongoose.Types.ObjectId(user._id) } }, { $group: { _id: null, total: { $sum: "$runtime" } } }]),
      List.countDocuments({ userId: user._id }),
    ]);

    const profileGenreData = await WatchHistory.find({ userId: user._id }, "genres");
    const profileGenreSet = new Set();
    profileGenreData.forEach(w => (w.genres || []).forEach(g => profileGenreSet.add(g.id)));

    const achievementStats = {
      ratedCount: rated.length,
      watchedCount: watched.length,
      watchlistCount: watchlist.length,
      favouritesCount: favourites.length,
      totalMinutes: profileWatchHistory[0]?.total || 0,
      followingCount,
      followersCount,
      listsCount: profileLists,
      hasFiveStar: rated.some(r => r.rating === 5),
      commentsCount: rated.filter(r => r.comment && r.comment.trim()).length,
      genresCount: profileGenreSet.size,
    };
    const achievements = computeAchievements(achievementStats);

    // Sprawdź czy zalogowany użytkownik obserwuje ten profil
    let isFollowing = false;
    let currentUserId = null;
    const token = req.cookies.token;
    if (token) {
      try {
        const decoded = jwt.verify(token, jwtSecret);
        currentUserId = decoded.userId;
        if (currentUserId !== user._id.toString()) {
          const follow = await Follow.findOne({ followerId: currentUserId, followingId: user._id });
          isFollowing = !!follow;
        }
      } catch (e) {}
    }

    res.render("profile", {
      profileUser: user,
      ratedMoviesCount: rated.length,
      watchedCount: watched.length,
      watchlistCount: watchlist.length,
      favouritesCount: favourites.length,
      followersCount,
      followingCount,
      ratings: rated,
      watched,
      watchlist,
      favourites,
      publicLists,
      achievements,
      isFollowing,
      currentUserId,
      currentRoute: "/profile",
      isLoggedIn: req.session.isLoggedIn,
    });
  } catch (error) {
    console.error("Error fetching profile:", error);
    res.status(500).send("Błąd serwera");
  }
});

/**
 * POST /delete-account
 */
router.post("/delete-account", authMiddleware, async (req, res) => {
  const userId = req.userId;
  try {
    await User.findByIdAndDelete(userId);
    await Review.deleteMany({ userId });
    res.clearCookie("token");
    req.session.destroy();
    res.status(200).send("Account deleted successfully.");
  } catch (error) {
    console.error("Error deleting account:", error);
    res.status(500).send("Error deleting account.");
  }
});

module.exports = router;
