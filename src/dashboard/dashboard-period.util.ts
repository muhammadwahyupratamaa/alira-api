import {
  dateOnlyToUtcStart,
  formatInTimeZone,
} from '../transactions/transaction-date.util';

export interface DashboardPeriod {
  month: number;
  year: number;
  start: Date;
  end: Date;
  previousStart: Date;
  previousEnd: Date;
}

export function dashboardPeriod(
  timeZone: string,
  month?: number,
  year?: number,
  now: Date = new Date(),
): DashboardPeriod {
  const current = formatInTimeZone(now, timeZone).split('-').map(Number);
  const selectedMonth = month ?? current[1]!;
  const selectedYear = year ?? current[0]!;
  const startValue = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}-01`;
  const next = new Date(Date.UTC(selectedYear, selectedMonth, 1));
  const endValue = `${next.getUTCFullYear()}-${String(next.getUTCMonth() + 1).padStart(2, '0')}-01`;
  const previous = new Date(Date.UTC(selectedYear, selectedMonth - 2, 1));
  const previousValue = `${previous.getUTCFullYear()}-${String(previous.getUTCMonth() + 1).padStart(2, '0')}-01`;
  const start = dateOnlyToUtcStart(startValue, timeZone);
  return {
    month: selectedMonth,
    year: selectedYear,
    start,
    end: dateOnlyToUtcStart(endValue, timeZone),
    previousStart: dateOnlyToUtcStart(previousValue, timeZone),
    previousEnd: start,
  };
}
