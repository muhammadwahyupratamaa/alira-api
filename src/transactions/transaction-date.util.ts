import { BadRequestException } from '@nestjs/common';

const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

interface DateParts {
  year: number;
  month: number;
  day: number;
}

export function parseDateOnly(value: string): DateParts {
  const match = DATE_PATTERN.exec(value);
  if (!match) throw new BadRequestException('Date must use YYYY-MM-DD');
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const candidate = new Date(Date.UTC(year, month - 1, day));
  if (
    candidate.getUTCFullYear() !== year ||
    candidate.getUTCMonth() !== month - 1 ||
    candidate.getUTCDate() !== day
  ) {
    throw new BadRequestException('Date is invalid');
  }
  return { year, month, day };
}

export function todayInTimeZone(
  timeZone: string,
  now: Date = new Date(),
): string {
  return formatInTimeZone(now, timeZone);
}

export function dateOnlyToUtcStart(value: string, timeZone: string): Date {
  const parts = parseDateOnly(value);
  const targetUtc = Date.UTC(parts.year, parts.month - 1, parts.day);
  let instant = targetUtc;

  for (let iteration = 0; iteration < 2; iteration += 1) {
    const zoned = numericParts(new Date(instant), timeZone);
    const representedAsUtc = Date.UTC(
      zoned.year,
      zoned.month - 1,
      zoned.day,
      zoned.hour,
      zoned.minute,
      zoned.second,
    );
    instant = targetUtc - (representedAsUtc - instant);
  }

  return new Date(instant);
}

export function nextDateUtcStart(value: string, timeZone: string): Date {
  const parts = parseDateOnly(value);
  const next = new Date(Date.UTC(parts.year, parts.month - 1, parts.day + 1));
  const nextValue = [
    String(next.getUTCFullYear()).padStart(4, '0'),
    String(next.getUTCMonth() + 1).padStart(2, '0'),
    String(next.getUTCDate()).padStart(2, '0'),
  ].join('-');
  return dateOnlyToUtcStart(nextValue, timeZone);
}

export function assertNotFutureDate(
  value: string,
  timeZone: string,
  now: Date = new Date(),
): void {
  parseDateOnly(value);
  if (value > todayInTimeZone(timeZone, now)) {
    throw new BadRequestException('Future transaction dates are not allowed');
  }
}

export function formatInTimeZone(date: Date, timeZone: string): string {
  const parts = numericParts(date, timeZone);
  return [
    String(parts.year).padStart(4, '0'),
    String(parts.month).padStart(2, '0'),
    String(parts.day).padStart(2, '0'),
  ].join('-');
}

function numericParts(
  date: Date,
  timeZone: string,
): DateParts & {
  hour: number;
  minute: number;
  second: number;
} {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);
  const values = new Map(parts.map((part) => [part.type, part.value]));
  return {
    year: Number(values.get('year')),
    month: Number(values.get('month')),
    day: Number(values.get('day')),
    hour: Number(values.get('hour')),
    minute: Number(values.get('minute')),
    second: Number(values.get('second')),
  };
}
