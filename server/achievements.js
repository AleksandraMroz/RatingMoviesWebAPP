const ACHIEVEMENTS = [
  {
    id: "first_rating",
    icon: "🎬",
    name: "Pierwszy krok",
    desc: "Oceń swój pierwszy film",
    check: (s) => s.ratedCount >= 1,
  },
  {
    id: "ten_ratings",
    icon: "⭐",
    name: "Krytyk filmowy",
    desc: "Oceń 10 filmów",
    check: (s) => s.ratedCount >= 10,
  },
  {
    id: "fifty_ratings",
    icon: "🏆",
    name: "Koneser",
    desc: "Oceń 50 filmów",
    check: (s) => s.ratedCount >= 50,
  },
  {
    id: "hundred_ratings",
    icon: "💎",
    name: "Legenda",
    desc: "Oceń 100 filmów",
    check: (s) => s.ratedCount >= 100,
  },
  {
    id: "first_watched",
    icon: "👁️",
    name: "Widz",
    desc: "Oznacz pierwszy film jako obejrzany",
    check: (s) => s.watchedCount >= 1,
  },
  {
    id: "watchlist_10",
    icon: "📋",
    name: "Planista",
    desc: "Dodaj 10 filmów do listy \"Do obejrzenia\"",
    check: (s) => s.watchlistCount >= 10,
  },
  {
    id: "favourites_5",
    icon: "❤️",
    name: "Serce kinomana",
    desc: "Dodaj 5 filmów do ulubionych",
    check: (s) => s.favouritesCount >= 5,
  },
  {
    id: "night_owl",
    icon: "🦉",
    name: "Nocna sowa",
    desc: "Łącznie 100 godzin obejrzanych filmów",
    check: (s) => s.totalMinutes >= 6000,
  },
  {
    id: "marathon",
    icon: "🏃",
    name: "Maraton filmowy",
    desc: "Łącznie 500 godzin obejrzanych filmów",
    check: (s) => s.totalMinutes >= 30000,
  },
  {
    id: "social_butterfly",
    icon: "🦋",
    name: "Dusza towarzystwa",
    desc: "Obserwuj 5 użytkowników",
    check: (s) => s.followingCount >= 5,
  },
  {
    id: "influencer",
    icon: "📣",
    name: "Influencer",
    desc: "Zdobądź 10 obserwujących",
    check: (s) => s.followersCount >= 10,
  },
  {
    id: "curator",
    icon: "📚",
    name: "Kurator",
    desc: "Utwórz 3 własne listy filmów",
    check: (s) => s.listsCount >= 3,
  },
  {
    id: "perfect_score",
    icon: "🌟",
    name: "Arcydzieło",
    desc: "Wystaw ocenę 5/5 przynajmniej raz",
    check: (s) => s.hasFiveStar,
  },
  {
    id: "critic",
    icon: "✍️",
    name: "Pisarz",
    desc: "Zostaw 10 recenzji z komentarzem",
    check: (s) => s.commentsCount >= 10,
  },
  {
    id: "explorer",
    icon: "🌍",
    name: "Odkrywca",
    desc: "Obejrzyj filmy z 5 różnych gatunków",
    check: (s) => s.genresCount >= 5,
  },
];

function computeAchievements(stats) {
  return ACHIEVEMENTS.map((a) => ({
    ...a,
    unlocked: a.check(stats),
  }));
}

module.exports = { ACHIEVEMENTS, computeAchievements };
