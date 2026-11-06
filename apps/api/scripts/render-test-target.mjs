// Public endpoint identity independently checked in the Neon render-test console.
// These are endpoint names, not credentials. No production endpoint is accepted.
export function assertRenderTestTarget(environment) {
  const hosts = {
    DATABASE_URL: 'ep-old-truth-aror3gey-pooler.c-4.us-west-2.aws.neon.tech',
    DIRECT_URL: 'ep-old-truth-aror3gey.c-4.us-west-2.aws.neon.tech',
  };
  for (const [key, hostname] of Object.entries(hosts)) {
    let url;
    try { url = new URL(environment[key] ?? ''); }
    catch { throw new Error(`${key}: private render-test connection required`); }
    const keys = [...url.searchParams.keys()];
    if (url.protocol !== 'postgresql:' || url.hostname !== hostname
      || url.pathname !== '/leadconnect' || (url.port && url.port !== '5432')
      || url.hash || !url.username || !url.password
      || !['require', 'verify-ca', 'verify-full'].includes(url.searchParams.get('sslmode'))
      || keys.some(k => !['sslmode', 'channel_binding', 'schema'].includes(k))
      || keys.some(k => url.searchParams.getAll(k).length !== 1)
      || (url.searchParams.has('schema') && url.searchParams.get('schema') !== 'public')) {
      throw new Error(`${key}: refusing an unverified branch, database, TLS setting, or connection override`);
    }
  }
}
