const express = require("express");
const router = express.Router();
const axios = require("axios");
const API_KEY = "987aea1677d0b14e760954964e938196";
const SEARCHAPI = `https://api.themoviedb.org/3/search/movie?&api_key=${API_KEY}&query=`;
const Review = require("../models/Review");
const User = require("../models/User");

/**
 * GET / - HOME
 */
router.get("/", async (req, res) => {
  try {
    res.render("index", {
      isLoggedIn: req.session.isLoggedIn,
      currentRoute: "/",
    });
  } catch (error) {
    console.log(error);
    res.render("index", {
      isLoggedIn: req.session.isLoggedIn,
      currentRoute: "/",
    });
  }
});

/**
 * GET /about
 */
router.get("/about", (req, res) => {
  res.render("about", { currentRoute: "/about" });
});

/**
 * GET /contact
 */
router.get("/contact", (req, res) => {
  res.render("contact", { currentRoute: "/contact" });
});

/**
 * POST /search
 */
router.post("/search", async (req, res) => {
  const searchTerm = req.body.searchTerm;
  try {
    const response = await axios.get(`${SEARCHAPI}${encodeURIComponent(searchTerm)}`);
    const movies = response.data.results || [];
    res.render("search", { movies, currentRoute: "/" });
  } catch (error) {
    console.error("Error fetching movies:", error);
    res.render("search", { movies: [], currentRoute: "/" });
  }
});

/**
 * GET /movies/details - Szczegóły filmu z publicznymi ocenami
 */
router.get("/movies/details", async (req, res) => {
  const movieId = req.query.movieId;
  try {
    const [movieResponse, creditsResponse] = await Promise.all([
      axios.get(`https://api.themoviedb.org/3/movie/${movieId}?api_key=${API_KEY}&language=pl-PL`),
      axios.get(`https://api.themoviedb.org/3/movie/${movieId}/credits?api_key=${API_KEY}&language=pl-PL`),
    ]);

    const movie = movieResponse.data;
    movie.credits = creditsResponse.data;

    // Pobierz publiczne oceny z komentarzem
    const reviews = await Review.find({ movieId, rating: { $exists: true, $ne: null } })
      .populate("userId", "username avatarUrl")
      .sort({ createdAt: -1 })
      .limit(20);

    const publicReviews = reviews.map(r => ({
      rating: r.rating,
      comment: r.comment,
      user: r.userId,
    }));

    res.render("moviedetails", { movie, publicReviews, currentRoute: "/movies/details" });
  } catch (error) {
    console.error("Error fetching movie details:", error);
    res.render("moviedetails", { movie: {}, publicReviews: [], currentRoute: "/movies/details" });
  }
});

module.exports = router;
