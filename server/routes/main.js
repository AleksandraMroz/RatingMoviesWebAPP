const express = require("express");
const router = express.Router();
const axios = require("axios");
const API_KEY = "987aea1677d0b14e760954964e938196";
const Review = require("../models/Review");
const User = require("../models/User");

const TMDB_GENRES = [
  { id: 28, name: "Akcja" },
  { id: 12, name: "Przygodowy" },
  { id: 16, name: "Animacja" },
  { id: 35, name: "Komedia" },
  { id: 80, name: "Kryminał" },
  { id: 99, name: "Dokumentalny" },
  { id: 18, name: "Dramat" },
  { id: 10751, name: "Familijny" },
  { id: 14, name: "Fantasy" },
  { id: 36, name: "Historyczny" },
  { id: 27, name: "Horror" },
  { id: 10402, name: "Muzyczny" },
  { id: 9648, name: "Tajemnica" },
  { id: 10749, name: "Romans" },
  { id: 878, name: "Sci-Fi" },
  { id: 53, name: "Thriller" },
  { id: 10752, name: "Wojenny" },
  { id: 37, name: "Western" },
];

router.get("/", async (req, res) => {
  try {
    res.render("index", { isLoggedIn: req.session.isLoggedIn, currentRoute: "/" });
  } catch (error) {
    res.render("index", { isLoggedIn: req.session.isLoggedIn, currentRoute: "/" });
  }
});

router.get("/about", (req, res) => res.render("about", { currentRoute: "/about" }));
router.get("/contact", (req, res) => res.render("contact", { currentRoute: "/contact" }));

/**
 * GET /api/search-suggest — autocomplete (JSON)
 */
router.get("/api/search-suggest", async (req, res) => {
  const q = (req.query.q || "").trim();
  if (q.length < 2) return res.json([]);
  try {
    const response = await axios.get(
      `https://api.themoviedb.org/3/search/movie?api_key=${API_KEY}&query=${encodeURIComponent(q)}&language=pl-PL&page=1`
    );
    const results = (response.data.results || []).slice(0, 7).map(m => ({
      id: m.id,
      title: m.title,
      year: m.release_date ? m.release_date.slice(0, 4) : "",
      poster: m.poster_path ? `https://image.tmdb.org/t/p/w92${m.poster_path}` : null,
      vote: m.vote_average ? m.vote_average.toFixed(1) : null,
    }));
    res.json(results);
  } catch {
    res.json([]);
  }
});

/**
 * GET /search — zaawansowane wyszukiwanie z filtrami
 */
router.get("/search", async (req, res) => {
  const { q, genre, year_from, year_to, vote_min, language, sort_by } = req.query;
  const hasFilters = q || genre || year_from || year_to || vote_min || language;

  if (!hasFilters) {
    return res.render("search", { movies: [], query: {}, genres: TMDB_GENRES, currentRoute: "/search" });
  }

  try {
    let movies = [];

    if (q) {
      const response = await axios.get(
        `https://api.themoviedb.org/3/search/movie?api_key=${API_KEY}&query=${encodeURIComponent(q)}&language=pl-PL&page=1`
      );
      movies = response.data.results || [];
      // Filtruj wyniki wyszukiwania po dodatkowych parametrach
      if (genre) movies = movies.filter(m => (m.genre_ids || []).includes(Number(genre)));
      if (year_from) movies = movies.filter(m => m.release_date && m.release_date.slice(0, 4) >= year_from);
      if (year_to) movies = movies.filter(m => m.release_date && m.release_date.slice(0, 4) <= year_to);
      if (vote_min) movies = movies.filter(m => m.vote_average >= Number(vote_min));
    } else {
      // Discover — filtrowanie bez frazy
      const params = new URLSearchParams({
        api_key: API_KEY,
        language: "pl-PL",
        sort_by: sort_by || "popularity.desc",
        include_adult: "false",
        page: "1",
      });
      if (genre) params.set("with_genres", genre);
      if (year_from) params.set("primary_release_date.gte", `${year_from}-01-01`);
      if (year_to) params.set("primary_release_date.lte", `${year_to}-12-31`);
      if (vote_min) params.set("vote_average.gte", vote_min);
      if (language) params.set("with_original_language", language);
      const response = await axios.get(`https://api.themoviedb.org/3/discover/movie?${params}`);
      movies = response.data.results || [];
    }

    res.render("search", { movies, query: req.query, genres: TMDB_GENRES, currentRoute: "/search" });
  } catch (error) {
    console.error("Search error:", error);
    res.render("search", { movies: [], query: req.query, genres: TMDB_GENRES, currentRoute: "/search" });
  }
});

// POST /search — stary endpoint (redirect do GET)
router.post("/search", (req, res) => {
  res.redirect(`/search?q=${encodeURIComponent(req.body.searchTerm || "")}`);
});

/**
 * GET /movies/details
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
