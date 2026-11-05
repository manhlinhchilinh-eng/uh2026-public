import { describe, it, expect } from 'vitest';
import { modulesForRole } from '../config/modules';

describe('Ô liên kết cổng GV khảo sát khối 9', () => {
  const ids = (role: Parameters<typeof modulesForRole>[0]) => modulesForRole(role).map((m) => m.id);
  it('nhân sự thấy 3 cổng GV của portal khối 9', () => {
    for (const r of ['admin', 'gvcn', 'gvbm', 'tpt', 'giamthi'] as const) {
      expect(ids(r)).toEqual(expect.arrayContaining(['k9-homeroom', 'k9-analytics', 'k9-survey-scores']));
    }
  });
  it('PH/HS không thấy cổng GV', () => {
    for (const r of ['parent', 'student'] as const) expect(ids(r).filter((x) => x.startsWith('k9-'))).toEqual([]);
  });
});
