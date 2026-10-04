/**
 * Клиентские подсказки по базовым ограничениям регистрации.
 * API выполняет окончательную проверку, включая серверный фильтр имени.
 */
export function validateUsername(username: string): string | null {
  const value = username.trim();
  if (value.length < 3 || value.length > 24) return "Имя пользователя — от 3 до 24 символов";
  if (!/^[\p{L}\p{N}_.-]+$/u.test(value)) {
    return "Допустимы буквы, цифры, точка, дефис и подчёркивание";
  }
  return null;
}

export function validatePassword(password: string): string | null {
  if (password.length < 8) return "Пароль — не короче 8 символов";
  if (password.length > 128) return "Слишком длинный пароль";
  if (!/[^\d]/.test(password) || !/\d/.test(password)) {
    return "Пароль должен содержать буквы и цифры";
  }
  return null;
}

export function passwordStrength(password: string): 0 | 1 | 2 | 3 {
  if (!password) return 0;
  let score = 0;
  if (password.length >= 8) score++;
  if (/[^\d]/.test(password) && /\d/.test(password)) score++;
  if (password.length >= 12 || /[^\p{L}\p{N}]/u.test(password)) score++;
  return Math.max(1, score) as 1 | 2 | 3;
}
