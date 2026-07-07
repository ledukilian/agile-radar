/**
 * Génère un identifiant local court, suffisant pour une app 100% locale.
 */
export function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
}
