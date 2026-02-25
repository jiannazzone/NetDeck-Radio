import { describe, it, expect } from 'vitest';
import { matchPattern } from '../router.js';

describe('matchPattern', () => {
  it('matches root path', () => {
    expect(matchPattern('/', '/')).toEqual({});
  });

  it('returns null for non-matching static path', () => {
    expect(matchPattern('/past', '/other')).toBeNull();
  });

  it('matches static path', () => {
    expect(matchPattern('/past', '/past')).toEqual({});
  });

  it('extracts single param', () => {
    expect(matchPattern('/user/:id', '/user/42')).toEqual({ id: '42' });
  });

  it('extracts multiple params from net detail route', () => {
    expect(matchPattern('/net/:serverName/:netName', '/net/NETLOGGER/MyNet')).toEqual({
      serverName: 'NETLOGGER',
      netName: 'MyNet',
    });
  });

  it('extracts params from past net detail route', () => {
    expect(matchPattern('/past/:serverName/:netName/:netId', '/past/NETLOGGER2/TestNet/12345')).toEqual({
      serverName: 'NETLOGGER2',
      netName: 'TestNet',
      netId: '12345',
    });
  });

  it('decodes URI-encoded params', () => {
    expect(matchPattern('/net/:serverName/:netName', '/net/NETLOGGER/My%20Net')).toEqual({
      serverName: 'NETLOGGER',
      netName: 'My Net',
    });
  });

  it('returns null when segment count differs', () => {
    expect(matchPattern('/net/:serverName/:netName', '/net/NETLOGGER')).toBeNull();
  });

  it('returns null when too many segments', () => {
    expect(matchPattern('/net/:serverName/:netName', '/net/A/B/C')).toBeNull();
  });

  it('returns null when static segment mismatches', () => {
    expect(matchPattern('/net/:serverName/:netName', '/past/NETLOGGER/MyNet')).toBeNull();
  });

  it('returns null for empty segments (filter removes them)', () => {
    // filter(Boolean) removes empty strings, so '/net//' has 1 segment ('net')
    expect(matchPattern('/net/:serverName/:netName', '/net//')).toBeNull();
  });
});
