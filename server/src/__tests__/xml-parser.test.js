import { describe, it, expect } from 'vitest';
import { parseActiveNets, parseCheckins, parsePastNets, NetLoggerApiError } from '../services/xml-parser.js';

const wrapXml = (body) => `<?xml version="1.0" encoding="UTF-8"?>
<NetLoggerXML>
  <Header>
    <CreationDateUTC>2024-01-01 00:00:00</CreationDateUTC>
    <Copyright>NetLogger.org</Copyright>
    <APIVersion>1.3</APIVersion>
    <TimeZone>UTC</TimeZone>
  </Header>
  ${body}
</NetLoggerXML>`;

describe('parseActiveNets', () => {
  it('parses valid XML with nets', () => {
    const xml = wrapXml(`
      <ServerList>
        <ResponseCode>200 OK</ResponseCode>
        <Server>
          <ServerName>NETLOGGER</ServerName>
          <Net>
            <NetName>Test Net</NetName>
            <Frequency>14.300</Frequency>
            <Mode>SSB</Mode>
            <Band>20M</Band>
            <NetControl>W1AW</NetControl>
            <Logger>K1ABC</Logger>
            <SubscriberCount>5</SubscriberCount>
            <Date>2024-01-01 12:00:00</Date>
          </Net>
        </Server>
      </ServerList>
    `);

    const nets = parseActiveNets(xml);
    expect(nets).toHaveLength(1);
    expect(nets[0]).toEqual({
      serverName: 'NETLOGGER',
      netName: 'Test Net',
      altNetName: '',
      frequency: '14.300',
      logger: 'K1ABC',
      netControl: 'W1AW',
      date: '2024-01-01 12:00:00',
      mode: 'SSB',
      band: '20M',
      subscriberCount: 5,
    });
  });

  it('returns empty array for empty ServerList', () => {
    const xml = wrapXml(`
      <ServerList>
        <ResponseCode>200 OK</ResponseCode>
      </ServerList>
    `);
    expect(parseActiveNets(xml)).toEqual([]);
  });

  it('returns empty array for missing ServerList', () => {
    const xml = wrapXml('');
    expect(parseActiveNets(xml)).toEqual([]);
  });

  it('throws NetLoggerApiError on error response', () => {
    const xml = wrapXml(`
      <Error>Bad Request</Error>
      <ResponseCode>400</ResponseCode>
    `);
    expect(() => parseActiveNets(xml)).toThrow(NetLoggerApiError);
  });

  it('handles multiple servers with multiple nets', () => {
    const xml = wrapXml(`
      <ServerList>
        <ResponseCode>200 OK</ResponseCode>
        <Server>
          <ServerName>NETLOGGER</ServerName>
          <Net><NetName>Net A</NetName></Net>
          <Net><NetName>Net B</NetName></Net>
        </Server>
        <Server>
          <ServerName>NETLOGGER2</ServerName>
          <Net><NetName>Net C</NetName></Net>
        </Server>
      </ServerList>
    `);

    const nets = parseActiveNets(xml);
    expect(nets).toHaveLength(3);
    expect(nets[0].serverName).toBe('NETLOGGER');
    expect(nets[0].netName).toBe('Net A');
    expect(nets[1].netName).toBe('Net B');
    expect(nets[2].serverName).toBe('NETLOGGER2');
    expect(nets[2].netName).toBe('Net C');
  });
});

describe('parseCheckins', () => {
  it('parses valid XML with checkins', () => {
    const xml = wrapXml(`
      <CheckinList>
        <ResponseCode>200 OK</ResponseCode>
        <CheckinCount>2</CheckinCount>
        <Pointer>1</Pointer>
        <Checkin>
          <SerialNo>1</SerialNo>
          <Callsign>W1AW</Callsign>
          <FirstName>John</FirstName>
          <PreferredName>Johnny</PreferredName>
          <State>CT</State>
          <CityCountry>Newington</CityCountry>
          <Country>US</Country>
          <Grid>FN31</Grid>
          <Status>(nc)</Status>
          <Remarks>Net control station</Remarks>
          <MemberID>12345</MemberID>
          <Zip>06111</Zip>
        </Checkin>
        <Checkin>
          <SerialNo>2</SerialNo>
          <Callsign>K1ABC</Callsign>
          <Status></Status>
        </Checkin>
      </CheckinList>
    `);

    const result = parseCheckins(xml);
    expect(result.count).toBe(2);
    expect(result.pointer).toBe(1);
    expect(result.checkins).toHaveLength(2);

    const first = result.checkins[0];
    expect(first.callsign).toBe('W1AW');
    expect(first.preferredName).toBe('Johnny');
    expect(first.statusType).toBe('net-control');
    expect(first.statusLabel).toBe('Net Control');
    expect(first.grid).toBe('FN31');
  });

  it('returns empty result for empty checkins', () => {
    const xml = wrapXml(`
      <CheckinList>
        <ResponseCode>200 OK</ResponseCode>
        <CheckinCount>0</CheckinCount>
        <Pointer>0</Pointer>
      </CheckinList>
    `);

    const result = parseCheckins(xml);
    expect(result).toEqual({ checkins: [], pointer: 0, count: 0 });
  });

  it('returns empty result for missing CheckinList', () => {
    const xml = wrapXml('');
    expect(parseCheckins(xml)).toEqual({ checkins: [], pointer: 0, count: 0 });
  });

  it('preserves numeric strings (MemberID, Zip) as strings', () => {
    const xml = wrapXml(`
      <CheckinList>
        <ResponseCode>200 OK</ResponseCode>
        <CheckinCount>1</CheckinCount>
        <Pointer>0</Pointer>
        <Checkin>
          <SerialNo>1</SerialNo>
          <Callsign>W1AW</Callsign>
          <MemberID>00123</MemberID>
          <Zip>06111</Zip>
        </Checkin>
      </CheckinList>
    `);

    const result = parseCheckins(xml);
    expect(typeof result.checkins[0].memberId).toBe('string');
    expect(result.checkins[0].memberId).toBe('00123');
    expect(typeof result.checkins[0].zip).toBe('string');
    expect(result.checkins[0].zip).toBe('06111');
  });

  it('parses status codes on checkins', () => {
    const xml = wrapXml(`
      <CheckinList>
        <ResponseCode>200 OK</ResponseCode>
        <CheckinCount>1</CheckinCount>
        <Pointer>0</Pointer>
        <Checkin>
          <SerialNo>1</SerialNo>
          <Callsign>W1AW</Callsign>
          <Status>(vip)</Status>
        </Checkin>
      </CheckinList>
    `);

    const result = parseCheckins(xml);
    expect(result.checkins[0].statusType).toBe('vip');
    expect(result.checkins[0].statusLabel).toBe('VIP');
  });
});

describe('parsePastNets', () => {
  it('parses valid past nets XML', () => {
    const xml = wrapXml(`
      <ServerList>
        <ResponseCode>200 OK</ResponseCode>
        <Server>
          <ServerName>NETLOGGER</ServerName>
          <Net>
            <NetID>999</NetID>
            <NetName>Past Net</NetName>
            <Frequency>7.200</Frequency>
            <Mode>SSB</Mode>
            <Band>40M</Band>
            <NetControl>W1AW</NetControl>
            <Logger>K1ABC</Logger>
            <Date>2024-01-01 12:00:00</Date>
            <AIM>N</AIM>
            <ClosedAt>2024-01-01 14:00:00</ClosedAt>
          </Net>
        </Server>
      </ServerList>
    `);

    const nets = parsePastNets(xml);
    expect(nets).toHaveLength(1);
    expect(nets[0].netId).toBe('999');
    expect(nets[0].netName).toBe('Past Net');
    expect(nets[0].closedAt).toBe('2024-01-01 14:00:00');
    expect(nets[0].aim).toBe('N');
  });

  it('returns empty array for empty ServerList', () => {
    const xml = wrapXml(`
      <ServerList>
        <ResponseCode>200 OK</ResponseCode>
      </ServerList>
    `);
    expect(parsePastNets(xml)).toEqual([]);
  });
});
