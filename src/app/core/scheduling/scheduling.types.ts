export type IterationStatus = 'empty' | 'balanced' | 'warning' | 'overloaded';

/** Résultat d'ordonnancement pour un item */
export interface ItemSchedule {
  itemId: string;
  /** Index (order) de l'itération de démarrage ; null si non planifié */
  startIndex: number | null;
  /** Index (order) de l'itération d'atterrissage ; null si non planifié */
  landingIndex: number | null;
  startIterationId: string | null;
  landingIterationId: string | null;
  /** Itérations traversées (pour les blocs/parents étalés) */
  spannedIterationIds: string[];
  effectivePoints: number;
  /** Feuille intrinsèquement trop grosse pour tenir dans une itération */
  tooBig: boolean;
  /** N'a pas pu être placé faute de capacité dans l'horizon d'itérations */
  overflow: boolean;
  /** Catégorie de traitement */
  kind: 'atomic' | 'block' | 'aggregate';
}

/** Charge calculée d'une itération */
export interface IterationLoad {
  iterationId: string;
  index: number;
  capacity: number; // brute
  reserved: number;
  netCapacity: number;
  usedPoints: number;
  overflowPoints: number; // au-delà de la capacité nette
  loadPercentage: number; // usedPoints / netCapacity * 100
  status: IterationStatus;
}

export interface DependencyViolation {
  dependencyId: string;
  sourceId: string;
  targetId: string;
  reason: string;
}

export interface ScheduleResult {
  itemSchedules: Map<string, ItemSchedule>;
  iterationLoads: Map<string, IterationLoad>;
  dependencyViolations: DependencyViolation[];
  /** Items placés mais non planifiables (débordement au-delà de l'horizon) */
  overflowItemIds: string[];
  /** Feuilles trop grosses pour une itération */
  tooBigItemIds: string[];
}
