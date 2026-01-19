export interface Estimation {
  id: string;
  uuid: string; // Identifiant unique universel pour l'import/export
  name: string;
  description?: string;
  date?: string; // Date de l'estimation
  author?: string; // Auteur de l'estimation
  type?: 'user-story' | 'feature'; // Type d'estimation
  parentFeatureId?: string; // ID de la feature parente (pour les user stories)
  complexityMode?: 'feature-only' | 'sum-us'; // Mode de calcul de complexité (pour les features)
  complexity: number; // Valeur continue 0-100 (analogique)
  uncertainty: number;
  risk: number;
  size: number;
  effort: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface Taille {
  label: string; // Ex: "XS", "S", "M", "L", "XL"
  value: number; // Valeur numérique pour le radar (0-100)
  description?: string; // Ex: "Très faible", "Faible", etc.
}

export interface BaseSettings {
  title: string;
  date: string;
  description: string;
  author: string;
}

export interface CurseConfig {
  baseSettings: BaseSettings;
  tailles: Taille[];
}
