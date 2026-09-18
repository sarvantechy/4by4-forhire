export function isPositiveMinorUnitAmount(value: number): boolean {
  return Number.isSafeInteger(value) && value > 0;
}

export function isIndianMobileNumber(value: string): boolean {
  return /^\+91[6-9]\d{9}$/.test(value);
}
