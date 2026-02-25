import { XMLParser } from 'fast-xml-parser';
import { parseStatus } from '../utils/status-parser.js';

const parser = new XMLParser({
  ignoreAttributes: false,
  trimValues: true,
  parseTagValue: false,
  isArray: (name) => ['Server', 'Net', 'Checkin'].includes(name),
});

export class NetLoggerApiError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'NetLoggerApiError';
    this.code = code;
  }
}

export function parseNetLoggerXml(xml) {
  const result = parser.parse(xml);
  const root = result.NetLoggerXML;

  if (!root) {
    throw new NetLoggerApiError(500, 'Invalid XML: missing NetLoggerXML root');
  }

  const header = root.Header;
  if (header?.Warning) {
    console.warn('[NetLogger API Warning]', header.Warning);
  }

  if (root.Error) {
    const code = parseInt(root.ResponseCode, 10) || 500;
    throw new NetLoggerApiError(code, root.Error);
  }

  return root;
}

export function parseActiveNets(xml) {
  const root = parseNetLoggerXml(xml);
  const serverList = root.ServerList;
  if (!serverList) return [];

  const code = serverList.ResponseCode;
  if (code && !code.startsWith('200')) {
    throw new NetLoggerApiError(parseInt(code, 10), code);
  }

  const servers = serverList.Server || [];
  const nets = [];

  for (const server of servers) {
    const serverNets = server.Net || [];
    for (const net of serverNets) {
      nets.push({
        serverName: server.ServerName,
        netName: net.NetName || '',
        altNetName: net.AltNetName || '',
        frequency: net.Frequency || '',
        logger: net.Logger || '',
        netControl: net.NetControl || '',
        date: net.Date || '',
        mode: net.Mode || '',
        band: net.Band || '',
        subscriberCount: parseInt(net.SubscriberCount, 10) || 0,
      });
    }
  }

  return nets;
}

export function parseCheckins(xml) {
  const root = parseNetLoggerXml(xml);
  const checkinList = root.CheckinList;
  if (!checkinList) return { checkins: [], pointer: 0, count: 0 };

  const code = checkinList.ResponseCode;
  if (code && !code.startsWith('200')) {
    throw new NetLoggerApiError(parseInt(code, 10), code);
  }

  const pointer = parseInt(checkinList.Pointer, 10) || 0;
  const count = parseInt(checkinList.CheckinCount, 10) || 0;
  const rawCheckins = checkinList.Checkin || [];

  const checkins = rawCheckins.map((c) => {
    const rawStatus = (c.Status || '').trim();
    const parsed = parseStatus(rawStatus);
    return {
      serialNo: parseInt(c.SerialNo, 10) || 0,
      callsign: (c.Callsign || '').trim(),
      state: (c.State || '').trim(),
      remarks: (c.Remarks || '').trim(),
      qslInfo: (c.QSLInfo || '').trim(),
      cityCountry: (c.CityCountry || '').trim(),
      firstName: (c.FirstName || '').trim(),
      status: rawStatus,
      statusType: parsed.type,
      statusLabel: parsed.label,
      county: (c.County || '').trim(),
      grid: (c.Grid || '').trim(),
      street: (c.Street || '').trim(),
      zip: (c.Zip || '').trim(),
      memberId: (c.MemberID || '').trim(),
      country: (c.Country || '').trim(),
      dxcc: (c.DXCC || '').trim(),
      preferredName: (c.PreferredName || '').trim(),
    };
  });

  return { checkins, pointer, count };
}

export function parsePastNets(xml) {
  const root = parseNetLoggerXml(xml);
  const serverList = root.ServerList;
  if (!serverList) return [];

  const code = serverList.ResponseCode;
  if (code && !code.startsWith('200')) {
    throw new NetLoggerApiError(parseInt(code, 10), code);
  }

  const servers = serverList.Server || [];
  const nets = [];

  for (const server of servers) {
    const serverNets = server.Net || [];
    for (const net of serverNets) {
      nets.push({
        serverName: server.ServerName,
        netId: net.NetID || '',
        netName: net.NetName || '',
        altNetName: net.AltNetName || '',
        frequency: net.Frequency || '',
        logger: net.Logger || '',
        netControl: net.NetControl || '',
        date: net.Date || '',
        mode: net.Mode || '',
        band: net.Band || '',
        aim: net.AIM || 'N',
        closedAt: net.ClosedAt || '',
      });
    }
  }

  return nets;
}
