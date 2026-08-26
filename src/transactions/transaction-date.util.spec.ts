import { BadRequestException } from '@nestjs/common';
import {
  assertNotFutureDate,
  dateOnlyToUtcStart,
  formatInTimeZone,
  nextDateUtcStart,
  todayInTimeZone,
} from './transaction-date.util';

describe('transaction date utilities', () => {
  const timeZone = 'Asia/Jakarta';

  it('converts a local financial date to UTC and back', () => {
    const utc = dateOnlyToUtcStart('2026-08-26', timeZone);

    expect(utc.toISOString()).toBe('2026-08-25T17:00:00.000Z');
    expect(formatInTimeZone(utc, timeZone)).toBe('2026-08-26');
    expect(nextDateUtcStart('2026-08-26', timeZone).toISOString()).toBe(
      '2026-08-26T17:00:00.000Z',
    );
  });

  it('uses the user timezone when determining today', () => {
    const now = new Date('2026-08-25T18:00:00.000Z');
    expect(todayInTimeZone(timeZone, now)).toBe('2026-08-26');
  });

  it('rejects invalid and future financial dates', () => {
    const now = new Date('2026-08-25T18:00:00.000Z');
    expect(() => assertNotFutureDate('2026-08-27', timeZone, now)).toThrow(
      BadRequestException,
    );
    expect(() => dateOnlyToUtcStart('2026-02-30', timeZone)).toThrow(
      BadRequestException,
    );
  });
});
