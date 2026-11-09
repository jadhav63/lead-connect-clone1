import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';

const types = new Set(['AC1', 'AC2', 'AC3', 'RM1', 'RM2', 'RM3', 'SU1']);
const expectedTypeCounts = Object.freeze({ AC1: 1, AC2: 2, AC3: 1, RM1: 5, RM2: 42, RM3: 8, SU1: 1 });
export function validateHotelInventory(value) {
  const fail = message => { throw new Error(message); };
  const allowedKeys = new Set(['propertyCode', 'propertyName', 'address', 'timezone', 'verifiedBy', 'verifiedAt', 'source', 'approvalReference', 'rooms']);
  if (!value || Object.keys(value).some(key => !allowedKeys.has(key))) fail('Inventory must contain hotel metadata and room data only');
  if (value.propertyCode !== '58835' || value.propertyName !== 'Tombstone Grand Hotel, a Baymont by Wyndham') fail('Confirm the hotel identity and store code 58835');
  if (value.address !== '580 W Randolph Way, Tombstone, AZ 85638' || value.timezone !== 'America/Phoenix') fail('Confirm the production address and time zone');
  for (const key of ['verifiedBy', 'source', 'approvalReference']) if (typeof value[key] !== 'string' || !value[key].trim()) fail(`Missing inventory confirmation: ${key}`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value.verifiedAt ?? '') || !Number.isFinite(Date.parse(value.verifiedAt))) fail('Missing valid verification date');
  if (!Array.isArray(value.rooms) || value.rooms.length !== 60) fail('Exactly 60 independently verified rooms are required');
  const seen = new Set(), counts = {}, unavailable = [];
  for (const room of value.rooms) {
    if (!room || Object.keys(room).some(k => !['number', 'floor', 'roomType', 'serviceStatus', 'reason'].includes(k))) fail('Inventory must contain room data only');
    if (typeof room.number !== 'string' || !/^\d{3}$/.test(room.number) || seen.has(room.number)) fail('Room numbers must be unique three-digit strings');
    if (![1, 2].includes(room.floor) || Number(room.number[0]) !== room.floor) fail('Verify each room floor against the floor plan');
    if (!types.has(room.roomType)) fail('Use an approved hotel room type code');
    if (!['IN_SERVICE', 'OUT_OF_SERVICE'].includes(room.serviceStatus)) fail('Explicitly verify service status for every room');
    if (room.serviceStatus === 'OUT_OF_SERVICE') {
      if (typeof room.reason !== 'string' || !room.reason.trim()) fail('Out-of-service rooms require a verified reason');
      unavailable.push(room.number);
    }
    seen.add(room.number); counts[room.roomType] = (counts[room.roomType] ?? 0) + 1;
  }
  if (JSON.stringify(Object.fromEntries(Object.keys(expectedTypeCounts).map(type => [type, counts[type] ?? 0]))) !== JSON.stringify(expectedTypeCounts)) fail('Room type counts must match the approved 60-room inventory');
  return { rooms: 60, roomTypes: counts, outOfServiceRooms: unavailable, verifiedAt: value.verifiedAt,
    inventorySha256: createHash('sha256').update(JSON.stringify(value)).digest('hex'), databaseModified: false };
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try { console.log(JSON.stringify(validateHotelInventory(JSON.parse(readFileSync(process.argv[2], 'utf8'))), null, 2)); }
  catch (error) { console.error(error.message); process.exitCode = 1; }
}
