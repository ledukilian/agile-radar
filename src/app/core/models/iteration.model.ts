import { Position } from './work-item.model';

/**
 * Enveloppe de réserve (bande passante) sur une itération.
 * Matérialisée visuellement dans la jauge de charge.
 */
export interface Reserve {
  id: string;
  label: string; // ex: "Dette technique", "Bugs / run", "Buffer"
  color: string; // hex
  mode: 'percent' | 'points'; // % de la capacité OU points fixes
  value: number;
}

/**
 * Définition de la capacité d'une itération, dérivée des jours-homme.
 * capacité (points) = manualPoints ?? joursHommeEquipe * focusFactor * pointsPerManDay
 * (joursHommeEquipe = people * daysPerPerson, saisi comme un seul champ en UI)
 */
export interface CapacityDef {
  people: number; // conservé pour compatibilité import ; en UI = 1
  daysPerPerson: number; // en UI = jours-homme équipe (total brut)
  focusFactor: number; // 0..1 (part réellement consacrée au dev)
  pointsPerManDay: number; // ratio points / jour-homme
  manualPoints: number | null; // override direct en points (ignore le calcul si défini)
}

export interface Iteration {
  id: string;
  order: number; // ordre séquentiel (0-based)
  name: string;
  startDate: string | null; // ISO date
  endDate: string | null; // ISO date
  capacity: CapacityDef;
  reserves: Reserve[];
  position: Position; // position de la zone sur le canvas
  width: number;
  height: number;
  /** Itération passée renseignée pour recalibrer le ratio points/jour-homme */
  isPast: boolean;
  /** Vélocité observée (points réalisés) sur une itération passée */
  actualVelocity: number | null;
}

export const DEFAULT_CAPACITY: CapacityDef = {
  people: 1,
  daysPerPerson: 40,
  focusFactor: 0.8,
  pointsPerManDay: 1,
  manualPoints: null
};

/** Jours-homme équipe (brut, avant focus). */
export function getGrossTeamManDays(capacity: CapacityDef): number {
  return capacity.people * capacity.daysPerPerson;
}

/** Jours-homme effectifs (après focus). */
export function getEffectiveTeamManDays(capacity: CapacityDef): number {
  return getGrossTeamManDays(capacity) * capacity.focusFactor;
}

/** Arrondi standard des points (2 décimales). */
export function roundPoints(value: number): number {
  return Math.round(value * 100) / 100;
}

/** Affichage français des points : toujours « x,xx ». */
export function formatPoints(value: number): string {
  return roundPoints(value).toFixed(2).replace('.', ',');
}

/**
 * Capacité brute en points d'une itération (avant déduction des réserves).
 */
export function getIterationCapacityPoints(iteration: Iteration): number {
  const c = iteration.capacity;
  if (c.manualPoints !== null && c.manualPoints >= 0) {
    return roundPoints(c.manualPoints);
  }
  const raw = getGrossTeamManDays(c) * c.focusFactor * c.pointsPerManDay;
  return roundPoints(raw);
}

/**
 * Total des points réservés sur une itération (résolution des % vers points).
 */
export function getReservedPoints(iteration: Iteration): number {
  const capacity = getIterationCapacityPoints(iteration);
  const total = iteration.reserves.reduce((sum, r) => {
    const pts = r.mode === 'percent' ? (capacity * r.value) / 100 : r.value;
    return sum + Math.max(0, pts);
  }, 0);
  return roundPoints(total);
}

/**
 * Capacité nette disponible pour les éléments = capacité - réserves.
 */
export function getNetCapacityPoints(iteration: Iteration): number {
  return roundPoints(Math.max(0, getIterationCapacityPoints(iteration) - getReservedPoints(iteration)));
}
