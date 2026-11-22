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

/** Whether `value` is a usable timeout: a finite number of milliseconds greater than 0. */
export function isValidTimeout(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

export function describe(value: unknown): string {
  if (value === null) return "null";
  if (Array.isArray(value)) return "an array";
  if (typeof value === "string") return value.trim() ? "a string" : "an empty string";
  return typeof value;
}
