import { Pipe, PipeTransform } from '@angular/core';

/** Number first, code after — the way a price reads in Egypt. */
const CURRENCY_CODE = 'EGP';

/**
 * The API sends money as a string on purpose. Format it for display without ever
 * turning it into a number the app then does arithmetic on. Every price in the
 * app goes through here, so the currency lives in exactly one place.
 */
@Pipe({ name: 'price' })
export class PricePipe implements PipeTransform {
  transform(value: string | null | undefined): string {
    if (value === null || value === undefined || value === '') {
      return '—';
    }

    const parsed = Number(value);

    if (Number.isNaN(parsed)) {
      return value;
    }

    const formatted = parsed.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });

    return `${formatted} ${CURRENCY_CODE}`;
  }
}
