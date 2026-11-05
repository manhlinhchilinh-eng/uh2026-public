/**
 * Assertion utilities for E2E Tests
 */
import assert from 'node:assert';

export function assertWithinBounds(val: number, min: number, max: number, message?: string): void {
  assert(
    val >= min && val <= max,
    message || `Expected ${val} to be between ${min} and ${max}`
  );
}

export function assertThrowsContractError(
  fn: () => unknown,
  expectedCodeOrSubstring: string,
  message?: string
): void {
  let threw = false;
  try {
    fn();
  } catch (err: any) {
    threw = true;
    const errText = (err.message || String(err));
    assert(
      errText.includes(expectedCodeOrSubstring),
      message || `Expected error containing "${expectedCodeOrSubstring}", but got "${errText}"`
    );
  }
  assert(threw, message || `Expected function to throw error containing "${expectedCodeOrSubstring}", but it succeeded.`);
}

export function assertValidScoreSum(
  learning: number,
  discipline: number,
  hygiene: number,
  custom: number,
  total: number
): void {
  const calculated = Math.round((learning + discipline + hygiene + custom) * 100) / 100;
  assert.strictEqual(
    total,
    calculated,
    `Period total score mismatch: sum(${learning}, ${discipline}, ${hygiene}, ${custom}) = ${calculated}, got ${total}`
  );
  assert(total <= 10.0, `Period total score ${total} exceeds maximum 10.0`);
  assert(total >= 0.0, `Period total score ${total} cannot be negative`);
}
