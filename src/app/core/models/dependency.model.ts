export type DependencyType = 'blocks' | 'depends-on' | 'must-precede';

/**
 * Dépendance entre deux WorkItems.
 * source -> target : la source doit atterrir avant la cible (contrainte d'ordonnancement).
 */
export interface Dependency {
  id: string;
  sourceId: string;
  targetId: string;
  type: DependencyType;
  description: string;
  createdAt: string;
}

export const DEPENDENCY_TYPE_LABELS: Record<DependencyType, string> = {
  blocks: 'Bloque',
  'depends-on': 'Dépend de',
  'must-precede': 'Doit précéder'
};

export const DEPENDENCY_TYPE_COLORS: Record<DependencyType, string> = {
  blocks: '#ef4444',
  'depends-on': '#f59e0b',
  'must-precede': '#3b82f6'
};
