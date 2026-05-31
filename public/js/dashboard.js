document.addEventListener("DOMContentLoaded", function () {
  // === Modals ===
  const resetPasswordBtn = document.getElementById("reset-password-btn");
  const deleteAccountBtn = document.getElementById("delete-account-btn");
  const resetPasswordModal = document.getElementById("reset-password-modal");
  const deleteAccountModal = document.getElementById("delete-account-modal");
  const closeReset = document.getElementById("close-reset");
  const closeDelete = document.getElementById("close-delete");
  const confirmDeleteAccount = document.getElementById("confirm-delete-account");
  const passwordInput = document.getElementById("new-password");

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
        alert("Hasło zostało zmienione.");
        resetPasswordModal.style.display = "none";
      } else {
        alert("Błąd przy zmianie hasła.");
      }
    });
  });

  confirmDeleteAccount.onclick = function () {
    fetch("/delete-account", { method: "POST" }).then((response) => {
      if (response.ok) {
        alert("Konto zostało usunięte.");
        window.location.href = "/";
      } else {
        alert("Błąd przy usuwaniu konta.");
      }
    });
  };

  window.onclick = function (event) {
    if (event.target == resetPasswordModal) resetPasswordModal.style.display = "none";
    if (event.target == deleteAccountModal) deleteAccountModal.style.display = "none";
  };

  // === Zakładki ===
  const tabBtns = document.querySelectorAll(".tab-btn");
  const tabContents = document.querySelectorAll(".tab-content");

  tabBtns.forEach(btn => {
    btn.addEventListener("click", () => {
      tabBtns.forEach(b => b.classList.remove("active"));
      tabContents.forEach(c => c.classList.remove("active"));
      btn.classList.add("active");
      document.getElementById(`tab-${btn.dataset.tab}`).classList.add("active");
    });
  });
});
