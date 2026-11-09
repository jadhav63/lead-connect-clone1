import { expect, it } from 'vitest';
// @ts-expect-error Standalone Node validator is shared with release tooling.
import { validateHotelInventory } from '../scripts/validate-hotel-inventory.mjs';
// @ts-expect-error Standalone room-map fingerprint helper is shared with release tooling.
import { fingerprintRoomCsv, roomMapFingerprint } from '../scripts/room-map-fingerprint.mjs';
const fixture = () => {
  const roomTypes = ['AC1', 'AC2', 'AC2', 'AC3', ...Array(5).fill('RM1'), ...Array(42).fill('RM2'), ...Array(8).fill('RM3'), 'SU1'];
  return { propertyCode: '58835', propertyName: 'Tombstone Grand Hotel, a Baymont by Wyndham', address: '580 W Randolph Way, Tombstone, AZ 85638', timezone: 'America/Phoenix', verifiedBy: 'Disposable test approver', source: 'Synthetic unit fixture, never import', approvalReference: 'TEST-ONLY', verifiedAt: '2026-11-08', rooms: roomTypes.map((roomType, n) => ({ number: String(n < 30 ? 101 + n : 171 + n), floor: n < 30 ? 1 : 2, roomType, serviceStatus: 'IN_SERVICE' })) };
};
it('requires explicit approval metadata and 60 verified room identities without touching a database', () => {
  expect(validateHotelInventory(fixture()).databaseModified).toBe(false);
  expect(() => validateHotelInventory({ ...fixture(), verifiedBy: '' })).toThrow('confirmation');
  expect(() => validateHotelInventory({ ...fixture(), rooms: [] })).toThrow('60');
});
it('rejects duplicate numbers, wrong floors, unsupported types, unknown service status and unreasoned outages', () => {
  for (const change of [{ number: '102' }, { floor: 2 }, { roomType: 'UNKNOWN' }, { serviceStatus: 'UNKNOWN' }, { serviceStatus: 'OUT_OF_SERVICE' }, { guestName: 'Forbidden field' }]) {
    const input = fixture(); Object.assign(input.rooms[0], change);
    expect(() => validateHotelInventory(input)).toThrow();
  }
});
it('rejects room type totals that do not match the approved hotel inventory', () => {
  const input = fixture();
  input.rooms[0].roomType = 'RM2';
  expect(() => validateHotelInventory(input)).toThrow('counts');
});
it('rejects non-inventory data such as employee or demo records', () => {
  expect(() => validateHotelInventory({ ...fixture(), demoEmployees: [{ email: 'fictional@example.test' }] })).toThrow('metadata and room data only');
});
it('produces a database-free fingerprint from the approved room/type/floor map CSV', () => {
  const inventory = fixture();
  const csv = ['property_code,room_number,room_type,floor', ...inventory.rooms.map(r => `58835,${r.number},${r.roomType},${r.floor}`)].join('\n');
  const first = fingerprintRoomCsv(csv);
  const reordered = fingerprintRoomCsv(['property_code,room_number,room_type,floor', ...[...inventory.rooms].reverse().map(r => `58835,${r.number},${r.roomType},${r.floor}`)].join('\n'));
  expect(first).toMatchObject({ rooms: 60, roomTypes: { AC1: 1, AC2: 2, AC3: 1, RM1: 5, RM2: 42, RM3: 8, SU1: 1 }, databaseModified: false });
  expect(first.inventoryFingerprint).toMatch(/^[a-f0-9]{64}$/);
  expect(reordered.inventoryFingerprint).toBe(first.inventoryFingerprint);
  expect(roomMapFingerprint(inventory.rooms)).toBe(first.inventoryFingerprint);
  expect(() => fingerprintRoomCsv(csv.replace('58835,101,AC1,1', 'LCD60,101,AC1,1'))).toThrow('property code 58835');
});
