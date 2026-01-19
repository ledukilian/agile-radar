import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { Taille, CurseConfig } from '../models/estimation.model';

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

  private getDefaultConfig(): CurseConfig {
    return {
      tailles: [
        { label: 'XS', value: 10, description: 'Très faible' },
        { label: 'S', value: 30, description: 'Faible' },
        { label: 'M', value: 50, description: 'Moyen' },
        { label: 'L', value: 70, description: 'Élevé' },
        { label: 'XL', value: 90, description: 'Très élevé' }
      ]
    };
  }

  getConfig(): CurseConfig {
    return this.configSubject.value;
  }

  getTailles(): Taille[] {
    return this.configSubject.value.tailles;
  }

  updateConfig(config: CurseConfig): void {
    this.configSubject.next(config);
    this.saveToStorage(config);
  }

  updateTailles(tailles: Taille[]): void {
    const config = { ...this.configSubject.value, tailles };
    this.updateConfig(config);
  }

  private loadFromStorage(): void {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      if (stored) {
        const config = JSON.parse(stored);
        // Convertir les dates si nécessaire
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
