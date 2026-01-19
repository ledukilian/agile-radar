export interface Estimation {
  id: string;
  uuid: string; // Identifiant unique universel pour l'import/export
  name: string;
  description?: string;
  complexity: string; // Taille de t-shirt
  uncertainty: string;
  risk: string;
  size: string;
  effort: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Taille {
  label: string; // Ex: "XS", "S", "M", "L", "XL"
  value: number; // Valeur numérique pour le radar (0-100)
  description?: string; // Ex: "Très faible", "Faible", etc.
}

export interface CurseConfig {
  tailles: Taille[];
}
