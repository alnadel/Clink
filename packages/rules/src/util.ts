/** A number from a list; the fallback only exists for `noUncheckedIndexedAccess`. */
export const at = (values: ArrayLike<number>, index: number): number => values[index] ?? 0;
