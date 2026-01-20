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

// Poids des dimensions pour le calcul des points (multiplicateurs)
export interface DimensionWeights {
  complexity: number; // Multiplicateur de la complexité (ex: 1.5 = ×1.5)
  uncertainty: number; // Multiplicateur de l'incertitude (ex: 2 = ×2)
  risk: number; // Multiplicateur du risque (ex: 2 = ×2)
  size: number; // Multiplicateur de la taille (ex: 1 = ×1)
  effort: number; // Multiplicateur de l'effort (ex: 1 = ×1)
}

// Configuration d'une taille T-shirt
export interface TShirtSize {
  size: string; // Ex: "XS", "S", "M", "L", "XL", "XXL"
  max: number; // Seuil max de points pour cette taille
  bgColor: string; // Classe Tailwind pour la couleur de fond
  textColor: string; // Classe Tailwind pour la couleur du texte
}

// Configuration des tailles T-shirt séparées par type
export interface TShirtSizesConfig {
  userStory: TShirtSize[]; // Tailles pour les User Stories
  feature: TShirtSize[]; // Tailles pour les Features (seuils plus élevés)
}

// Paramètres avancés
export interface AdvancedSettings {
  dimensionWeights: DimensionWeights;
  tShirtSizes: TShirtSize[]; // Deprecated - pour rétrocompatibilité
  tShirtSizesConfig?: TShirtSizesConfig; // Nouvelle config séparée US/Feature
}

export interface CurseConfig {
  baseSettings: BaseSettings;
  tailles: Taille[];
  advancedSettings?: AdvancedSettings; // Paramètres avancés optionnels
}
