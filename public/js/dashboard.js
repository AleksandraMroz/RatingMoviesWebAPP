document.addEventListener("DOMContentLoaded", function () {
  const resetPasswordBtn = document.getElementById("reset-password-btn");
  const deleteAccountBtn = document.getElementById("delete-account-btn");
  const resetPasswordModal = document.getElementById("reset-password-modal");
  const deleteAccountModal = document.getElementById("delete-account-modal");

  const closeReset = document.getElementById("close-reset");
  const closeDelete = document.getElementById("close-delete");
  const confirmDeleteAccount = document.getElementById(
    "confirm-delete-account"
  );
  const passwordInput = document.getElementById("new-password");
  const passwordHint = document.getElementById("password-hint");

  resetPasswordBtn.onclick = function () {
    resetPasswordModal.style.display = "block";
  };

  deleteAccountBtn.onclick = function () {
    deleteAccountModal.style.display = "block";
  };

  closeReset.onclick = function () {
    resetPasswordModal.style.display = "none";
  };

  closeDelete.onclick = function () {
    deleteAccountModal.style.display = "none";
  };

  document
    .getElementById("reset-password-form")
    .addEventListener("submit", function (e) {
      e.preventDefault();

      if (
        passwordInput.value.length < 8 ||
        !/[A-Z]/.test(passwordInput.value) ||
        !/[0-9]/.test(passwordInput.value) ||
        !/[!@#$%^&*(),.?":{}|<>]/.test(passwordInput.value)
      ) {
        passwordHint.style.display = "block";
        passwordInput.style.border = "1px solid red";
        return;
      }

      const formData = new FormData(this);
      fetch("/reset-password", {
        method: "POST",
        body: new URLSearchParams(formData),
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
      }).then((response) => {
        if (response.ok) {
          alert("Hasło zostało zmienione.");
          resetPasswordModal.style.display = "none";
        } else {
          alert("Błąd przy zmianie hasła.");
        }
      });
    });

  passwordInput.addEventListener("input", function () {
    if (
      this.value.length < 8 ||
      !/[A-Z]/.test(this.value) ||
      !/[0-9]/.test(this.value) ||
      !/[!@#$%^&*(),.?":{}|<>]/.test(this.value)
    ) {
      passwordHint.style.display = "block";
      this.style.border = "1px solid red";
    } else {
      passwordHint.style.display = "none";
      this.style.border = "1px solid #ccc";
    }
  });

  confirmDeleteAccount.onclick = function () {
    fetch("/delete-account", {
      method: "POST",
    }).then((response) => {
      if (response.ok) {
        alert("Konto zostało usunięte.");
        window.location.href = "/";
      } else {
        alert("Błąd przy usuwaniu konta.");
      }
    });
  };

  window.onclick = function (event) {
    if (event.target == resetPasswordModal) {
      resetPasswordModal.style.display = "none";
    }
    if (event.target == deleteAccountModal) {
      deleteAccountModal.style.display = "none";
    }
  };
});
