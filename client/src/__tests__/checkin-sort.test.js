import { describe, it, expect } from 'vitest';
import { SORTABLE_COLUMNS, sortCheckins } from '../utils/checkin-sort.js';

function makeCheckin(overrides = {}) {
  return {
    serialNo: 1,
    callsign: 'W1AW',
    preferredName: '',
    firstName: 'Hiram',
    statusLabel: 'Checked In',
    cityCountry: 'Newington',
    state: 'CT',
    country: 'US',
    grid: 'FN31',
    ...overrides,
  };
}

describe('SORTABLE_COLUMNS', () => {
  it('has 7 columns', () => {
    expect(SORTABLE_COLUMNS).toHaveLength(7);
  });

  it('has expected keys', () => {
    const keys = SORTABLE_COLUMNS.map((c) => c.key);
    expect(keys).toEqual(['serialNo', 'callsign', 'name', 'status', 'location', 'grid', 'dxcc']);
  });
});

describe('sortCheckins', () => {
  const checkins = [
    makeCheckin({ serialNo: 3, callsign: 'N0CALL', firstName: 'Zach', grid: 'EM48' }),
    makeCheckin({ serialNo: 1, callsign: 'W1AW', firstName: 'Adam', grid: 'FN31' }),
    makeCheckin({ serialNo: 2, callsign: 'K5ABC', firstName: 'Mike', grid: 'DM79' }),
  ];

  it('sorts by serialNo ascending', () => {
    const sorted = sortCheckins(checkins, 'serialNo', 'asc');
    expect(sorted.map((c) => c.serialNo)).toEqual([1, 2, 3]);
  });

  it('sorts by serialNo descending', () => {
    const sorted = sortCheckins(checkins, 'serialNo', 'desc');
    expect(sorted.map((c) => c.serialNo)).toEqual([3, 2, 1]);
  });

  it('sorts by callsign ascending', () => {
    const sorted = sortCheckins(checkins, 'callsign', 'asc');
    expect(sorted.map((c) => c.callsign)).toEqual(['K5ABC', 'N0CALL', 'W1AW']);
  });

  it('sorts by callsign descending', () => {
    const sorted = sortCheckins(checkins, 'callsign', 'desc');
    expect(sorted.map((c) => c.callsign)).toEqual(['W1AW', 'N0CALL', 'K5ABC']);
  });

  it('sorts by name ascending (uses firstName when preferredName empty)', () => {
    const sorted = sortCheckins(checkins, 'name', 'asc');
    expect(sorted.map((c) => c.firstName)).toEqual(['Adam', 'Mike', 'Zach']);
  });

  it('sorts by grid ascending', () => {
    const sorted = sortCheckins(checkins, 'grid', 'asc');
    expect(sorted.map((c) => c.grid)).toEqual(['DM79', 'EM48', 'FN31']);
  });

  it('returns original order for unknown column', () => {
    const sorted = sortCheckins(checkins, 'unknown', 'asc');
    expect(sorted.map((c) => c.serialNo)).toEqual([3, 1, 2]);
  });

  it('does not mutate original array', () => {
    const original = [...checkins];
    sortCheckins(checkins, 'serialNo', 'asc');
    expect(checkins.map((c) => c.serialNo)).toEqual(original.map((c) => c.serialNo));
  });

  it('handles missing values gracefully', () => {
    const withMissing = [
      makeCheckin({ serialNo: 1, grid: '' }),
      makeCheckin({ serialNo: 2, grid: 'FN31' }),
      makeCheckin({ serialNo: 3, grid: null }),
    ];
    const sorted = sortCheckins(withMissing, 'grid', 'asc');
    // Empty strings sort first
    expect(sorted[0].grid).toBeFalsy();
    expect(sorted[sorted.length - 1].grid).toBe('FN31');
  });
});
