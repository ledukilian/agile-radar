import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { Taille, CurseConfig, BaseSettings, AdvancedSettings, DimensionWeights, TShirtSize, TShirtSizesConfig } from '../models/estimation.model';

@Injectable({
  providedIn: 'root'
})
export class SettingsService {
  private readonly STORAGE_KEY = 'curse_config';
  private configSubject = new BehaviorSubject<CurseConfig>(this.getDefaultConfig());
  public config$: Observable<CurseConfig> = this.configSubject.asObservable();

  constructor() {
    this.loadFromStorage();
  }

  /**
   * Retourne les poids par défaut des dimensions (multiplicateurs)
   * Complexity ×1.5, Uncertainty ×2, Risk ×2, Size ×1, Effort ×1
   */
  getDefaultDimensionWeights(): DimensionWeights {
    return {
      complexity: 1.5,
      uncertainty: 2,
      risk: 2,
      size: 1,
      effort: 1
    };
  }

  /**
   * Retourne les tailles T-shirt par défaut pour les User Stories
   */
  getDefaultUserStoryTShirtSizes(): TShirtSize[] {
    return [
      { size: 'XS', max: 3, bgColor: 'bg-green-100', textColor: 'text-green-700' },
      { size: 'S', max: 8, bgColor: 'bg-lime-100', textColor: 'text-lime-700' },
      { size: 'M', max: 21, bgColor: 'bg-yellow-100', textColor: 'text-yellow-700' },
      { size: 'L', max: 55, bgColor: 'bg-orange-100', textColor: 'text-orange-700' },
      { size: 'XL', max: 100, bgColor: 'bg-red-100', textColor: 'text-red-700' },
      { size: 'XXL', max: 180, bgColor: 'bg-purple-100', textColor: 'text-purple-700' }
    ];
  }

  /**
   * Retourne les tailles T-shirt par défaut pour les Features
   * Calculées avec un multiplicateur sur les valeurs US :
   * XS = US x 5, S = US x 4, M = US x 4, L = US x 3, XL = US x 2, XXL = US x 1.5
   */
  getDefaultFeatureTShirtSizes(): TShirtSize[] {
    return [
      { size: 'XS', max: 15, bgColor: 'bg-green-100', textColor: 'text-green-700' },    // 3 x 5
      { size: 'S', max: 32, bgColor: 'bg-lime-100', textColor: 'text-lime-700' },       // 8 x 4
      { size: 'M', max: 84, bgColor: 'bg-yellow-100', textColor: 'text-yellow-700' },   // 21 x 4
      { size: 'L', max: 165, bgColor: 'bg-orange-100', textColor: 'text-orange-700' },  // 55 x 3
      { size: 'XL', max: 200, bgColor: 'bg-red-100', textColor: 'text-red-700' },       // 100 x 2
      { size: 'XXL', max: 270, bgColor: 'bg-purple-100', textColor: 'text-purple-700' } // 180 x 1.5
    ];
  }

  /**
   * Retourne la config complète des tailles T-shirt par défaut
   */
  getDefaultTShirtSizesConfig(): TShirtSizesConfig {
    return {
      userStory: this.getDefaultUserStoryTShirtSizes(),
      feature: this.getDefaultFeatureTShirtSizes()
    };
  }

  /**
   * Retourne les tailles T-shirt par défaut (legacy - pour rétrocompatibilité)
   */
  getDefaultTShirtSizes(): TShirtSize[] {
    return this.getDefaultUserStoryTShirtSizes();
  }

  /**
   * Retourne les paramètres avancés par défaut
   */
  getDefaultAdvancedSettings(): AdvancedSettings {
    return {
      dimensionWeights: this.getDefaultDimensionWeights(),
      tShirtSizes: this.getDefaultTShirtSizes(),
      tShirtSizesConfig: this.getDefaultTShirtSizesConfig()
    };
  }

  private getDefaultConfig(): CurseConfig {
    return {
      baseSettings: {
        title: 'Estimation CURSE',
        date: new Date().toISOString().split('T')[0],
        description: '',
        author: ''
      },
      tailles: [
        { label: 'XS', value: 10, description: 'Très faible' },
        { label: 'S', value: 30, description: 'Faible' },
        { label: 'M', value: 50, description: 'Moyen' },
        { label: 'L', value: 70, description: 'Élevé' },
        { label: 'XL', value: 90, description: 'Très élevé' }
      ],
      advancedSettings: this.getDefaultAdvancedSettings()
    };
  }

  getConfig(): CurseConfig {
    return this.configSubject.value;
  }

  getTailles(): Taille[] {
    return this.configSubject.value.tailles;
  }

  getBaseSettings(): BaseSettings {
    return this.configSubject.value.baseSettings;
  }

  updateBaseSettings(baseSettings: BaseSettings): void {
    const config = { ...this.configSubject.value, baseSettings };
    this.updateConfig(config);
  }

  updateConfig(config: CurseConfig): void {
    this.configSubject.next(config);
    this.saveToStorage(config);
  }

  updateTailles(tailles: Taille[]): void {
    const config = { ...this.configSubject.value, tailles };
    this.updateConfig(config);
  }

  /**
   * Retourne les paramètres avancés actuels
   */
  getAdvancedSettings(): AdvancedSettings {
    return this.configSubject.value.advancedSettings || this.getDefaultAdvancedSettings();
  }

  /**
   * Retourne les poids des dimensions
   */
  getDimensionWeights(): DimensionWeights {
    return this.getAdvancedSettings().dimensionWeights;
  }

  /**
   * Retourne les tailles T-shirt configurées (legacy - retourne les US par défaut)
   */
  getTShirtSizes(): TShirtSize[] {
    return this.getUserStoryTShirtSizes();
  }

  /**
   * Retourne la config complète des tailles T-shirt
   */
  getTShirtSizesConfig(): TShirtSizesConfig {
    const advancedSettings = this.getAdvancedSettings();
    return advancedSettings.tShirtSizesConfig || this.getDefaultTShirtSizesConfig();
  }

  /**
   * Retourne les tailles T-shirt pour les User Stories
   */
  getUserStoryTShirtSizes(): TShirtSize[] {
    return this.getTShirtSizesConfig().userStory;
  }

  /**
   * Retourne les tailles T-shirt pour les Features
   */
  getFeatureTShirtSizes(): TShirtSize[] {
    return this.getTShirtSizesConfig().feature;
  }

  /**
   * Met à jour les paramètres avancés
   */
  updateAdvancedSettings(advancedSettings: AdvancedSettings): void {
    const config = { ...this.configSubject.value, advancedSettings };
    this.updateConfig(config);
  }

  /**
   * Met à jour les poids des dimensions
   */
  updateDimensionWeights(weights: DimensionWeights): void {
    const advancedSettings = this.getAdvancedSettings();
    advancedSettings.dimensionWeights = weights;
    this.updateAdvancedSettings(advancedSettings);
  }

  /**
   * Met à jour les tailles T-shirt (legacy)
   */
  updateTShirtSizes(sizes: TShirtSize[]): void {
    const advancedSettings = this.getAdvancedSettings();
    advancedSettings.tShirtSizes = sizes;
    this.updateAdvancedSettings(advancedSettings);
  }

  /**
   * Met à jour la config complète des tailles T-shirt
   */
  updateTShirtSizesConfig(config: TShirtSizesConfig): void {
    const advancedSettings = this.getAdvancedSettings();
    advancedSettings.tShirtSizesConfig = config;
    this.updateAdvancedSettings(advancedSettings);
  }

  /**
   * Calcule les points de complexité pour une estimation
   * Utilise les multiplicateurs configurés pour pondérer chaque dimension
   */
  calculateComplexityPoints(estimation: { complexity: number; uncertainty: number; risk: number; size: number; effort: number }): number {
    const weights = this.getDimensionWeights();
    const totalWeight = weights.complexity + weights.uncertainty + weights.risk + weights.size + weights.effort;
    
    // Moyenne pondérée avec les multiplicateurs
    const weightedAverage = (
      estimation.complexity * weights.complexity +
      estimation.uncertainty * weights.uncertainty +
      estimation.risk * weights.risk +
      estimation.size * weights.size +
      estimation.effort * weights.effort
    ) / totalWeight;

    const normalized = weightedAverage / 100;
    const points = Math.pow(377, normalized);
    return Math.round(points * 10) / 10;
  }

  /**
   * Détermine la T-shirt size pour un nombre de points donné (User Story par défaut)
   */
  getTShirtSizeByPoints(points: number, type: 'user-story' | 'feature' = 'user-story'): TShirtSize {
    const sizes = type === 'feature' ? this.getFeatureTShirtSizes() : this.getUserStoryTShirtSizes();
    for (const tShirt of sizes) {
      if (points <= tShirt.max) {
        return tShirt;
      }
    }
    return sizes[sizes.length - 1];
  }

  /**
   * Détermine la T-shirt size pour une User Story
   */
  getUserStoryTShirtSizeByPoints(points: number): TShirtSize {
    return this.getTShirtSizeByPoints(points, 'user-story');
  }

  /**
   * Détermine la T-shirt size pour une Feature
   */
  getFeatureTShirtSizeByPoints(points: number): TShirtSize {
    return this.getTShirtSizeByPoints(points, 'feature');
  }

  private loadFromStorage(): void {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      if (stored) {
        const config = JSON.parse(stored);
        // Migration: ajouter baseSettings si absent (anciennes configs)
        if (!config.baseSettings) {
          config.baseSettings = this.getDefaultConfig().baseSettings;
        }
        // Migration: ajouter advancedSettings si absent (anciennes configs)
        if (!config.advancedSettings) {
          config.advancedSettings = this.getDefaultAdvancedSettings();
        }
        // Migration: ajouter tShirtSizesConfig si absent (anciennes configs)
        if (!config.advancedSettings.tShirtSizesConfig) {
          config.advancedSettings.tShirtSizesConfig = this.getDefaultTShirtSizesConfig();
        }
        this.configSubject.next(config);
      }
    } catch (error) {
      console.error('Erreur lors du chargement de la configuration:', error);
    }
  }

  private saveToStorage(config: CurseConfig): void {
    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(config));
    } catch (error) {
      console.error('Erreur lors de la sauvegarde de la configuration:', error);
    }
  }

  resetToDefault(): void {
    const defaultConfig = this.getDefaultConfig();
    this.updateConfig(defaultConfig);
  }
}
