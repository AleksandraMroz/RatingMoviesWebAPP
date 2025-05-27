const express = require("express");
const router = express.Router();
const User = require("../models/User");
const bcrypt = require("bcrypt");
const axios = require("axios");
const jwt = require("jsonwebtoken");
const adminLayout = "../views/layouts/admin";
const jwtSecret = process.env.JWT_SECRET;

const API_KEY = "987aea1677d0b14e760954964e938196";
const Review = require("../models/Review");

/**
 * Check Login
 */
const authMiddleware = (req, res, next) => {
  const token = req.cookies.token;

  if (!token) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  try {
    const decoded = jwt.verify(token, jwtSecret);
    req.userId = decoded.userId;
    console.log("User ID:", req.userId); // Dodaj to
    next();
  } catch (error) {
    res.status(401).json({ message: "Unauthorized" });
  }
};

/**
 * GET /
 * Admin - Login Page
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
 * POST /
 * Admin - Check Login
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
 * POST /
 * Add Rating
 */
router.post("/add-rating", authMiddleware, async (req, res) => {
  const { movieId, rating, comment } = req.body;
  const userId = req.userId;

  try {
    const review = new Review({ userId, movieId, rating, comment });
    await review.save();

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
 * GET /
 * MOVIES RATE
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
    const credits = creditsResponse.data;

    movie.credits = credits;
    res.render("movies", { movie, movieId, currentRoute: "/movies/rate" });
  } catch (error) {
    console.error("Error fetching movie details:", error);
    res.render("movies", { movie: {}, movieId, currentRoute: "/movies/rate" });
  }
});

/**

GET /

Admin Dashboard */
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

    // Pobieranie ocen z MongoDB
    const reviews = await Review.find({ userId });

    // Tworzenie tablicy ocen const

    ratingsArray = await Promise.all(
      reviews
        .map(async (review) => {
          try {
            const response = await axios.get(
              `https://api.themoviedb.org/3/movie/${review.movieId}?api_key=${API_KEY}&language=pl-PL`
            );
            const movie = response.data;
            return {
              movieTitle: movie.title,
              posterPath: movie.poster_path,
              rating: review.rating,
              comment: review.comment,
            };
          } catch (error) {
            console.error("Error fetching movie details:", error);
            return null;
          }
        })
        .filter((rating) => rating !== null)
    ); // Usuwanie niespełnionych fetchów z tablicy

    res.render("admin/dashboard", {
      username: user.username,
      ratedMoviesCount: ratingsArray.length,
      ratings: ratingsArray,
      currentRoute: "/dashboard",
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
 * POST /
 * Admin - Register
 */
router.post("/register", async (req, res) => {
  try {
    const { username, password } = req.body;
    const hashedPassword = await bcrypt.hash(password, 10);

    try {
      const user = await User.create({ username, password: hashedPassword });
      res.render("admin/index", {
        locals: {
          title: "Admin",
          description: "Strona, gdzie ocenisz obejrzane filmy",
          successMessage:
            "Konto zarejestrowane pomyślnie! Teraz możesz się zalogować!",
        },
        layout: adminLayout,
      });
    } catch (error) {
      if (error.code === 11000) {
        res.render("admin/index", {
          locals: {
            title: "Admin",
            description: "Strona, gdzie ocenisz obejrzane filmy",
            errorMessageR: "Taka nazwa użytkownika jest już zajęta!",
          },
          layout: adminLayout,
        });
      } else {
        res.render("admin/index", {
          locals: {
            title: "Admin",
            description: "Strona, gdzie ocenisz obejrzane filmy",
            errorMessageR: "Nie podano nazwy użytkownika!",
          },
          layout: adminLayout,
        });
      }
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
 * GET /
 * Admin Logout
 */
router.get("/logout", (req, res) => {
  res.clearCookie("token");
  req.session.isLoggedIn = false; // Zresetuj stan zalogowania
  res.redirect("/");
});

/**
 * GET /
 * MOVIES DETAILS
 */
router.get("/movies/details", async (req, res) => {
  const movieId = req.query.movieId;
  try {
    // Pobierz szczegóły filmu
    const movieResponse = await axios.get(
      `https://api.themoviedb.org/3/movie/${movieId}?api_key=${API_KEY}&language=pl-PL`
    );
    const movie = movieResponse.data;

    // Pobierz obsadę filmu (opcjonalnie)
    const creditsResponse = await axios.get(
      `https://api.themoviedb.org/3/movie/${movieId}/credits?api_key=${API_KEY}&language=pl-PL`
    );
    const credits = creditsResponse.data;
    movie.credits = credits;

    res.render("moviedetails", { movie, currentRoute: "/movies/details" });
  } catch (error) {
    console.error("Error fetching movie details:", error);
    res.render("moviedetails", { movie: {}, currentRoute: "/movies/details" });
  }
});
/**
 * GET /
 * RESET PASSWORD
 */
router.post("/reset-password", authMiddleware, async (req, res) => {
  const { newPassword } = req.body;

  // Debugowanie
  console.log("New Password:", newPassword);

  const userId = req.userId;

  try {
    if (!newPassword) {
      throw new Error("New Password is required.");
    }
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await User.findByIdAndUpdate(userId, { password: hashedPassword });
    res.redirect("/dashboard?passwordReset=true");
  } catch (error) {
    console.error("Error resetting password:", error);
    res.redirect("/dashboard?error=reset");
  }
});

router.get("/dashboard", authMiddleware, async (req, res) => {
  res.render("admin/dashboard", {
    username: user.username,
    ratedMoviesCount: ratingsArray.length,
    ratings: ratingsArray,
    currentRoute: "/dashboard",
    passwordReset: req.query.passwordReset,
    error: req.query.error,
  });
});

/**
 * GET /
 * DELETE ACCOUNT
 */
router.post("/delete-account", authMiddleware, async (req, res) => {
  const userId = req.userId;

  try {
    await User.findByIdAndDelete(userId);
    res.clearCookie("token");
    req.session.destroy();
    res.status(200).send("Account deleted successfully.");
  } catch (error) {
    console.error("Error deleting account:", error);
    res.status(500).send("Error deleting account.");
  }
});
module.exports = router;
