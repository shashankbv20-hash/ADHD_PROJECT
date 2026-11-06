const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateName(value: string): string | undefined {
  if (!value.trim()) {
    return "Enter your full name.";
  }

  if (value.trim().length < 2) {
    return "Enter at least two characters.";
  }

  if (value.trim().length > 120) {
    return "Keep the name to 120 characters or fewer.";
  }

  return undefined;
}

export function validateEmail(value: string): string | undefined {
  const email = value.trim();

  if (!email) {
    return "Enter your email address.";
  }

  if (!emailPattern.test(email)) {
    return "Enter a valid email address.";
  }

  return undefined;
}

export function validatePassword(
  value: string,
  minLength = 8,
): string | undefined {
  if (!value) {
    return "Enter your password.";
  }

  if (value.length < minLength) {
    return `Use at least ${minLength} characters.`;
  }

  return undefined;
}

export function validatePasswordConfirmation(
  password: string,
  confirmation: string,
): string | undefined {
  if (!confirmation) {
    return "Confirm your password.";
  }

  if (password !== confirmation) {
    return "Passwords do not match.";
  }

  return undefined;
}
