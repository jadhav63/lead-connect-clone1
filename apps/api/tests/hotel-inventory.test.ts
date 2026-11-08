import { expect, it } from 'vitest';
// @ts-expect-error Standalone Node validator is shared with release tooling.
import { validateHotelInventory } from '../scripts/validate-hotel-inventory.mjs';
const fixture = () => ({ propertyCode: '58835', propertyName: 'Tombstone Grand Hotel', verifiedBy: 'Disposable test approver', source: 'Synthetic unit fixture, never import', approvalReference: 'TEST-ONLY', verifiedAt: '2026-11-08', rooms: Array.from({ length: 60 }, (_, n) => ({ number: String(n < 30 ? 101 + n : 171 + n), floor: n < 30 ? 1 : 2, roomType: 'RM2', serviceStatus: 'IN_SERVICE' })) });
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
