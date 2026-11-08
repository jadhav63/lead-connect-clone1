import 'dotenv/config';
import argon2 from 'argon2';
import { prisma } from './lib/db.js';
import { bootstrapConfiguration } from './config/bootstrap.js';
async function main() {
  const { name, code, adminName, email, password } = bootstrapConfiguration(process.env);
  if (await prisma.user.count() || await prisma.property.count()) throw new Error('Bootstrap only permitted on an empty database');
  const passwordHash = await argon2.hash(password, { type: argon2.argon2id });
  await prisma.$transaction(async tx => {
    const property = await tx.property.create({ data: { name, code } });
    const user = await tx.user.create({ data: { name: adminName, email: email.toLowerCase(), passwordHash } });
    await tx.propertyMembership.create({ data: { propertyId: property.id, userId: user.id, role: 'ADMIN' } });
  });
  console.log('Initial property and administrator created. Remove bootstrap credentials from .env.');
}
main().catch(() => { console.error('Bootstrap failed. Check configuration and database state without logging credentials.'); process.exitCode = 1; }).finally(async () => prisma.$disconnect());
