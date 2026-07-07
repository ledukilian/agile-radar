import { CurseAxis } from '../models/config.model';
import { CurseScores, WorkItem } from '../models/work-item.model';

/**
 * Arrondit une valeur brute à la valeur Fibonacci la plus proche de l'échelle.
 */
export function snapToFibonacci(raw: number, scale: number[]): number {
  if (scale.length === 0) return Math.round(raw);
  return scale.reduce((prev, curr) =>
    Math.abs(curr - raw) < Math.abs(prev - raw) ? curr : prev
  );
}

/**
 * Moyenne pondérée des axes CURSE actifs (0-100).
 */
export function curseWeightedAverage(scores: CurseScores, axes: CurseAxis[]): number {
  const active = axes.filter(a => a.enabled);
  if (active.length === 0) return 0;
  const totalWeight = active.reduce((s, a) => s + a.weight, 0);
  if (totalWeight === 0) return 0;
  const weighted = active.reduce((s, a) => {
    const v = scores[a.key] ?? 0;
    return s + v * a.weight;
  }, 0);
  return weighted / totalWeight;
}

/**
 * Suggère un nombre de points à partir des scores CURSE.
 * Mapping exponentiel (0-100 -> 1..maxFib) puis snap Fibonacci.
 * Le radar reste une AIDE : la valeur est proposée, jamais imposée.
 */
export function suggestPointsFromCurse(
  scores: CurseScores,
  axes: CurseAxis[],
  fibonacci: number[]
): number {
  const avg = curseWeightedAverage(scores, axes);
  const maxFib = fibonacci.length > 0 ? fibonacci[fibonacci.length - 1] : 89;
  const normalized = Math.max(0, Math.min(1, avg / 100));
  const raw = Math.pow(maxFib, normalized); // 1 .. maxFib
  return snapToFibonacci(raw, fibonacci);
}

/**
 * Crée un jeu de scores CURSE vide à partir des axes configurés.
 */
export function emptyCurseScores(axes: CurseAxis[]): CurseScores {
  const scores: CurseScores = {};
  for (const axis of axes) {
    scores[axis.key] = 0;
  }
  return scores;
}

/**
 * Indique si un item est une feuille (aucun enfant dans la liste fournie).
 */
export function isLeaf(item: WorkItem, allItems: WorkItem[]): boolean {
  return !allItems.some(i => i.parentId === item.id);
}

/**
 * Retourne les enfants directs d'un item.
 */
export function getChildren(parentId: string, allItems: WorkItem[]): WorkItem[] {
  return allItems.filter(i => i.parentId === parentId);
}

/**
 * Calcule les points effectifs d'un item :
 * - feuille : ses propres points ;
 * - parent : somme (roll-up récursif) des points de ses enfants.
 */
export function computeEffectivePoints(item: WorkItem, allItems: WorkItem[]): number {
  const children = getChildren(item.id, allItems);
  if (children.length === 0) {
    return item.points;
  }
  return children.reduce((sum, child) => sum + computeEffectivePoints(child, allItems), 0);
}
