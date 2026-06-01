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

// /register i /login → alias do /admin (ta sama strona logowania/rejestracji)
router.get("/register", (req, res) => res.redirect("/admin"));
router.get("/login", (req, res) => res.redirect("/admin"));

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
        $set: {
          userId,
          movieId,
          movieTitle: movie.title,
          posterPath: movie.poster_path,
          runtime: movie.runtime,
          rating: Number(rating),
          comment,
        },
      },
      { upsert: true, new: true }
    );

    // Redirect na szczegóły filmu z flagą sukcesu
    res.redirect(`/movies/details?movieId=${movieId}&rated=1`);
  } catch (error) {
    console.error("Error adding rating:", error);
    res.status(500).send("Error adding rating.");
  }
});

/**
 * POST /set-watch-status - Ustaw status (watched/watchlist) lub ulubione (isFavourite)
 * watched i watchlist wzajemnie się wykluczają.
 * isFavourite jest niezależne i może być łączone z watched.
 */
router.post("/set-watch-status", authMiddleware, async (req, res) => {
  const { movieId, status } = req.body;
  const userId = req.userId;

  try {
    const movieResponse = await axios.get(
      `https://api.themoviedb.org/3/movie/${movieId}?api_key=${API_KEY}&language=pl-PL`
    );
    const movie = movieResponse.data;

    const baseData = {
      userId,
      movieId,
      movieTitle: movie.title,
      posterPath: movie.poster_path,
      runtime: movie.runtime,
    };

    let setData = { ...baseData };
    let unsetData = {};

    if (status === "favourite" || status === "unfavourite") {
      // Toggle ulubionych — nie zmienia watchStatus
      setData.isFavourite = status === "favourite";
    } else if (status === null || status === "none") {
      // Usuń watchStatus
      setData.isFavourite = false;
      unsetData.watchStatus = 1;
    } else {
      // watched lub watchlist — wzajemnie wykluczające
      setData.watchStatus = status;
      if (status === "watched") {
        setData.watchedDate = new Date();
      }
    }

    await Review.findOneAndUpdate(
      { userId, movieId },
      { $set: setData, ...(Object.keys(unsetData).length ? { $unset: unsetData } : {}) },
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
      isFavourite: review ? !!review.isFavourite : false,
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
    const favourites = reviews.filter(r => r.isFavourite);
    const rated = reviews.filter(r => r.rating != null);

    const [totalWatchHistory, followingCount, followersCount, lists] = await Promise.all([
      WatchHistory.aggregate([{ $match: { userId: new mongoose.Types.ObjectId(userId) } }, { $group: { _id: null, total: { $sum: "$runtime" } } }]),
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
      username: "",
      avatarUrl: null,
      ratedMoviesCount: 0,
      watchedCount: 0,
      watchlistCount: 0,
      favouritesCount: 0,
      ratings: [],
      watched: [],
      watchlist: [],
      favourites: [],
      achievements: [],
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

    const watchedReviews = reviews.filter(r => r.watchStatus === "watched");

    // Jeśli WatchHistory jest puste, buduj dane z Review (fallback)
    const historySource = watchHistory.length > 0 ? watchHistory : watchedReviews.map(r => ({
      runtime: r.runtime || 0,
      watchedAt: r.watchedDate || r.updatedAt || r.createdAt,
      genres: [],
      movieId: r.movieId,
    }));

    // 1. Łączny czas
    const totalMinutes = historySource.reduce((sum, w) => sum + (w.runtime || 0), 0);

    // 2. Aktywność dzień po dniu (ostatnie 365 dni)
    const activityMap = {};

    // Aktywność z WatchHistory / obejrzanych
    historySource.forEach(w => {
      const day = new Date(w.watchedAt).toISOString().slice(0, 10);
      activityMap[day] = (activityMap[day] || 0) + 1;
    });
    // Uzupełnij ocenami (jeśli dany dzień nie istnieje jeszcze)
    reviews.filter(r => r.rating != null).forEach(r => {
      const day = new Date(r.updatedAt || r.createdAt).toISOString().slice(0, 10);
      if (!activityMap[day]) activityMap[day] = 0;
      activityMap[day] += 0.5; // ocena liczy jako połowa aktywności
    });
    const activityData = Object.entries(activityMap)
      .map(([date, count]) => ({ date, count: Math.ceil(count) }))
      .sort((a, b) => a.date.localeCompare(b.date));

    // 3. Rozkład gatunków — z WatchHistory lub z pominięciem jeśli puste
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
      const month = new Date(r.updatedAt || r.createdAt).toISOString().slice(0, 7);
      if (!ratingsByMonth[month]) ratingsByMonth[month] = { sum: 0, count: 0 };
      ratingsByMonth[month].sum += r.rating;
      ratingsByMonth[month].count += 1;
    });
    const ratingsOverTime = Object.entries(ratingsByMonth)
      .map(([month, { sum, count }]) => ({ month, avg: +(sum / count).toFixed(2), count }))
      .sort((a, b) => a.month.localeCompare(b.month));

    // 5. Czas oglądania miesięcznie (z historySource)
    const minutesByMonth = {};
    historySource.forEach(w => {
      const month = new Date(w.watchedAt).toISOString().slice(0, 7);
      minutesByMonth[month] = (minutesByMonth[month] || 0) + (w.runtime || 0);
    });
    const watchTimeByMonth = Object.entries(minutesByMonth)
      .map(([month, minutes]) => ({ month, hours: +(minutes / 60).toFixed(1) }))
      .sort((a, b) => a.month.localeCompare(b.month));

    // 6. Rozkład ocen
    const ratingDist = [1, 2, 3, 4, 5].map(star => ({
      star,
      count: reviews.filter(r => r.rating === star).length,
    }));

    // 7. Szacowany czas listy "Do obejrzenia"
    const watchlistRuntime = reviews
      .filter(r => r.watchStatus === "watchlist")
      .reduce((sum, r) => sum + (r.runtime || 90), 0);

    const ratedCount = reviews.filter(r => r.rating != null).length;
    // Liczba obejrzanych = większa z obu źródeł
    const watchedCount = Math.max(watchHistory.length, watchedReviews.length);

    res.json({
      totalMinutes,
      totalHours: Math.floor(totalMinutes / 60),
      watchedCount,
      ratedCount,
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
 * DELETE /lists/:listId/movies/:movieId - Usuń film z listy
 */
router.delete("/lists/:listId/movies/:movieId", authMiddleware, async (req, res) => {
  try {
    const list = await List.findOne({ _id: req.params.listId, userId: req.userId });
    if (!list) return res.status(404).json({ error: "Lista nie istnieje" });
    list.movies = list.movies.filter(m => m.movieId !== req.params.movieId);
    await list.save();
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /list/:listId - Publiczna strona listy
 */
router.get("/list/:listId", async (req, res) => {
  try {
    const list = await List.findById(req.params.listId).populate("userId", "username avatarUrl");
    if (!list) return res.status(404).send("Lista nie istnieje");
    if (!list.isPublic) {
      // Sprawdź czy właściciel jest zalogowany
      const token = req.cookies.token;
      let ownerId = null;
      if (token) {
        try { ownerId = jwt.verify(token, jwtSecret).userId; } catch {}
      }
      if (!ownerId || ownerId !== list.userId._id.toString()) {
        return res.status(403).send("Ta lista jest prywatna");
      }
    }
    res.render("list-public", { list, currentRoute: "/list" });
  } catch (error) {
    res.status(500).send("Błąd serwera");
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
    const favourites = reviews.filter(r => r.isFavourite);
    const rated = reviews.filter(r => r.rating != null);

    const [followersCount, followingCount, publicLists, profileWatchHistory, profileLists] = await Promise.all([
      Follow.countDocuments({ followingId: user._id }),
      Follow.countDocuments({ followerId: user._id }),
      List.find({ userId: user._id, isPublic: true }).sort({ createdAt: -1 }),
      WatchHistory.aggregate([{ $match: { userId: new mongoose.Types.ObjectId(user._id) } }, { $group: { _id: null, total: { $sum: "$runtime" } } }]),
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

/**
 * GET /feed — social feed (aktywność obserwowanych)
 */
router.get("/feed", authMiddleware, async (req, res) => {
  try {
    const follows = await Follow.find({ followerId: req.userId }).select("followingId");
    const followingIds = follows.map(f => f.followingId);

    // Ostatnie oceny + zmiany statusu od obserwowanych (max 40 wpisów łącznie)
    const [recentReviews, recentWatched] = await Promise.all([
      Review.find({
        userId: { $in: followingIds },
        rating: { $ne: null },
      })
        .populate("userId", "username avatarUrl")
        .sort({ updatedAt: -1 })
        .limit(25),
      WatchHistory.find({ userId: { $in: followingIds } })
        .populate("userId", "username avatarUrl")
        .sort({ watchedAt: -1 })
        .limit(25),
    ]);

    // Łącz i sortuj po dacie
    const feed = [
      ...recentReviews.map(r => ({
        type: "rating",
        user: r.userId,
        movieTitle: r.movieTitle,
        movieId: r.movieId,
        posterPath: r.posterPath,
        rating: r.rating,
        comment: r.comment,
        date: r.updatedAt,
      })),
      ...recentWatched.map(w => ({
        type: "watched",
        user: w.userId,
        movieTitle: w.movieTitle,
        movieId: w.movieId,
        posterPath: w.posterPath,
        date: w.watchedAt,
      })),
    ]
      .sort((a, b) => new Date(b.date) - new Date(a.date))
      .slice(0, 40);

    res.render("feed", {
      feed,
      isEmpty: followingIds.length === 0,
      currentRoute: "/feed",
    });
  } catch (error) {
    console.error(error);
    res.render("feed", { feed: [], isEmpty: true, currentRoute: "/feed" });
  }
});

/**
 * GET /api/recommendations — rekomendacje na podstawie gatunków i ocen
 */
router.get("/api/recommendations", authMiddleware, async (req, res) => {
  try {
    const reviews = await Review.find({ userId: req.userId, rating: { $gte: 4 } });
    const watchHistory = await WatchHistory.find({ userId: req.userId });

    // Zbierz ulubione gatunki (z wysoko ocenionych filmów)
    const genreCount = {};
    watchHistory.forEach(w => {
      if (w.genres) w.genres.forEach(g => {
        genreCount[g.id] = (genreCount[g.id] || 0) + 1;
      });
    });

    const topGenres = Object.entries(genreCount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([id]) => id);

    const seenMovieIds = new Set([
      ...reviews.map(r => String(r.movieId)),
      ...watchHistory.map(w => String(w.movieId)),
    ]);

    if (topGenres.length === 0) {
      // Fallback: popularne filmy
      const resp = await axios.get(
        `https://api.themoviedb.org/3/movie/popular?api_key=${API_KEY}&language=pl-PL&page=1`
      );
      const movies = (resp.data.results || [])
        .filter(m => !seenMovieIds.has(String(m.id)))
        .slice(0, 12);
      return res.json({ movies, genres: [] });
    }

    // Pobierz filmy z top gatunków
    const [resp1, resp2] = await Promise.all([
      axios.get(`https://api.themoviedb.org/3/discover/movie?api_key=${API_KEY}&language=pl-PL&sort_by=vote_average.desc&vote_count.gte=100&with_genres=${topGenres[0]}&page=1`),
      topGenres[1]
        ? axios.get(`https://api.themoviedb.org/3/discover/movie?api_key=${API_KEY}&language=pl-PL&sort_by=vote_average.desc&vote_count.gte=100&with_genres=${topGenres[1]}&page=1`)
        : Promise.resolve({ data: { results: [] } }),
    ]);

    const candidates = [
      ...(resp1.data.results || []),
      ...(resp2.data.results || []),
    ]
      .filter(m => !seenMovieIds.has(String(m.id)))
      .sort((a, b) => b.vote_average - a.vote_average);

    // Deduplicate
    const seen = new Set();
    const movies = candidates.filter(m => {
      if (seen.has(m.id)) return false;
      seen.add(m.id);
      return true;
    }).slice(0, 12);

    res.json({ movies, topGenres });
  } catch (error) {
    console.error(error);
    res.json({ movies: [], topGenres: [] });
  }
});

/**
 * GET /api/similar-users — użytkownicy o podobnych gustach
 */
router.get("/api/similar-users", authMiddleware, async (req, res) => {
  try {
    const myReviews = await Review.find({ userId: req.userId, rating: { $ne: null } });
    const myWatchHistory = await WatchHistory.find({ userId: req.userId });

    // Moje ulubione gatunki
    const myGenres = {};
    myWatchHistory.forEach(w => (w.genres || []).forEach(g => {
      myGenres[g.id] = (myGenres[g.id] || 0) + 1;
    }));
    const myTopGenres = new Set(
      Object.entries(myGenres).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([id]) => id)
    );

    const myAvgRating = myReviews.length
      ? myReviews.reduce((s, r) => s + r.rating, 0) / myReviews.length
      : 3;

    // Wszyscy inni użytkownicy
    const follows = await Follow.find({ followerId: req.userId }).select("followingId");
    const alreadyFollowing = new Set(follows.map(f => f.followingId.toString()));

    const allUsers = await User.find({ _id: { $ne: req.userId } }).select("_id username avatarUrl").limit(50);

    const scores = await Promise.all(allUsers.map(async (u) => {
      const [uHistory, uReviews] = await Promise.all([
        WatchHistory.find({ userId: u._id }, "genres"),
        Review.find({ userId: u._id, rating: { $ne: null } }, "rating"),
      ]);

      const uGenres = {};
      uHistory.forEach(w => (w.genres || []).forEach(g => {
        uGenres[g.id] = (uGenres[g.id] || 0) + 1;
      }));
      const uTopGenres = new Set(
        Object.entries(uGenres).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([id]) => id)
      );

      // Overlap gatunków (Jaccard)
      const intersection = [...myTopGenres].filter(g => uTopGenres.has(g)).length;
      const union = new Set([...myTopGenres, ...uTopGenres]).size;
      const genreScore = union > 0 ? intersection / union : 0;

      // Podobieństwo średniej oceny
      const uAvg = uReviews.length
        ? uReviews.reduce((s, r) => s + r.rating, 0) / uReviews.length
        : 3;
      const ratingScore = 1 - Math.abs(myAvgRating - uAvg) / 5;

      const score = genreScore * 0.7 + ratingScore * 0.3;

      return {
        user: { _id: u._id, username: u.username, avatarUrl: u.avatarUrl },
        score: Math.round(score * 100),
        genreOverlap: intersection,
        avgRating: uAvg.toFixed(1),
        ratedCount: uReviews.length,
        isFollowing: alreadyFollowing.has(u._id.toString()),
      };
    }));

    const similar = scores
      .filter(s => s.ratedCount >= 3 && s.score > 10)
      .sort((a, b) => b.score - a.score)
      .slice(0, 8);

    res.json(similar);
  } catch (error) {
    console.error(error);
    res.json([]);
  }
});

/**
 * GET /api/community-stats — statystyki porównawcze
 */
router.get("/api/community-stats", authMiddleware, async (req, res) => {
  try {
    const [myReviews, allReviews, myWatchHistory, communityWatchHistory] = await Promise.all([
      Review.find({ userId: req.userId, rating: { $ne: null } }),
      Review.find({ rating: { $ne: null } }),
      WatchHistory.find({ userId: req.userId }),
      WatchHistory.find({}),
    ]);

    const myAvg = myReviews.length
      ? (myReviews.reduce((s, r) => s + r.rating, 0) / myReviews.length).toFixed(2)
      : null;
    const communityAvg = allReviews.length
      ? (allReviews.reduce((s, r) => s + r.rating, 0) / allReviews.length).toFixed(2)
      : null;

    // Rozkład ocen społeczności
    const communityDist = [1,2,3,4,5].map(n => ({
      rating: n,
      count: allReviews.filter(r => r.rating === n).length,
    }));

    // Moje minuty vs średnia
    const myMinutes = myWatchHistory.reduce((s, w) => s + (w.runtime || 0), 0);

    const userMinutesMap = {};
    communityWatchHistory.forEach(w => {
      userMinutesMap[w.userId] = (userMinutesMap[w.userId] || 0) + (w.runtime || 0);
    });
    const minutesList = Object.values(userMinutesMap);
    const avgMinutes = minutesList.length
      ? Math.round(minutesList.reduce((s, m) => s + m, 0) / minutesList.length)
      : 0;

    // Top gatunki społeczności
    const allGenreCounts = {};
    communityWatchHistory.forEach(w => (w.genres || []).forEach(g => {
      allGenreCounts[g.name] = (allGenreCounts[g.name] || 0) + 1;
    }));
    const topCommunityGenres = Object.entries(allGenreCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name, count]) => ({ name, count }));

    res.json({
      myAvg: Number(myAvg),
      communityAvg: Number(communityAvg),
      communityDist,
      myRatedCount: myReviews.length,
      communityRatedCount: allReviews.length,
      myMinutes,
      avgMinutes,
      topCommunityGenres,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({});
  }
});

module.exports = router;
