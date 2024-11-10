function checkPasswordMatch() {
    const password = document.getElementById("password").value;
    const confirmPassword = document.getElementById("confirmpassword").value;
    const message = document.getElementById("message");
    const strengthMessage = document.getElementById("strengthMessage");

    // Check if passwords match
    if (password === confirmPassword) {
        message.textContent = "Passwords match!";
        message.className = "match";
    } else {
        message.textContent = "Passwords do not match.";
        message.className = "mismatch";
    }

    // Check password strength
    if (password.length < 8) {
        strengthMessage.textContent = "Password must be at least 8 characters.";
        strengthMessage.className = "mismatch";
    } else {
        // Check strength based on character variety
        let strength = 0;
        if (/[a-z]/.test(password)) strength++; // Lowercase
        if (/[A-Z]/.test(password)) strength++; // Uppercase
        if (/[0-9]/.test(password)) strength++; // Numbers
        if (/[^a-zA-Z0-9]/.test(password)) strength++; // Special characters

        // Display strength message
        if (strength < 2) {
            strengthMessage.textContent = "Password strength: Weak";
            strengthMessage.className = "weak";
        } else if (strength === 2 || strength === 3) {
            strengthMessage.textContent = "Password strength: Medium";
            strengthMessage.className = "medium";
        } else {
            strengthMessage.textContent = "Password strength: Strong";
            strengthMessage.className = "strong";
        }
    }
}
