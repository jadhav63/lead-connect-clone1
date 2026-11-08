import { randomBytes } from 'node:crypto';
import { expect, it } from 'vitest';
import { bootstrapConfiguration } from '../src/config/bootstrap.js';
const input = { APP_ENV: 'production', BOOTSTRAP_PROPERTY_NAME: 'Tombstone Grand Hotel', BOOTSTRAP_PROPERTY_CODE: '58835', BOOTSTRAP_CONFIRM_PROPERTY_CODE: '58835', BOOTSTRAP_APPROVAL_REFERENCE: 'TEST-CONFIG-ONLY', BOOTSTRAP_ADMIN_NAME: 'Syntax validation only', BOOTSTRAP_ADMIN_EMAIL: 'owner@hotel.unit', BOOTSTRAP_ADMIN_PASSWORD: randomBytes(24).toString('hex') };
it('requires the approved property identity and rejects demo credentials before any bootstrap write', () => {
  expect(bootstrapConfiguration(input).code).toBe('58835');
  for (const override of [{ BOOTSTRAP_PROPERTY_CODE: 'DEMO' }, { BOOTSTRAP_PROPERTY_NAME: 'Demo Hotel' }, { BOOTSTRAP_CONFIRM_PROPERTY_CODE: '' }, { BOOTSTRAP_APPROVAL_REFERENCE: '' }, { BOOTSTRAP_ADMIN_EMAIL: 'manager@demo.invalid' }, { DEMO_MANAGER_PASSWORD: 'forbidden' }])
    expect(() => bootstrapConfiguration({ ...input, ...override })).toThrow('not verified');
});
