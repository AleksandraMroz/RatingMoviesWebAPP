document.addEventListener("DOMContentLoaded", function () {
  const passwordInput = document.getElementById("password");
  const passwordHint = document.getElementById("password-hint");
  const registerForm = document.getElementById("register-form");

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

  registerForm.addEventListener("submit", function (event) {
    if (
      passwordInput.value.length < 8 ||
      !/[A-Z]/.test(passwordInput.value) ||
      !/[0-9]/.test(passwordInput.value) ||
      !/[!@#$%^&*(),.?":{}|<>]/.test(passwordInput.value)
    ) {
      event.preventDefault();
      alert("Hasło nie spełnia wymagań bezpieczeństwa.");
    }
  });
});
