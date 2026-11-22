import { ReachBellError } from "./error";

/**
 * Argument checks for resource methods. They throw ReachBellError (status 0,
 * body null) so that, inside the async methods, bad input rejects with the
 * same error type as every other failure.
 */
export function invalidArgument(method: string, message: string): ReachBellError {
  return new ReachBellError(`ReachBell: ${method} ${message}`, 0, null);
}

export function requireObject(value: unknown, method: string, name = "params"): void {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw invalidArgument(method, `expects ${name} to be an object, got ${describe(value)}`);
  }
}

export function requireArray(value: unknown, method: string, name: string): asserts value is unknown[] {
  if (!Array.isArray(value)) throw invalidArgument(method, `expects ${name} to be an array, got ${describe(value)}`);
}

export function requireString(value: unknown, method: string, name: string): void {
  if (typeof value !== "string" || !value.trim()) {
    throw invalidArgument(method, `expects ${name} to be a non-empty string, got ${describe(value)}`);
  }
}

/**
 * Largest accepted timeout: AbortSignal.timeout() takes a 32-bit signed
 * millisecond delay (about 24.8 days); larger values throw or fire at once.
 */
export const MAX_TIMEOUT_MS = 2_147_483_647;

/** Describes the accepted range, for error messages. */
export const TIMEOUT_RANGE = `a finite number of milliseconds greater than 0 and at most ${MAX_TIMEOUT_MS}`;

/** Whether `value` is a usable timeout: a finite number of milliseconds in (0, MAX_TIMEOUT_MS]. */
export function isValidTimeout(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0 && value <= MAX_TIMEOUT_MS;
}

export function describe(value: unknown): string {
  if (value === null) return "null";
  if (Array.isArray(value)) return "an array";
  if (typeof value === "string") return value.trim() ? "a string" : "an empty string";
  return typeof value;
}
