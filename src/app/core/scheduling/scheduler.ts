import { Project } from '../models/project.model';
import { WorkItem } from '../models/work-item.model';
import { Iteration, getIterationCapacityPoints, getReservedPoints, getNetCapacityPoints } from '../models/iteration.model';
import { Dependency } from '../models/dependency.model';
import {
  ItemSchedule,
  IterationLoad,
  IterationStatus,
  DependencyViolation,
  ScheduleResult
} from './scheduling.types';

const SPANNING_TYPES = new Set(['epic', 'feature']);

interface ScheduleInput {
  items: WorkItem[];
  iterations: Iteration[];
  dependencies: Dependency[];
}

/**
 * Moteur d'ordonnancement PUR (aucun effet de bord).
 * Calcule l'atterrissage prévisionnel des éléments selon la capacité par itération,
 * les réserves, les dépendances (contraintes) et le roll-up des parents.
 */
export function schedule(project: ScheduleInput): ScheduleResult {
  const iterations = [...project.iterations].sort((a, b) => a.order - b.order);
  const items = project.items;
  const deps = project.dependencies;

  const indexByIterationId = new Map<string, number>();
  iterations.forEach((it, idx) => indexByIterationId.set(it.id, idx));

  const itemById = new Map<string, WorkItem>();
  items.forEach(i => itemById.set(i.id, i));

  const childrenByParent = new Map<string, WorkItem[]>();
  for (const item of items) {
    if (item.parentId) {
      const arr = childrenByParent.get(item.parentId) ?? [];
      arr.push(item);
      childrenByParent.set(item.parentId, arr);
    }
  }
  const hasChildren = (id: string): boolean => (childrenByParent.get(id)?.length ?? 0) > 0;

  // Capacité nette restante par index d'itération
  const remaining: number[] = iterations.map(it => getNetCapacityPoints(it));
  const netCap: number[] = iterations.map(it => getNetCapacityPoints(it));
  const usedByIndex: number[] = iterations.map(() => 0);

  const itemSchedules = new Map<string, ItemSchedule>();
  const overflowItemIds: string[] = [];
  const tooBigItemIds: string[] = [];

  // ---- Ordre de traitement : topo (dépendances) puis itération désirée ----
  const topoRank = computeTopoRank(items, deps);

  // Unités consommatrices = items placés sans enfants
  const consumingUnits = items
    .filter(i => i.iterationId !== null && indexByIterationId.has(i.iterationId) && !hasChildren(i.id))
    .sort((a, b) => {
      const ra = topoRank.get(a.id) ?? 0;
      const rb = topoRank.get(b.id) ?? 0;
      if (ra !== rb) return ra - rb;
      const ia = indexByIterationId.get(a.iterationId as string) ?? 0;
      const ib = indexByIterationId.get(b.iterationId as string) ?? 0;
      return ia - ib;
    });

  // Contraintes de dépendances : pour un item cible, index de départ minimal
  const depMinStart = (itemId: string): number => {
    let min = 0;
    for (const dep of deps) {
      if (dep.targetId !== itemId) continue;
      const src = itemSchedules.get(dep.sourceId);
      if (src && src.landingIndex !== null) {
        min = Math.max(min, src.landingIndex);
      }
    }
    return min;
  };

  const lastIdx = iterations.length - 1;

  for (const unit of consumingUnits) {
    const desiredIdx = indexByIterationId.get(unit.iterationId as string) ?? 0;
    const startSearch = Math.max(desiredIdx, depMinStart(unit.id));
    const points = unit.points;
    const spanning = SPANNING_TYPES.has(unit.type);

    if (iterations.length === 0) {
      itemSchedules.set(unit.id, blankSchedule(unit.id, points, spanning ? 'block' : 'atomic', true, false));
      overflowItemIds.push(unit.id);
      continue;
    }

    if (spanning) {
      // Bloc : étalé sur plusieurs itérations selon capacité restante
      const spanned = spreadBlock(startSearch, points, remaining, usedByIndex, lastIdx);
      const landing = spanned.length > 0 ? spanned[spanned.length - 1] : Math.min(startSearch, lastIdx);
      const overflow = spanned.overflow;
      const startIdx = spanned.length > 0 ? spanned[0] : Math.min(startSearch, lastIdx);
      itemSchedules.set(unit.id, {
        itemId: unit.id,
        startIndex: startIdx,
        landingIndex: landing,
        startIterationId: iterations[startIdx]?.id ?? null,
        landingIterationId: iterations[landing]?.id ?? null,
        spannedIterationIds: spanned.map(i => iterations[i].id),
        effectivePoints: points,
        tooBig: false,
        overflow,
        kind: 'block'
      });
      if (overflow) overflowItemIds.push(unit.id);
    } else {
      // Atomique : doit tenir dans une itération
      const maxNetFromStart = maxValue(netCap, startSearch);
      const tooBig = points > maxNetFromStart && maxNetFromStart >= 0 && points > 0;
      let placedIdx = -1;
      for (let idx = startSearch; idx <= lastIdx; idx++) {
        if (remaining[idx] >= points) {
          placedIdx = idx;
          break;
        }
      }
      let overflow = false;
      if (placedIdx === -1) {
        // Pas de place dans l'horizon -> déborde sur la dernière itération
        placedIdx = Math.min(Math.max(startSearch, 0), lastIdx);
        overflow = !tooBig; // tooBig est signalé séparément
      }
      remaining[placedIdx] -= points;
      usedByIndex[placedIdx] += points;
      itemSchedules.set(unit.id, {
        itemId: unit.id,
        startIndex: placedIdx,
        landingIndex: placedIdx,
        startIterationId: iterations[placedIdx]?.id ?? null,
        landingIterationId: iterations[placedIdx]?.id ?? null,
        spannedIterationIds: iterations[placedIdx] ? [iterations[placedIdx].id] : [],
        effectivePoints: points,
        tooBig,
        overflow,
        kind: 'atomic'
      });
      if (tooBig) tooBigItemIds.push(unit.id);
      if (overflow) overflowItemIds.push(unit.id);
    }
  }

  // ---- Roll-up des parents (post-order) ----
  const roots = items.filter(i => !i.parentId);
  for (const root of roots) {
    computeAggregate(root, itemById, childrenByParent, itemSchedules, iterations);
  }

  // ---- Charges par itération (basées sur le placement réel, pas le spillover simulé) ----
  const placementUsed: number[] = iterations.map(() => 0);
  for (const item of items) {
    if (item.iterationId === null || !indexByIterationId.has(item.iterationId)) continue;
    if (hasChildren(item.id)) continue;
    const idx = indexByIterationId.get(item.iterationId) as number;
    placementUsed[idx] += item.points;
  }

  const iterationLoads = new Map<string, IterationLoad>();
  iterations.forEach((it, idx) => {
    const capacity = getIterationCapacityPoints(it);
    const reserved = getReservedPoints(it);
    const net = netCap[idx];
    const used = placementUsed[idx];
    const overflowPoints = Math.max(0, used - net);
    const loadPercentage = net > 0 ? (used / net) * 100 : used > 0 ? 999 : 0;
    iterationLoads.set(it.id, {
      iterationId: it.id,
      index: idx,
      capacity,
      reserved,
      netCapacity: net,
      usedPoints: Math.round(used * 10) / 10,
      overflowPoints: Math.round(overflowPoints * 10) / 10,
      loadPercentage: Math.round(loadPercentage),
      status: computeStatus(used, net)
    });
  });

  // ---- Violations de dépendances ----
  const dependencyViolations: DependencyViolation[] = [];
  for (const dep of deps) {
    const src = itemSchedules.get(dep.sourceId);
    const tgt = itemSchedules.get(dep.targetId);
    if (!src || !tgt) continue;
    if (src.landingIndex === null || tgt.startIndex === null) continue;
    if (src.landingIndex > tgt.startIndex) {
      dependencyViolations.push({
        dependencyId: dep.id,
        sourceId: dep.sourceId,
        targetId: dep.targetId,
        reason: `La source atterrit (it. ${src.landingIndex + 1}) après le démarrage de la cible (it. ${tgt.startIndex + 1}).`
      });
    }
  }

  return {
    itemSchedules,
    iterationLoads,
    dependencyViolations,
    overflowItemIds,
    tooBigItemIds
  };
}

// ==================== Helpers ====================

interface SpreadResult extends Array<number> {
  overflow: boolean;
}

/**
 * Étale un bloc de `points` à partir de `startSearch`, en consommant la capacité
 * restante de chaque itération. Retourne les index traversés + flag overflow.
 */
function spreadBlock(
  startSearch: number,
  points: number,
  remaining: number[],
  usedByIndex: number[],
  lastIdx: number
): SpreadResult {
  const spanned: number[] = [];
  let leftover = points;
  let idx = Math.min(Math.max(startSearch, 0), lastIdx);
  let overflow = false;

  if (points <= 0) {
    const res = [idx] as SpreadResult;
    res.overflow = false;
    return res;
  }

  while (leftover > 0 && idx <= lastIdx) {
    const cap = Math.max(0, remaining[idx]);
    if (cap <= 0 && spanned.length > 0) {
      idx++;
      continue;
    }
    const take = Math.min(leftover, cap > 0 ? cap : leftover);
    // Si l'itération est déjà pleine mais c'est la première, on y pose quand même une part
    const actualTake = cap > 0 ? take : leftover;
    remaining[idx] -= actualTake;
    usedByIndex[idx] += actualTake;
    leftover -= actualTake;
    if (!spanned.includes(idx)) spanned.push(idx);
    if (leftover > 0) idx++;
  }

  if (leftover > 0) {
    // Débordement : on impute le reste à la dernière itération
    remaining[lastIdx] -= leftover;
    usedByIndex[lastIdx] += leftover;
    if (!spanned.includes(lastIdx)) spanned.push(lastIdx);
    overflow = true;
  }

  const res = spanned as SpreadResult;
  res.overflow = overflow;
  return res;
}

function maxValue(arr: number[], fromIdx: number): number {
  let max = -Infinity;
  for (let i = Math.max(0, fromIdx); i < arr.length; i++) {
    if (arr[i] > max) max = arr[i];
  }
  return max === -Infinity ? 0 : max;
}

function blankSchedule(
  itemId: string,
  points: number,
  kind: ItemSchedule['kind'],
  overflow: boolean,
  tooBig: boolean
): ItemSchedule {
  return {
    itemId,
    startIndex: null,
    landingIndex: null,
    startIterationId: null,
    landingIterationId: null,
    spannedIterationIds: [],
    effectivePoints: points,
    tooBig,
    overflow,
    kind
  };
}

function computeStatus(used: number, net: number): IterationStatus {
  if (used <= 0) return 'empty';
  if (net <= 0) return 'overloaded';
  const pct = (used / net) * 100;
  if (pct > 100) return 'overloaded';
  if (pct > 90) return 'warning';
  return 'balanced';
}

/**
 * Roll-up récursif : un parent démarre au min et atterrit au max de ses enfants.
 */
function computeAggregate(
  item: WorkItem,
  itemById: Map<string, WorkItem>,
  childrenByParent: Map<string, WorkItem[]>,
  itemSchedules: Map<string, ItemSchedule>,
  iterations: Iteration[]
): ItemSchedule | null {
  const children = childrenByParent.get(item.id) ?? [];
  if (children.length === 0) {
    // Feuille / bloc déjà planifié précédemment
    return itemSchedules.get(item.id) ?? null;
  }

  const childSchedules: ItemSchedule[] = [];
  for (const child of children) {
    const cs = computeAggregate(child, itemById, childrenByParent, itemSchedules, iterations);
    if (cs) childSchedules.push(cs);
  }

  const starts = childSchedules.map(c => c.startIndex).filter((v): v is number => v !== null);
  const landings = childSchedules.map(c => c.landingIndex).filter((v): v is number => v !== null);
  const spannedSet = new Set<string>();
  childSchedules.forEach(c => c.spannedIterationIds.forEach(id => spannedSet.add(id)));

  const startIndex = starts.length > 0 ? Math.min(...starts) : null;
  const landingIndex = landings.length > 0 ? Math.max(...landings) : null;
  const effectivePoints = childSchedules.reduce((s, c) => s + c.effectivePoints, 0);

  const aggregate: ItemSchedule = {
    itemId: item.id,
    startIndex,
    landingIndex,
    startIterationId: startIndex !== null ? iterations[startIndex]?.id ?? null : null,
    landingIterationId: landingIndex !== null ? iterations[landingIndex]?.id ?? null : null,
    spannedIterationIds: Array.from(spannedSet),
    effectivePoints,
    tooBig: false,
    overflow: childSchedules.some(c => c.overflow),
    kind: 'aggregate'
  };
  itemSchedules.set(item.id, aggregate);
  return aggregate;
}

/**
 * Tri topologique (Kahn) sur les dépendances source -> target.
 * Retourne un rang par item ; les cycles sont brisés en fin de liste.
 */
function computeTopoRank(items: WorkItem[], deps: Dependency[]): Map<string, number> {
  const inDegree = new Map<string, number>();
  const adj = new Map<string, string[]>();
  items.forEach(i => {
    inDegree.set(i.id, 0);
    adj.set(i.id, []);
  });
  for (const dep of deps) {
    if (!inDegree.has(dep.sourceId) || !inDegree.has(dep.targetId)) continue;
    adj.get(dep.sourceId)!.push(dep.targetId);
    inDegree.set(dep.targetId, (inDegree.get(dep.targetId) ?? 0) + 1);
  }

  const queue: string[] = [];
  inDegree.forEach((deg, id) => {
    if (deg === 0) queue.push(id);
  });

  const rank = new Map<string, number>();
  let r = 0;
  while (queue.length > 0) {
    const id = queue.shift() as string;
    rank.set(id, r++);
    for (const next of adj.get(id) ?? []) {
      const d = (inDegree.get(next) ?? 0) - 1;
      inDegree.set(next, d);
      if (d === 0) queue.push(next);
    }
  }

  // Items restants (cycles) : rangs en fin
  items.forEach(i => {
    if (!rank.has(i.id)) rank.set(i.id, r++);
  });

  return rank;
}
