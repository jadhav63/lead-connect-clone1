import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));

test('example backup configuration is parseable, gated, and contains no live credentials', async () => {
  const config = JSON.parse(await readFile(path.join(here, 'config.example.json'), 'utf8'));
  const runner = await readFile(path.join(here, 'backup.ps1'), 'utf8');
  assert.equal(config.activationRequired, true);
  assert.match(runner, /\$cfg\.activationRequired\s+-ne\s+\$true/);
  assert.equal(config.database.name, 'leadconnect_production');
  assert.equal(config.database.user, 'leadconnect_backup');
  assert.match(config.database.host, /^REPLACE_WITH_/);
  assert.equal(config.database.sslmode, 'verify-full');
  assert.equal(config.database.channel_binding, 'require');
  assert.equal(config.alerts.provider, 'UNCONFIGURED');
  assert.match(config.paths.driveRemote, /:Production_Database$/);
});
