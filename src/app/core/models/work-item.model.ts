/**
 * Modèles des éléments de travail (WorkItem) - entité unifiée qui remplace
 * l'ancienne "Estimation" et les cartes du board.
 */

export type WorkItemType =
  | 'epic'
  | 'feature'
  | 'user-story'
  | 'enabler'
  | 'bug'
  | 'spike'
  | 'task';

/** Position absolue (sur le canvas ou dans une itération) */
export interface Position {
  x: number;
  y: number;
}

/**
 * Scores CURSE - valeurs 0-100 par axe.
 * Les clés correspondent aux axes configurés dans ProjectConfig (axes reconfigurables).
 */
export type CurseScores = Record<string, number>;

/** Commentaire posé sur un WorkItem */
export interface WorkItemComment {
  id: string;
  text: string;
  author: string;
  createdAt: string;
  updatedAt: string;
}

/** Étiquette colorée attachée à un WorkItem */
export interface ItemLabel {
  id: string;
  name: string;
  color: string;
}

/** Palette de couleurs prédéfinies pour les étiquettes */
export const LABEL_PALETTE: string[] = [
  '#ef4444', '#f97316', '#eab308', '#22c55e',
  '#10b981', '#06b6d4', '#3b82f6', '#6366f1',
  '#8b5cf6', '#ec4899', '#64748b', '#a855f7'
];

export interface WorkItem {
  id: string;
  type: WorkItemType;
  title: string;
  description: string;
  parentId: string | null; // hiérarchie enfant -> parent
  points: number; // Fibonacci ; pour un parent avec enfants = somme (roll-up)
  pointsManual: boolean; // true = saisi (feuille) ; false = calculé (roll-up)
  curse: CurseScores; // aide au chiffrage (radar)
  iterationId: string | null; // itération de placement (null = backlog)
  position: Position; // position libre sur le canvas
  color: string | null; // couleur personnalisée optionnelle
  jiraUrl: string | null; // lien Jira (clé ticket extraite du dernier segment)
  comments: WorkItemComment[];
  labels: ItemLabel[];
  createdAt: string;
  updatedAt: string;
}

export interface WorkItemTypeMeta {
  type: WorkItemType;
  label: string;
  short: string; // lettre(s) de badge
  icon: string; // nom d'icône SVG (voir IconComponent)
  color: string; // accent hex
  /** Niveau hiérarchique : 1 = Epic, 2 = Feature, 3 = US ; null = autonome */
  hierarchyLevel: number | null;
}

export const WORK_ITEM_TYPES: Record<WorkItemType, WorkItemTypeMeta> = {
  epic: { type: 'epic', label: 'Epic', short: 'E', icon: 'epic', color: '#a855f7', hierarchyLevel: 1 },
  feature: { type: 'feature', label: 'Feature', short: 'F', icon: 'feature', color: '#3b82f6', hierarchyLevel: 2 },
  'user-story': { type: 'user-story', label: 'User Story', short: 'US', icon: 'user-story', color: '#22c55e', hierarchyLevel: 3 },
  enabler: { type: 'enabler', label: 'Enabler', short: 'EN', icon: 'enabler', color: '#0ea5e9', hierarchyLevel: null },
  bug: { type: 'bug', label: 'Bug', short: 'B', icon: 'bug', color: '#ef4444', hierarchyLevel: null },
  spike: { type: 'spike', label: 'Spike', short: 'SP', icon: 'spike', color: '#eab308', hierarchyLevel: null },
  task: { type: 'task', label: 'Tâche', short: 'T', icon: 'task', color: '#64748b', hierarchyLevel: null }
};

export const WORK_ITEM_TYPE_LIST: WorkItemType[] = [
  'epic',
  'feature',
  'user-story',
  'enabler',
  'bug',
  'spike',
  'task'
];

/**
 * Types considérés comme "parents potentiels" (peuvent porter des enfants et
 * bénéficier du roll-up). Les autres sont des feuilles atomiques par nature.
 */
export const PARENT_CAPABLE_TYPES: WorkItemType[] = ['epic', 'feature', 'user-story'];

export function getTypeMeta(type: WorkItemType): WorkItemTypeMeta {
  return WORK_ITEM_TYPES[type];
}

/**
 * Détermine si un type peut être parent d'un autre selon la hiérarchie logique.
 * - Epic -> Feature -> US (niveaux stricts)
 * - Un type autonome (enabler/bug/spike/task) peut être rattaché à n'importe quel
 *   niveau (rattachement optionnel), mais ne descend jamais plus bas qu'une US.
 */
export function canBeParent(parentType: WorkItemType, childType: WorkItemType): boolean {
  const parent = WORK_ITEM_TYPES[parentType];
  const child = WORK_ITEM_TYPES[childType];

  // Un parent doit être "parent capable"
  if (!PARENT_CAPABLE_TYPES.includes(parentType) && childType !== 'task') {
    // Seule exception : une US peut porter des tâches ; sinon parent capable requis
    if (!PARENT_CAPABLE_TYPES.includes(parentType)) return false;
  }

  // Hiérarchie stricte entre types positionnés
  if (parent.hierarchyLevel !== null && child.hierarchyLevel !== null) {
    return parent.hierarchyLevel < child.hierarchyLevel;
  }

  // Types autonomes rattachables sous n'importe quel parent capable
  if (child.hierarchyLevel === null) {
    return PARENT_CAPABLE_TYPES.includes(parentType);
  }

  return false;
}
