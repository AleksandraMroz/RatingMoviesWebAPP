document.addEventListener("DOMContentLoaded", function () {
  // === Modals ===
  const resetPasswordBtn = document.getElementById("reset-password-btn");
  const deleteAccountBtn = document.getElementById("delete-account-btn");
  const resetPasswordModal = document.getElementById("reset-password-modal");
  const deleteAccountModal = document.getElementById("delete-account-modal");
  const closeReset = document.getElementById("close-reset");
  const closeDelete = document.getElementById("close-delete");
  const confirmDeleteAccount = document.getElementById("confirm-delete-account");

  resetPasswordBtn.onclick = () => { resetPasswordModal.style.display = "block"; };
  deleteAccountBtn.onclick = () => { deleteAccountModal.style.display = "block"; };
  closeReset.onclick = () => { resetPasswordModal.style.display = "none"; };
  closeDelete.onclick = () => { deleteAccountModal.style.display = "none"; };

  document.getElementById("reset-password-form").addEventListener("submit", function (e) {
    e.preventDefault();
    const formData = new FormData(this);
    fetch("/reset-password", {
      method: "POST",
      body: new URLSearchParams(formData),
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
    }).then((response) => {
      if (response.ok) {
        resetPasswordModal.style.display = "none";
        showDashToast("✅ Hasło zostało zmienione.", "success");
      } else {
        showDashToast("❌ Błąd przy zmianie hasła.", "error");
      }
    });
  });

  confirmDeleteAccount.onclick = function () {
    fetch("/delete-account", { method: "POST" }).then((response) => {
      if (response.ok) {
        deleteAccountModal.style.display = "none";
        showDashToast("Konto zostało usunięte. Za chwilę zostaniesz przekierowany...", "success");
        setTimeout(() => { window.location.href = "/"; }, 2000);
      } else {
        showDashToast("❌ Błąd przy usuwaniu konta.", "error");
      }
    });
  };

  function showDashToast(msg, type) {
    const t = document.createElement("div");
    t.className = "toast toast-" + (type === "error" ? "error" : "success");
    t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(() => t.classList.add("toast-show"), 10);
    setTimeout(() => { t.classList.remove("toast-show"); setTimeout(() => t.remove(), 400); }, 3500);
  }

  window.onclick = function (event) {
    if (event.target == resetPasswordModal) resetPasswordModal.style.display = "none";
    if (event.target == deleteAccountModal) deleteAccountModal.style.display = "none";
  };

  // === Upload avatara ===
  const avatarInput = document.getElementById("avatar-input");
  if (avatarInput) {
    avatarInput.addEventListener("change", () => {
      const file = avatarInput.files[0];
      if (!file) return;
      const formData = new FormData();
      formData.append("avatar", file);
      fetch("/upload-avatar", { method: "POST", body: formData })
        .then(r => r.json())
        .then(data => {
          if (data.success) {
            const wrap = document.getElementById("avatar-preview-wrap");
            wrap.innerHTML = `<img src="${data.avatarUrl}?t=${Date.now()}" alt="avatar" id="avatar-img" style="width:100%;height:100%;object-fit:cover;border-radius:50%" />`;
          }
        })
        .catch(err => console.error(err));
    });
  }

  // === Zakładki ===
  const tabBtns = document.querySelectorAll(".tab-btn");
  const tabContents = document.querySelectorAll(".tab-content");
  let recommendLoaded = false;
  let communityLoaded = false;

  tabBtns.forEach(btn => {
    btn.addEventListener("click", () => {
      tabBtns.forEach(b => b.classList.remove("active"));
      tabContents.forEach(c => c.classList.remove("active"));
      btn.classList.add("active");
      const tab = btn.dataset.tab;
      document.getElementById(`tab-${tab}`).classList.add("active");

      if (tab === "recommend" && !recommendLoaded) loadRecommendations();
      if (tab === "community" && !communityLoaded) loadCommunityStats();
      if (tab === "lists") renderLists();
    });
  });

  // === Listy ===
  const createListBtn = document.getElementById("create-list-btn");
  const createListForm = document.getElementById("create-list-form");
  const saveListBtn = document.getElementById("save-list-btn");
  const cancelListBtn = document.getElementById("cancel-list-btn");

  if (createListBtn) {
    createListBtn.onclick = () => { createListForm.style.display = "block"; };
    cancelListBtn.onclick = () => { createListForm.style.display = "none"; };

    saveListBtn.onclick = async () => {
      const name = document.getElementById("list-name-input").value.trim();
      if (!name) return;
      const desc = document.getElementById("list-desc-input").value.trim();
      const isPublic = document.getElementById("list-public-check").checked;
      await fetch("/lists", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, description: desc, isPublic }),
      });
      createListForm.style.display = "none";
      document.getElementById("list-name-input").value = "";
      document.getElementById("list-desc-input").value = "";
      renderLists();
    };
  }

  async function renderLists() {
    const container = document.getElementById("lists-container");
    if (!container) return;
    container.innerHTML = "<p class='lists-loading'>Ładowanie...</p>";
    const res = await fetch("/lists");
    const lists = await res.json();
    if (!lists.length) {
      container.innerHTML = "<p class='empty-tab'>Nie masz jeszcze żadnych list. Kliknij \"+ Nowa lista\" żeby zacząć!</p>";
      return;
    }
    container.innerHTML = lists.map(l => `
      <div class="list-card" data-id="${l._id}">
        <div class="list-card-cover">
          ${l.movies.slice(0,4).filter(m => m.posterPath).map(m =>
            `<img src="https://image.tmdb.org/t/p/w92${m.posterPath}" alt="" />`
          ).join("") || '<span class="list-cover-ph">🎬</span>'}
        </div>
        <div class="list-card-info">
          <div class="list-card-top">
            <h4><a href="/list/${l._id}">${l.name}</a></h4>
            <span class="list-badge ${l.isPublic ? 'public' : 'private'}">${l.isPublic ? '🌍' : '🔒'}</span>
          </div>
          ${l.description ? `<p class="list-card-desc">${l.description}</p>` : ""}
          <p class="list-card-meta">🎬 ${l.movies.length} filmów</p>
          ${l.movies.length > 0 ? `
          <div class="list-movies-mini">
            ${l.movies.slice(0,6).map(m => `
              <span class="list-movie-chip">
                <a href="/movies/details?movieId=${m.movieId}">${m.movieTitle}</a>
                <button class="remove-from-list" data-list="${l._id}" data-movie="${m.movieId}" title="Usuń">×</button>
              </span>`).join("")}
            ${l.movies.length > 6 ? `<span class="list-movie-more">+${l.movies.length - 6} więcej</span>` : ""}
          </div>` : ""}
        </div>
        <button class="delete-list-btn" data-id="${l._id}" title="Usuń listę">🗑</button>
      </div>`).join("");

    container.querySelectorAll(".delete-list-btn").forEach(btn => {
      btn.onclick = async () => {
        if (!confirm("Usunąć tę listę?")) return;
        await fetch(`/lists/${btn.dataset.id}`, { method: "DELETE" });
        renderLists();
      };
    });

    container.querySelectorAll(".remove-from-list").forEach(btn => {
      btn.onclick = async (e) => {
        e.preventDefault();
        await fetch(`/lists/${btn.dataset.list}/movies/${btn.dataset.movie}`, { method: "DELETE" });
        renderLists();
      };
    });
  }

  // === Rekomendacje ===
  async function loadRecommendations() {
    recommendLoaded = true;
    const [recRes, simRes] = await Promise.all([
      fetch("/api/recommendations"),
      fetch("/api/similar-users"),
    ]);
    const rec = await recRes.json();
    const sim = await simRes.json();

    document.querySelector(".recommend-loading").style.display = "none";
    document.getElementById("recommend-content").style.display = "block";

    // Opis gatunków
    const desc = document.getElementById("recommend-desc");
    desc.textContent = rec.movies.length
      ? "Na podstawie Twoich ulubionych gatunków filmowych"
      : "Popularne filmy, których jeszcze nie widziałeś/aś";

    // Siatka filmów
    const grid = document.getElementById("recommend-grid");
    grid.innerHTML = rec.movies.map(m => `
      <a href="/movies/details?movieId=${m.id}" class="rec-movie-card">
        ${m.poster_path
          ? `<img src="https://image.tmdb.org/t/p/w200${m.poster_path}" alt="${m.title}" loading="lazy" />`
          : '<div class="rec-no-poster">🎬</div>'}
        <div class="rec-card-info">
          <span class="rec-title">${m.title}</span>
          <span class="rec-meta">${m.release_date ? m.release_date.slice(0,4) : ""} · ⭐ ${m.vote_average ? m.vote_average.toFixed(1) : "—"}</span>
        </div>
      </a>`).join("") || "<p class='empty-tab'>Brak rekomendacji — oceń więcej filmów!</p>";

    // Podobni użytkownicy
    const list = document.getElementById("similar-users-list");
    if (!sim.length) {
      list.innerHTML = "<p class='empty-tab'>Brak podobnych użytkowników — oceń więcej filmów, żeby znaleźć kinomanów o zbliżonym guście!</p>";
      return;
    }
    list.innerHTML = sim.map(s => `
      <div class="similar-user-card">
        <a href="/profile/${s.user.username}" class="similar-avatar">
          ${s.user.avatarUrl
            ? `<img src="${s.user.avatarUrl}" alt="${s.user.username}" />`
            : `<div class="avatar-placeholder">${s.user.username[0].toUpperCase()}</div>`}
        </a>
        <div class="similar-info">
          <a href="/profile/${s.user.username}" class="similar-username">${s.user.username}</a>
          <span class="similar-meta">⭐ śr. ${s.avgRating} · ${s.ratedCount} ocen · ${s.genreOverlap} wspólnych gatunków</span>
        </div>
        <div class="similar-score-badge">${s.score}%</div>
        ${!s.isFollowing
          ? `<button class="follow-btn similar-follow-btn" data-id="${s.user._id}">+ Obserwuj</button>`
          : `<span class="following-label">✓ Obserwujesz</span>`}
      </div>`).join("");

    // Przyciski follow
    list.querySelectorAll(".similar-follow-btn").forEach(btn => {
      btn.addEventListener("click", async () => {
        const id = btn.dataset.id;
        await fetch(`/follow/${id}`, { method: "POST" });
        btn.outerHTML = `<span class="following-label">✓ Obserwujesz</span>`;
      });
    });
  }

  // === Statystyki społeczności ===
  async function loadCommunityStats() {
    communityLoaded = true;
    const res = await fetch("/api/community-stats");
    const data = await res.json();

    document.querySelector(".community-loading").style.display = "none";
    document.getElementById("community-content").style.display = "block";

    document.getElementById("c-my-avg").textContent = data.myAvg ? data.myAvg.toFixed(1) + " / 5" : "—";
    document.getElementById("c-comm-avg").textContent = data.communityAvg ? data.communityAvg.toFixed(1) + " / 5" : "—";
    document.getElementById("c-my-hours").textContent = data.myMinutes ? Math.round(data.myMinutes / 60) + "h" : "—";
    document.getElementById("c-avg-hours").textContent = data.avgMinutes ? Math.round(data.avgMinutes / 60) + "h" : "—";

    // D3 — rozkład ocen społeczności
    if (data.communityDist && typeof d3 !== "undefined") {
      const el = document.getElementById("chart-community-dist");
      el.innerHTML = "";
      const W = el.clientWidth || 320, H = 200;
      const margin = { top: 20, right: 16, bottom: 30, left: 36 };
      const w = W - margin.left - margin.right;
      const h = H - margin.top - margin.bottom;
      const svg = d3.select(el).append("svg").attr("width", W).attr("height", H)
        .append("g").attr("transform", `translate(${margin.left},${margin.top})`);

      const x = d3.scaleBand().domain([1,2,3,4,5]).range([0, w]).padding(0.3);
      const y = d3.scaleLinear().domain([0, d3.max(data.communityDist, d => d.count) || 1]).range([h, 0]);

      svg.append("g").attr("transform", `translate(0,${h})`).call(d3.axisBottom(x).tickFormat(d => "★".repeat(d)));
      svg.append("g").call(d3.axisLeft(y).ticks(4).tickFormat(d3.format("d")));

      svg.selectAll("rect").data(data.communityDist).join("rect")
        .attr("x", d => x(d.rating)).attr("y", d => y(d.count))
        .attr("width", x.bandwidth()).attr("height", d => h - y(d.count))
        .attr("fill", "#7c3aed").attr("rx", 4);

      // Dodaj linię Twojej oceny
      if (data.myAvg) {
        svg.append("line")
          .attr("x1", 0).attr("x2", w)
          .attr("y1", y(0)).attr("y2", y(0))
          .attr("stroke", "#7c3aed").attr("stroke-width", 2).attr("stroke-dasharray", "6,3");
      }
    }

    // D3 — top gatunki społeczności
    if (data.topCommunityGenres && typeof d3 !== "undefined") {
      const el2 = document.getElementById("chart-community-genres");
      el2.innerHTML = "";
      const W2 = el2.clientWidth || 320, H2 = 200;
      const margin = { top: 10, right: 16, bottom: 30, left: 100 };
      const w2 = W2 - margin.left - margin.right;
      const h2 = H2 - margin.top - margin.bottom;
      const svg2 = d3.select(el2).append("svg").attr("width", W2).attr("height", H2)
        .append("g").attr("transform", `translate(${margin.left},${margin.top})`);

      const y2 = d3.scaleBand().domain(data.topCommunityGenres.map(g => g.name)).range([0, h2]).padding(0.25);
      const x2 = d3.scaleLinear().domain([0, d3.max(data.topCommunityGenres, g => g.count) || 1]).range([0, w2]);

      svg2.append("g").call(d3.axisLeft(y2));
      svg2.append("g").attr("transform", `translate(0,${h2})`).call(d3.axisBottom(x2).ticks(4).tickFormat(d3.format("d")));

      const palette = ["#7c3aed","#a78bfa","#06b6d4","#f59e0b","#f43f5e"];
      svg2.selectAll("rect").data(data.topCommunityGenres).join("rect")
        .attr("x", 0).attr("y", d => y2(d.name))
        .attr("width", d => x2(d.count)).attr("height", y2.bandwidth())
        .attr("fill", (d, i) => palette[i % palette.length]).attr("rx", 3);
    }
  }
});
