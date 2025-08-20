/**
 * Helper to optionally reduce serialized next-intl messages passed to the client.
 * Enable with process env INTL_FILTER=1 (e.g. in prod) after curating the allow list.
 */
export function filterClientMessages(allMessages: Record<string, any>): Record<string, any> {
  if (process.env.INTL_FILTER !== '1') return allMessages;

  // Curate based on actual client usage (namespaces passed to useTranslations()).
  const allowed = new Set<string>(['Common', 'Activities', 'DashPage', 'Hooks']);

  return Object.fromEntries(Object.entries(allMessages).filter(([k]) => allowed.has(k)));
}
