import { BadRequestException } from '@nestjs/common';
import { CashFlowGranularity } from './dto/dashboard-query.dto';
import { bucketLabel, cashFlowBuckets } from './cash-flow.util';

describe('cashFlowBuckets', () => {
  it('creates chronological zero-fill labels for every supported granularity', () => {
    expect(
      cashFlowBuckets('2026-08-01', '2026-08-03', CashFlowGranularity.DAY),
    ).toEqual(['2026-08-01', '2026-08-02', '2026-08-03']);
    expect(
      cashFlowBuckets('2026-08-01', '2026-08-10', CashFlowGranularity.WEEK),
    ).toEqual(['2026-07-27', '2026-08-03', '2026-08-10']);
    expect(bucketLabel('2026-08-31', CashFlowGranularity.MONTH)).toBe(
      '2026-08',
    );
  });

  it('rejects invalid and oversized ranges', () => {
    expect(() =>
      cashFlowBuckets('2026-08-02', '2026-08-01', CashFlowGranularity.DAY),
    ).toThrow(BadRequestException);
    expect(() =>
      cashFlowBuckets('2026-01-01', '2028-01-01', CashFlowGranularity.DAY),
    ).toThrow(BadRequestException);
  });
});
