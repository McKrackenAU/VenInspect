/** Shared password rules for self-service change and admin set. */
export const MIN_PASSWORD_LENGTH = 8;

export function validateNewPassword(password: string): string | null {
  if (password.length < MIN_PASSWORD_LENGTH) {
    return `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`;
  }
  if (password.length > 200) {
    return "Password is too long.";
  }
  return null;
}
