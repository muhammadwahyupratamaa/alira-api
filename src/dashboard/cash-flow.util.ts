import { BadRequestException } from '@nestjs/common';
import { CashFlowGranularity } from './dto/dashboard-query.dto';
import { parseDateOnly } from '../transactions/transaction-date.util';

const MAX_DAYS = 730;

export function cashFlowBuckets(
  from: string,
  to: string,
  granularity: CashFlowGranularity,
): string[] {
  parseDateOnly(from);
  parseDateOnly(to);
  if (from > to) throw new BadRequestException('from must not be after to');
  const start = new Date(`${from}T00:00:00.000Z`);
  const end = new Date(`${to}T00:00:00.000Z`);
  const days = Math.floor((end.getTime() - start.getTime()) / 86_400_000) + 1;
  if (days > MAX_DAYS) throw new BadRequestException('Date range is too large');
  const labels: string[] = [];
  for (
    let current = new Date(start);
    current <= end;
    current.setUTCDate(current.getUTCDate() + 1)
  ) {
    const day = current.toISOString().slice(0, 10);
    const label =
      granularity === CashFlowGranularity.DAY
        ? day
        : granularity === CashFlowGranularity.MONTH
          ? day.slice(0, 7)
          : weekStart(day);
    if (labels.at(-1) !== label) labels.push(label);
  }
  return labels;
}

export function bucketLabel(
  date: string,
  granularity: CashFlowGranularity,
): string {
  if (granularity === CashFlowGranularity.DAY) return date;
  if (granularity === CashFlowGranularity.MONTH) return date.slice(0, 7);
  return weekStart(date);
}

function weekStart(date: string): string {
  const value = new Date(`${date}T00:00:00.000Z`);
  const offset = (value.getUTCDay() + 6) % 7;
  value.setUTCDate(value.getUTCDate() - offset);
  return value.toISOString().slice(0, 10);
}
