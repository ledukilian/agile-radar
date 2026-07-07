/**
 * Axe CURSE reconfigurable (label, couleur, poids, activation).
 * La clé identifie l'axe dans WorkItem.curse.
 */
export interface CurseAxis {
  key: string;
  label: string;
  color: string;
  weight: number;
  enabled: boolean;
}

export interface ProjectConfig {
  author: string;
  /** Ratio points/jour-homme par défaut (proposé pour les nouvelles itérations) */
  pointsPerManDayDefault: number;
  /** Axes du radar d'aide à la décision */
  curseAxes: CurseAxis[];
  /** Échelle de points autorisée (Fibonacci par défaut) */
  fibonacci: number[];
  theme: 'dark' | 'light';
}

export const DEFAULT_FIBONACCI: number[] = [1, 2, 3, 5, 8, 13, 21, 34, 55, 89];

export const DEFAULT_CURSE_AXES: CurseAxis[] = [
  { key: 'complexity', label: 'Complexité', color: '#eab308', weight: 1.5, enabled: true },
  { key: 'uncertainty', label: 'Incertitude', color: '#a855f7', weight: 2, enabled: true },
  { key: 'risk', label: 'Risque', color: '#ef4444', weight: 2, enabled: true },
  { key: 'size', label: 'Taille', color: '#22c55e', weight: 1, enabled: true },
  { key: 'effort', label: 'Effort', color: '#3b82f6', weight: 1, enabled: true }
];

export function getDefaultConfig(): ProjectConfig {
  return {
    author: '',
    pointsPerManDayDefault: 1,
    curseAxes: DEFAULT_CURSE_AXES.map(a => ({ ...a })),
    fibonacci: [...DEFAULT_FIBONACCI],
    theme: 'light'
  };
}
