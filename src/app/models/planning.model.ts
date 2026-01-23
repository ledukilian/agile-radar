/**
 * Modèles de données pour le module Planification
 */

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
 */
export interface PlanningPosition {
  estimationId: string;       // Référence vers une Estimation existante
  sprintId?: string;          // ID du sprint (null si hors sprint / flux libre)
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
  dependencies: []
};
