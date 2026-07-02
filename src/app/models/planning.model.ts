/**
 * Modèles de données pour le module Planification
 */

/**
 * Couleurs prédéfinies pour les sticky notes
 */
export const STICKY_NOTE_COLORS = [
  { name: 'Jaune', value: '#fef08a', textColor: '#713f12' },
  { name: 'Rose', value: '#fecdd3', textColor: '#881337' },
  { name: 'Bleu', value: '#bfdbfe', textColor: '#1e3a8a' },
  { name: 'Vert', value: '#bbf7d0', textColor: '#14532d' },
  { name: 'Violet', value: '#ddd6fe', textColor: '#4c1d95' },
  { name: 'Orange', value: '#fed7aa', textColor: '#7c2d12' },
  { name: 'Cyan', value: '#a5f3fc', textColor: '#164e63' },
  { name: 'Gris', value: '#e5e7eb', textColor: '#1f2937' }
];

/**
 * Sticky Note - Post-it sur le board
 */
export interface StickyNote {
  id: string;
  header: string;              // Titre/en-tête du post-it
  content: string;             // Contenu principal (zone de texte)
  footer: string;              // Pied de page (auteur, date, etc.)
  color: string;               // Couleur de fond (hex)
  textColor: string;           // Couleur du texte (hex)
  position: { x: number; y: number };  // Position sur le board
  width: number;               // Largeur
  height: number;              // Hauteur
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Point de dessin (coordonnées)
 */
export interface DrawingPoint {
  x: number;
  y: number;
}

/**
 * Trait de dessin
 */
export interface DrawingStroke {
  id: string;
  points: DrawingPoint[];      // Liste des points du trait
  color: string;               // Couleur du trait (hex)
  thickness: number;           // Épaisseur du trait en pixels
  createdAt: Date;
}

/**
 * Configuration du mode dessin
 */
export interface DrawingSettings {
  color: string;               // Couleur actuelle
  thickness: number;           // Épaisseur actuelle
}

/**
 * Valeurs par défaut pour le mode dessin
 */
export const DEFAULT_DRAWING_SETTINGS: DrawingSettings = {
  color: '#ef4444',            // Rouge par défaut
  thickness: 3
};

/**
 * Valeurs par défaut pour un nouveau sticky note
 */
export const DEFAULT_STICKY_NOTE: Omit<StickyNote, 'id' | 'createdAt' | 'updatedAt' | 'position'> = {
  header: 'Note',
  content: '',
  footer: '',
  color: '#fef08a',            // Jaune par défaut
  textColor: '#713f12',
  width: 200,
  height: 200
};

/**
 * Sprint - conteneur intelligent pour regrouper Features et User Stories
 */
export interface Sprint {
  id: string;
  name: string;
  capacity?: number;          // Points max (capacité en story points) - optionnel
  startDate?: string;         // Date de début (optionnelle)
  endDate?: string;           // Date de fin (optionnelle)
  position: { x: number; y: number };  // Position sur le board
  width: number;              // Largeur du conteneur
  height: number;             // Hauteur du conteneur
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Types de dépendances entre éléments
 */
export type DependencyType = 'blocks' | 'depends-on' | 'must-precede';

/**
 * Dépendance entre deux éléments (Feature ou User Story)
 */
export interface Dependency {
  id: string;
  sourceId: string;           // ID de l'élément source (Feature ou US)
  targetId: string;           // ID de l'élément cible (Feature ou US)
  type: DependencyType;       // Type de dépendance
  description: string;        // Texte libre obligatoire (ex: "Validation équipe sécurité")
  createdAt: Date;
}

/**
 * Position d'un élément sur le board de planification
 * Note: L'appartenance à un sprint est déterminée dynamiquement par la position
 */
export interface PlanningPosition {
  estimationId: string;       // Référence vers une Estimation existante
  position: { x: number; y: number };  // Position absolue sur le board
}

/**
 * Configuration complète du board de planification
 */
export interface PlanningBoard {
  id: string;
  name: string;
  zoom: number;               // Niveau de zoom (1 = 100%)
  panOffset: { x: number; y: number };  // Décalage de la vue (pan)
  gridEnabled: boolean;       // Grille de snap activée
  gridSize: number;           // Taille de la grille en pixels
  sprints: Sprint[];          // Liste des sprints
  positions: PlanningPosition[];  // Positions des éléments sur le board
  dependencies: Dependency[]; // Dépendances entre éléments
  stickyNotes: StickyNote[];  // Post-its sur le board
  drawings: DrawingStroke[];  // Dessins libres sur le board
  updatedAt: Date;
}

/**
 * État calculé d'un sprint
 */
export type SprintStatus = 'empty' | 'balanced' | 'warning' | 'overloaded' | 'at-risk';

/**
 * Informations calculées pour un sprint
 */
export interface SprintInfo {
  sprint: Sprint;
  usedPoints: number;         // Points utilisés
  itemCount: number;          // Nombre d'éléments dans le sprint
  loadPercentage: number;     // Pourcentage de charge (usedPoints / capacity * 100)
  unresolvedDependencies: number;  // Nombre de dépendances non résolues
  status: SprintStatus;       // État global du sprint
}

/**
 * Recommandation de planification
 */
export interface PlanningRecommendation {
  type: 'success' | 'warning' | 'danger' | 'info';
  icon: string;
  title: string;
  text: string;
  sprintId?: string;          // Si la recommandation concerne un sprint spécifique
  estimationId?: string;      // Si la recommandation concerne un élément spécifique
}

/**
 * Labels français pour les types de dépendances
 */
export const DEPENDENCY_TYPE_LABELS: Record<DependencyType, string> = {
  'blocks': 'Bloque',
  'depends-on': 'Dépend de',
  'must-precede': 'Doit précéder'
};

/**
 * Couleurs pour les types de dépendances
 */
export const DEPENDENCY_TYPE_COLORS: Record<DependencyType, { line: string; bg: string }> = {
  'blocks': { line: '#ef4444', bg: 'bg-red-100' },           // Rouge
  'depends-on': { line: '#f59e0b', bg: 'bg-amber-100' },     // Orange
  'must-precede': { line: '#3b82f6', bg: 'bg-blue-100' }     // Bleu
};

/**
 * Valeurs par défaut pour un nouveau sprint
 */
export const DEFAULT_SPRINT: Omit<Sprint, 'id' | 'createdAt' | 'updatedAt'> = {
  name: 'Nouveau Sprint',
  // capacity est optionnel - non défini par défaut
  position: { x: 100, y: 100 },
  width: 450,
  height: 350
};

/**
 * Valeurs par défaut pour un nouveau board
 */
export const DEFAULT_BOARD: Omit<PlanningBoard, 'id' | 'updatedAt'> = {
  name: 'Board de planification',
  zoom: 1,
  panOffset: { x: 0, y: 0 },
  gridEnabled: true,
  gridSize: 20,
  sprints: [],
  positions: [],
  dependencies: [],
  stickyNotes: [],
  drawings: []
};
