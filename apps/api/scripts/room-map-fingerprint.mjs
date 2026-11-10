import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';

const expectedCounts = Object.freeze({ AC1: 1, AC2: 2, AC3: 1, RM1: 5, RM2: 42, RM3: 8, SU1: 1 });

export function roomMapFingerprint(rooms) {
  if (!Array.isArray(rooms) || rooms.length !== 60) throw new Error('Exactly 60 room mappings are required');
  const seen = new Set();
  const counts = Object.fromEntries(Object.keys(expectedCounts).map(type => [type, 0]));
  for (const room of rooms) {
    if (!room || typeof room.number !== 'string' || !/^\d{3}$/.test(room.number) || seen.has(room.number)) throw new Error('Room numbers must be unique three-digit strings');
    if (!Number.isInteger(room.floor) || ![1, 2].includes(room.floor) || Number(room.number[0]) !== room.floor) throw new Error(`Verify the floor for room ${room.number}`);
    if (!Object.hasOwn(expectedCounts, room.roomType)) throw new Error(`Unsupported room type for room ${room.number}`);
    seen.add(room.number);
    counts[room.roomType] += 1;
  }
  for (const [type, expected] of Object.entries(expectedCounts)) if (counts[type] !== expected) throw new Error(`Room type totals must match the approved inventory (${type}: ${expected})`);
  const canonical = rooms.map(r => `${r.number},${r.roomType},${r.floor}`).sort().join('\n');
  return createHash('sha256').update(canonical, 'utf8').digest('hex');
}

function parseCsv(text) {
  const rows = []; let row = []; let cell = ''; let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"') { if (quoted && text[i + 1] === '"') { cell += '"'; i++; } else quoted = !quoted; }
    else if (c === ',' && !quoted) { row.push(cell); cell = ''; }
    else if ((c === '\n' || c === '\r') && !quoted) {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(cell); if (row.some(x => x.trim())) rows.push(row); row = []; cell = '';
    } else cell += c;
  }
  if (quoted) throw new Error('CSV has an unclosed quoted field');
  if (cell || row.length) { row.push(cell); if (row.some(x => x.trim())) rows.push(row); }
  const headers = (rows.shift() ?? []).map(x => x.replace(/^\uFEFF/, '').trim());
  if (new Set(headers).size !== headers.length || !['property_code', 'room_number', 'room_type', 'floor'].every(h => headers.includes(h))) throw new Error('CSV must include unique property_code, room_number, room_type, and floor columns');
  return rows.map(cells => Object.fromEntries(headers.map((h, i) => [h, (cells[i] ?? '').trim()])));
}

export function fingerprintRoomCsv(text) {
  const rows = parseCsv(text);
  if (rows.length !== 60 || rows.some(r => r.property_code !== '58835')) throw new Error('CSV must contain exactly 60 Tombstone rooms with property code 58835');
  const rooms = rows.map(r => ({ number: r.room_number, roomType: r.room_type, floor: Number(r.floor) }));
  const roomTypes = Object.fromEntries(Object.keys(expectedCounts).map(type => [type, rooms.filter(r => r.roomType === type).length]));
  return { rooms: rooms.length, roomTypes, inventoryFingerprint: roomMapFingerprint(rooms), databaseModified: false };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try { console.log(JSON.stringify(fingerprintRoomCsv(readFileSync(process.argv[2], 'utf8')), null, 2)); }
  catch (error) { console.error(error.message); process.exitCode = 1; }
}
