import { Position } from './work-item.model';

/** Couleurs prédéfinies pour les sticky notes */
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

export interface StickyNote {
  id: string;
  content: string;
  color: string;
  textColor: string;
  position: Position;
  width: number;
  height: number;
  createdAt: string;
  updatedAt: string;
}

export interface DrawingPoint {
  x: number;
  y: number;
}

export interface DrawingStroke {
  id: string;
  points: DrawingPoint[];
  color: string;
  thickness: number;
  createdAt: string;
}

export interface DrawingSettings {
  color: string;
  thickness: number;
}

export const DEFAULT_DRAWING_SETTINGS: DrawingSettings = {
  color: '#ef4444',
  thickness: 3
};

export const DEFAULT_STICKY_NOTE: Omit<StickyNote, 'id' | 'createdAt' | 'updatedAt' | 'position'> = {
  content: '',
  color: '#fef08a',
  textColor: '#713f12',
  width: 200,
  height: 200
};
