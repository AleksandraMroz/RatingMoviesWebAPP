const APILINK =
  "https://api.themoviedb.org/3/discover/movie?sort_by=popularity.desc&api_key=41ee980e4b5f05f6693fda00eb7c4fd4&page=1&language=pl-PL";
const IMG_PATH = "https://image.tmdb.org/t/p/w1280";

const main = document.getElementById("section");
const form = document.getElementById("form");
const search = document.getElementById("query");

returnMovies(APILINK);

function returnMovies(url) {
  fetch(url)
    .then((res) => res.json())
    .then((data) => {
      main.innerHTML = "";
      data.results.forEach((element) => {
        const movieCard = document.createElement("div");
        movieCard.classList.add("movie-card");

        const image = document.createElement("img");
        image.src = IMG_PATH + element.poster_path;

        const title = document.createElement("h3");
        title.textContent = element.title;

        const link = document.createElement("a");

        if (window.isLoggedIn === "true") {
          link.href = `/movies/rate?movieId=${element.id}`;
          link.textContent = "Oceń film";
        } else {
          link.href = `/movies/details?movieId=${element.id}`;
          link.textContent = "Zobacz opis filmu";
        }

        movieCard.appendChild(image);
        movieCard.appendChild(title);
        movieCard.appendChild(link);

        main.appendChild(movieCard);
      });
    });
}

// Search feature, unchanged
if (form) {
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const searchItem = search.value;

    if (searchItem) {
      returnMovies(SEARCHAPI + searchItem);
      search.value = "";
    }
  });
}

const axios = require("axios"); // Do obsługi zapytań HTTP
const router = express.Router();

const API_KEY = "41ee980e4b5f05f6693fda00eb7c4fd4";
const SEARCHAPI = `https://api.themoviedb.org/3/search/movie?&api_key=${API_KEY}&query=&language=pl-PL`;

router.post("/search", async (req, res) => {
  const searchTerm = req.body.searchTerm;

  try {
    const response = await axios.get(`${SEARCHAPI}${searchTerm}`);
    const movies = response.data.results;

    res.render("searchResults", { movies });
  } catch (error) {
    console.error("Error fetching movies:", error);
    res.render("searchResults", { movies: [] });
  }
});

module.exports = router;
