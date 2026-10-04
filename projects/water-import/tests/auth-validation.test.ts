import assert from "node:assert/strict";
import test from "node:test";
import { passwordStrength, validatePassword, validateUsername } from "../src/game/authValidation";

test("registration username hints match the API length and character rules", () => {
  assert.equal(validateUsername("  Рыбак_27  "), null);
  assert.match(validateUsername("ab") ?? "", /3 до 24/);
  assert.match(validateUsername("a".repeat(25)) ?? "", /3 до 24/);
  assert.match(validateUsername("bad name") ?? "", /Допустимы/);
});

test("registration password hints match the API limits and composition", () => {
  assert.equal(validatePassword("Voda2024"), null);
  assert.match(validatePassword("short1") ?? "", /8 символов/);
  assert.match(validatePassword("x".repeat(129)) ?? "", /длинный/);
  assert.match(validatePassword("12345678") ?? "", /цифры/);
  // Сервер требует цифру и любой нецифровой символ, не обязательно букву.
  assert.equal(validatePassword("!!!!!!!1"), null);
});

test("password strength is empty-safe and capped at three", () => {
  assert.equal(passwordStrength(""), 0);
  assert.equal(passwordStrength("a"), 1);
  assert.equal(passwordStrength("Voda2024"), 2);
  assert.equal(passwordStrength("Voda2024!Long"), 3);
});
