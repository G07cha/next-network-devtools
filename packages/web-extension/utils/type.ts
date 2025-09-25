export const assertType = <T>(value: T): T => value;

export const isTruthy = <T>(value: T | null | undefined | "" | 0): value is T =>
	Boolean(value);
