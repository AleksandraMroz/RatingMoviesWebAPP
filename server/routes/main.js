const express = require("express");
const router = express.Router();
const axios = require("axios");
const API_KEY = "987aea1677d0b14e760954964e938196";
const SEARCHAPI = `https://api.themoviedb.org/3/search/movie?&api_key=${API_KEY}&query=`;
const Review = require("../models/Review");

/**
 * GET /
 * HOME
 */
router.get("/", async (req, res) => {
  try {
    const reviews = await Review.find({});
    res.render("index", {
      reviews,
      isLoggedIn: req.session.isLoggedIn,
      currentRoute: "/",
    });
  } catch (error) {
    console.log(error);
    res.render("index", {
      reviews: [],
      isLoggedIn: req.session.isLoggedIn,
      currentRoute: "/",
    });
  }
});
/**
 * GET /
 * HOME ROUTE
 */
router.get("/", (req, res) => {
  res.render("index", {
    isLoggedIn: req.session.isLoggedIn, // Przekazanie stanu zalogowania
    currentRoute: "/",
  });
});
/**
 * GET /
 * MOVIES
 */

router.get("/movies", async (req, res) => {
  const movieId = req.query.movieId;
  try {
    const response = await axios.get(
      `https://api.themoviedb.org/3/movie/${movieId}?api_key=${API_KEY}&language=pl-PL`
    );
    const movie = response.data;
    res.render("movies", { movie, movieId, currentRoute: "/movies" });
  } catch (error) {
    console.error("Error fetching movie details:", error);
    res.render("movies", { movie: {}, movieId, currentRoute: "/movies" });
  }
});

/**
 * GET /
 * About
 */
router.get("/about", (req, res) => {
  res.render("about", {
    currentRoute: "/about",
  });
});

router.post("/search", async (req, res) => {
  const searchTerm = req.body.searchTerm;

  try {
    const response = await axios.get(
      `${SEARCHAPI}${encodeURIComponent(searchTerm)}`
    );
    const movies = response.data.results || [];

    res.render("search", { movies: movies, currentRoute: "/" });
  } catch (error) {
    console.error("Error fetching movies:", error);
    res.render("search", { movies: [], currentRoute: "/" });
  }
});

/**
 * GET /
 * Contact
 */
router.get("/contact", (req, res) => {
  res.render("contact", {
    currentRoute: "/contact",
  });
});

router.post("/search", async (req, res) => {
  const searchTerm = req.body.searchTerm;

  try {
    const response = await axios.get(
      `${SEARCHAPI}${encodeURIComponent(searchTerm)}`
    );
    const movies = response.data.results || [];

    res.render("search", { movies: movies, currentRoute: "/" });
  } catch (error) {
    console.error("Error fetching movies:", error);
    res.render("search", { movies: [], currentRoute: "/" });
  }
});
/**
 * GET /
 * MOVIES DETAILS
 */

router.get("/movies/details", async (req, res) => {
  const movieId = req.query.movieId;
  try {
    const movieResponse = await axios.get(
      `https://api.themoviedb.org/3/movie/${movieId}?api_key=${API_KEY}&language=pl-PL`
    );
    const movie = movieResponse.data;

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

module.exports = router;
