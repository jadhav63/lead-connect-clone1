/**
 * Render terminates public traffic at its proxy before forwarding it to the
 * application. Trust only that immediate proxy hop so Express can derive the
 * client IP for rate limiting without trusting arbitrary X-Forwarded-For data.
 */
export function proxyTrustSetting(nodeEnv: string): number | false {
  return nodeEnv === 'production' ? 1 : false;
}
