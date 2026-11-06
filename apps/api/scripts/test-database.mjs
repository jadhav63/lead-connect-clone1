// Check before importing the app, opening a connection, or running test cleanup.
export function assertTestDatabase(raw) {
  let url;
  try { url = new URL(raw ?? ''); } catch { throw new Error('Set a local disposable DATABASE_URL for leadconnect_test'); }
  if (!['postgres:', 'postgresql:'].includes(url.protocol)
    || !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)
    || url.pathname !== '/leadconnect_test'
    || [...url.searchParams.keys()].some(key => !['schema', 'sslmode'].includes(key))
    || (url.searchParams.has('schema') && url.searchParams.get('schema') !== 'public')) {
    throw new Error('Tests require a loopback PostgreSQL database named exactly leadconnect_test; remote databases and connection overrides are forbidden');
  }
}
