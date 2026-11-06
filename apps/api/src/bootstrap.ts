import 'dotenv/config';
import argon2 from 'argon2';
import { prisma } from './lib/db.js';
async function main() {
  const { BOOTSTRAP_PROPERTY_NAME: name, BOOTSTRAP_PROPERTY_CODE: code,
    BOOTSTRAP_ADMIN_NAME: adminName, BOOTSTRAP_ADMIN_EMAIL: email,
    BOOTSTRAP_ADMIN_PASSWORD: password } = process.env;
  if (!name || !code || !adminName || !email || !password || password.length < 12) {
    throw new Error('Set BOOTSTRAP_PROPERTY_NAME, BOOTSTRAP_PROPERTY_CODE, BOOTSTRAP_ADMIN_NAME, BOOTSTRAP_ADMIN_EMAIL and a 12+ character BOOTSTRAP_ADMIN_PASSWORD');
  }
  if (await prisma.user.count() || await prisma.property.count()) throw new Error('Bootstrap only permitted on an empty database');
  const passwordHash = await argon2.hash(password, { type: argon2.argon2id });
  await prisma.$transaction(async tx => {
    const property = await tx.property.create({ data: { name, code } });
    const user = await tx.user.create({ data: { name: adminName, email: email.toLowerCase(), passwordHash } });
    await tx.propertyMembership.create({ data: { propertyId: property.id, userId: user.id, role: 'ADMIN' } });
  });
  console.log('Initial property and administrator created. Remove bootstrap credentials from .env.');
}
main().catch(e => { console.error(e); process.exitCode = 1; }).finally(async () => prisma.$disconnect());
