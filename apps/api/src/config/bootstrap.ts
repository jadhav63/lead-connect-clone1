export function bootstrapConfiguration(values: Record<string, string | undefined>) {
  const name = values.BOOTSTRAP_PROPERTY_NAME, code = values.BOOTSTRAP_PROPERTY_CODE;
  const adminName = values.BOOTSTRAP_ADMIN_NAME, email = values.BOOTSTRAP_ADMIN_EMAIL, password = values.BOOTSTRAP_ADMIN_PASSWORD;
  if (!name || !code || !adminName || !email || !password || password.length < 12 || password.length > 128)
    throw new Error('Private bootstrap configuration is incomplete');
  if (values.APP_ENV === 'production' && (name !== 'Tombstone Grand Hotel' || code !== '58835'
      || values.BOOTSTRAP_CONFIRM_PROPERTY_CODE !== code || !values.BOOTSTRAP_APPROVAL_REFERENCE?.trim()
      || /\.(invalid|test)$|@example\.(com|org|net)$/i.test(email)
      || Object.keys(values).some(key => key.startsWith('DEMO_'))))
    throw new Error('Production bootstrap identity or approval is not verified');
  return { name, code, adminName, email: email.toLowerCase(), password };
}
