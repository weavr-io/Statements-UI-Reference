import type { CurrencyAmount } from './api/types';

/* ISO 4217 minor-unit exponents. Defaults to 2 for currencies not listed.
 * Extend this map if you handle currencies with non-2 minor units (e.g. JPY=0, BHD=3). */
const MINOR_UNIT_EXPONENT: Record<string, number> = {
  JPY: 0,
  KRW: 0,
  BHD: 3,
  KWD: 3,
  OMR: 3,
  TND: 3,
};

function minorUnitExponent(currency: string): number {
  return MINOR_UNIT_EXPONENT[currency] ?? 2;
}

export function formatMoney(amount: CurrencyAmount): string {
  const exp = minorUnitExponent(amount.currency);
  const value = amount.amount / 10 ** exp;
  const formatter = new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency: amount.currency,
    minimumFractionDigits: exp,
    maximumFractionDigits: exp,
  });
  return formatter.format(value);
}

export function formatTimestamp(epochMillis: number): string {
  return new Date(epochMillis).toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatDate(epochMillis: number): string {
  return new Date(epochMillis).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
  });
}
