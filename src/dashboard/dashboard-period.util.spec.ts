import { dashboardPeriod } from './dashboard-period.util';

describe('dashboardPeriod', () => {
  it('uses the user timezone for defaults and UTC month boundaries', () => {
    const period = dashboardPeriod(
      'Asia/Jakarta',
      undefined,
      undefined,
      new Date('2026-08-31T17:30:00.000Z'),
    );
    expect(period).toEqual(expect.objectContaining({ month: 9, year: 2026 }));
    expect(period.start.toISOString()).toBe('2026-08-31T17:00:00.000Z');
    expect(period.end.toISOString()).toBe('2026-09-30T17:00:00.000Z');
    expect(period.previousStart.toISOString()).toBe('2026-07-31T17:00:00.000Z');
  });
});
