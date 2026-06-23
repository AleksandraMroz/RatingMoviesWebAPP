(function() {
  document.addEventListener("click", function(e) {
    const btn = e.target.closest(".cqa-btn");
    if (!btn) return;

    if (btn.classList.contains("cqa-rate")) {
      const movieId = btn.dataset.movieId;
      const movieTitle = btn.dataset.movieTitle || "Film";
      openRateModal(movieId, movieTitle);
      return;
    }

    const movieId = btn.dataset.movieId;
    const status = btn.dataset.status;
    if (!movieId || !status) return;

    const body = status === "favourite"
      ? { movieId, favourite: true }
      : { movieId, watchStatus: status };

    fetch("/set-watch-status", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      credentials: "same-origin"
    }).then(r => {
      if (r.status === 401) { window.location.href = "/admin"; return; }
      if (r.ok) {
        btn.classList.add("cqa-active");
        showQuickToast(status === "watched" ? "Dodano do obejrzanych" : status === "watchlist" ? "Dodano do listy Do obejrzenia" : "Dodano do ulubionych");
      }
    }).catch(() => {});
  });

  function openRateModal(movieId, title) {
    const modal = document.getElementById("rate-modal");
    if (!modal) return;
    document.getElementById("rate-modal-movie-id").value = movieId;
    document.getElementById("rate-modal-title").textContent = title;
    document.getElementById("rate-modal-rating").value = "0";
    document.getElementById("rate-modal-comment").value = "";
    document.querySelectorAll("#rate-modal-stars .star-pick").forEach(s => s.classList.remove("active"));
    modal.style.display = "block";
  }

  document.addEventListener("DOMContentLoaded", function() {
    const starsContainer = document.getElementById("rate-modal-stars");
    if (starsContainer) {
      starsContainer.addEventListener("click", function(e) {
        const star = e.target.closest(".star-pick");
        if (!star) return;
        const val = parseInt(star.dataset.val);
        document.getElementById("rate-modal-rating").value = val;
        document.querySelectorAll("#rate-modal-stars .star-pick").forEach((s, i) => {
          s.classList.toggle("active", i < val);
        });
      });
    }

    const closeBtn = document.getElementById("close-rate-modal");
    if (closeBtn) closeBtn.onclick = () => { document.getElementById("rate-modal").style.display = "none"; };

    window.addEventListener("click", function(e) {
      const modal = document.getElementById("rate-modal");
      if (modal && e.target === modal) modal.style.display = "none";
    });

    const form = document.getElementById("rate-modal-form");
    if (form) {
      form.addEventListener("submit", function(e) {
        e.preventDefault();
        const movieId = document.getElementById("rate-modal-movie-id").value;
        const rating = parseInt(document.getElementById("rate-modal-rating").value);
        const comment = document.getElementById("rate-modal-comment").value;
        if (!rating) { showQuickToast("Wybierz ocenę (1-5 gwiazdek)", "error"); return; }

        fetch("/add-rating", {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({ movieId, rating, comment }),
          credentials: "same-origin"
        }).then(r => {
          if (r.status === 401) { window.location.href = "/admin"; return; }
          if (r.ok) {
            document.getElementById("rate-modal").style.display = "none";
            showQuickToast("Ocena została zapisana");
          } else {
            showQuickToast("Błąd zapisu oceny", "error");
          }
        }).catch(() => showQuickToast("Błąd połączenia", "error"));
      });
    }
  });

  function showQuickToast(msg, type) {
    const t = document.createElement("div");
    t.className = "toast" + (type === "error" ? " toast-error" : " toast-success");
    t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(() => t.classList.add("toast-show"), 10);
    setTimeout(() => { t.classList.remove("toast-show"); setTimeout(() => t.remove(), 400); }, 3000);
  }
})();
