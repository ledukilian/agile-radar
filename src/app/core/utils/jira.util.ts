/**
 * Extrait la clé ticket Jira depuis la dernière partie du chemin URL.
 * Ex. https://jira.example.com/browse/PROJ-12345 → PROJ-12345
 */
export function extractJiraTicketKey(url: string | null | undefined): string | null {
  if (!url?.trim()) return null;
  const trimmed = url.trim();
  try {
    const pathname = trimmed.includes('://') ? new URL(trimmed).pathname : trimmed;
    const segment = pathname.split('/').filter(Boolean).pop();
    return segment || null;
  } catch {
    const segment = trimmed.split('/').filter(Boolean).pop();
    return segment || null;
  }
}
