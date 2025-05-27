Oczywiście! Możemy dodać walidację hasła na poziomie front-endu w pop-upie resetowania hasła, podobnie jak to zrobiliśmy przy rejestracji. Oto, jak to zrobić:

### Krok 1: Dodaj walidację do modala resetu hasła

W widoku `dashboard.ejs`, dodaj sekcję z informacją o wymaganiach dotyczących hasła:

```html
<div id="reset-password-modal" class="modal" style="display: none">
  <div class="modal-content">
    <span class="close" id="close-reset">&times;</span>
    <h2>Resetuj hasło</h2>
    <form id="reset-password-form" action="/reset-password" method="POST">
      <label for="new-password">Nowe hasło:</label>
      <input type="password" id="new-password" name="newPassword" required />
      <div id="password-hint" style="display: none; color: red; font-size: 0.9rem;">
        * Hasło powinno mieć co najmniej 8 znaków, zawierać wielkie litery, cyfry i znaki specjalne.
      </div>
      <button type="submit" id="confirm-reset-password">
        Zresetuj hasło
      </button>
    </form>
  </div>
</div>
```

### Krok 2: Dodaj JavaScript do walidacji

Zaktualizuj `dashboard.js`, aby dodać walidację podobną do tej przy rejestracji:

```javascript
document.addEventListener("DOMContentLoaded", function() {
  const resetPasswordBtn = document.getElementById("reset-password-btn");
  const deleteAccountBtn = document.getElementById("delete-account-btn");
  const resetPasswordModal = document.getElementById("reset-password-modal");
  const deleteAccountModal = document.getElementById("delete-account-modal");

  const closeReset = document.getElementById("close-reset");
  const closeDelete = document.getElementById("close-delete");
  const confirmDeleteAccount = document.getElementById("confirm-delete-account");
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

  document.getElementById("reset-password-form").addEventListener("submit", function(e) {
    e.preventDefault();

    if (passwordInput.value.length < 8 || 
        !/[A-Z]/.test(passwordInput.value) || 
        !/[0-9]/.test(passwordInput.value) || 
        !/[!@#$%^&*(),.?":{}|<>]/.test(passwordInput.value)) 
    {
      passwordHint.style.display = "block";
      passwordInput.style.border = "1px solid red";
      return;
    }

    const formData = new FormData(this);
    fetch("/reset-password", {
      method: "POST",
      body: new URLSearchParams(formData),
      headers: {
        "Content-Type": "application/x-www-form-urlencoded"
      }
    }).then(response => {
      if (response.ok) {
        alert("Hasło zostało zmienione.");
        resetPasswordModal.style.display = "none";
      } else {
        alert("Błąd przy zmianie hasła.");
      }
    });
  });

  passwordInput.addEventListener("input", function() {
    if (this.value.length < 8 || 
        !/[A-Z]/.test(this.value) || 
        !/[0-9]/.test(this.value) || 
        !/[!@#$%^&*(),.?":{}|<>]/.test(this.value)) 
    {
      passwordHint.style.display = "block";
      this.style.border = "1px solid red";
    } else {
      passwordHint.style.display = "none";
      this.style.border = "1px solid #ccc";
    }
  });

  confirmDeleteAccount.onclick = function () {
    fetch("/delete-account", {
      method: "POST"
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
```

### Podsumowanie

Te zmiany dodadzą walidację dla nowego hasła w modalu resetu hasła. Użytkownik otrzyma wskazówkę dotyczącą minimalnych wymagań bezpieczeństwa hasła, a błędne wprowadzenia zostaną zweryfikowane przed przesłaniem. To pomoże zapewnić, że nowe hasło będzie bezpieczne, podobnie jak przy rejestracji.
