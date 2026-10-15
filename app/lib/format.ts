/**
 * Formats a numeric financial value to strictly two decimal places
 * per GEMINI.md mandate.
 */
export function formatCurrency(val: number): string {
  if (typeof val !== 'number' || !Number.isFinite(val)) {
    return '0.00';
  }
  return val.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/**
 * Parses a YYYY-MM-DD string as local midnight rather than UTC midnight
 * so negative UTC offsets never shift the displayed calendar date.
 */
export function parseLocalDate(dateStr: string): Date {
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    const [year, month, day] = dateStr.split('-').map(Number);
    return new Date(year, month - 1, day);
  }
  return new Date(dateStr);
}
