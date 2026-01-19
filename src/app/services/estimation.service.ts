import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { Estimation } from '../models/estimation.model';

@Injectable({
  providedIn: 'root'
})
export class EstimationService {
  private readonly STORAGE_KEY = 'curse_estimations';
  private estimationsSubject = new BehaviorSubject<Estimation[]>([]);
  public estimations$: Observable<Estimation[]> = this.estimationsSubject.asObservable();

  constructor() {
    this.loadFromStorage();
  }

  getAllEstimations(): Estimation[] {
    return this.estimationsSubject.value;
  }

  getEstimation(id: string): Estimation | undefined {
    return this.estimationsSubject.value.find(e => e.id === id);
  }

  createEstimation(estimation: Omit<Estimation, 'id' | 'uuid' | 'createdAt' | 'updatedAt'>): Estimation {
    const newEstimation: Estimation = {
      ...estimation,
      id: this.generateId(),
      uuid: this.generateUuid(),
      createdAt: new Date(),
      updatedAt: new Date()
    };
    const estimations = [...this.estimationsSubject.value, newEstimation];
    this.estimationsSubject.next(estimations);
    this.saveToStorage(estimations);
    return newEstimation;
  }

  updateEstimation(id: string, updates: Partial<Omit<Estimation, 'id' | 'createdAt'>>): Estimation | null {
    const estimations = this.estimationsSubject.value.map(est => {
      if (est.id === id) {
        return { ...est, ...updates, updatedAt: new Date() };
      }
      return est;
    });
    const updated = estimations.find(e => e.id === id);
    if (updated) {
      this.estimationsSubject.next(estimations);
      this.saveToStorage(estimations);
      return updated;
    }
    return null;
  }

  deleteEstimation(id: string): void {
    const estimations = this.estimationsSubject.value.filter(e => e.id !== id);
    this.estimationsSubject.next(estimations);
    this.saveToStorage(estimations);
  }

  /**
   * Exporte toutes les estimations au format JSON
   */
  exportToJson(): string {
    const estimations = this.estimationsSubject.value;
    return JSON.stringify(estimations, null, 2);
  }

  /**
   * Télécharge les estimations sous forme de fichier JSON
   */
  downloadAsJson(): void {
    const json = this.exportToJson();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `agile-radar-export-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  /**
   * Importe des estimations depuis un fichier JSON
   * Les estimations avec un UUID existant sont écrasées, les nouvelles sont ajoutées
   * @param jsonContent Le contenu JSON à importer
   * @returns Un objet avec le nombre d'estimations ajoutées et mises à jour
   */
  importFromJson(jsonContent: string): { added: number; updated: number } {
    try {
      const imported = JSON.parse(jsonContent);
      
      if (!Array.isArray(imported)) {
        throw new Error('Le fichier doit contenir un tableau d\'estimations');
      }

      // Valider et convertir les estimations importées
      const validEstimations: Estimation[] = imported.map((e: any) => ({
        id: this.generateId(), // Toujours générer un nouvel id local
        uuid: e.uuid || this.generateUuid(), // Garder l'UUID ou en générer un nouveau
        name: e.name || 'Estimation importée',
        description: e.description || '',
        date: e.date || '',
        author: e.author || '',
        complexity: e.complexity || 'Aucune',
        uncertainty: e.uncertainty || 'Aucune',
        risk: e.risk || 'Aucun',
        size: e.size || 'Petit',
        effort: e.effort || 'Petit',
        createdAt: e.createdAt ? new Date(e.createdAt) : new Date(),
        updatedAt: new Date()
      }));

      const existing = this.estimationsSubject.value;
      const existingByUuid = new Map(existing.map(e => [e.uuid, e]));
      
      let added = 0;
      let updated = 0;
      
      // Traiter chaque estimation importée
      for (const importedEst of validEstimations) {
        const existingEst = existingByUuid.get(importedEst.uuid);
        if (existingEst) {
          // UUID existe : écraser (garder l'id local existant)
          importedEst.id = existingEst.id;
          existingByUuid.set(importedEst.uuid, importedEst);
          updated++;
        } else {
          // Nouvel UUID : ajouter
          existingByUuid.set(importedEst.uuid, importedEst);
          added++;
        }
      }

      const merged = Array.from(existingByUuid.values());
      this.estimationsSubject.next(merged);
      this.saveToStorage(merged);

      return { added, updated };
    } catch (error) {
      console.error('Erreur lors de l\'import:', error);
      throw error;
    }
  }

  private generateId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }

  /**
   * Génère un UUID v7 (time-ordered)
   * Format: xxxxxxxx-xxxx-7xxx-yxxx-xxxxxxxxxxxx
   * Les 48 premiers bits sont le timestamp en millisecondes
   */
  private generateUuid(): string {
    const timestamp = Date.now();
    
    // Convertir le timestamp en hex (48 bits = 12 caractères hex)
    const timestampHex = timestamp.toString(16).padStart(12, '0');
    
    // Générer des octets aléatoires pour le reste
    const randomBytes = new Uint8Array(10);
    crypto.getRandomValues(randomBytes);
    
    // Construire l'UUID v7
    // Format: tttttttt-tttt-7xxx-yxxx-xxxxxxxxxxxx
    // t = timestamp, x = random, y = variant (8, 9, a, ou b)
    const hex = Array.from(randomBytes).map(b => b.toString(16).padStart(2, '0')).join('');
    
    return [
      timestampHex.slice(0, 8),                          // time_high (8 hex)
      timestampHex.slice(8, 12),                         // time_mid (4 hex)
      '7' + hex.slice(0, 3),                             // version 7 + random (4 hex)
      ((parseInt(hex.slice(3, 4), 16) & 0x3) | 0x8).toString(16) + hex.slice(4, 7), // variant + random (4 hex)
      hex.slice(7, 19)                                   // random (12 hex)
    ].join('-');
  }

  private loadFromStorage(): void {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      if (stored) {
        const estimations = JSON.parse(stored);
        // Convertir les dates et migrer les anciennes estimations sans UUID
        const parsed = estimations.map((e: any) => ({
          ...e,
          uuid: e.uuid || this.generateUuid(), // Migration : ajouter UUID si absent
          createdAt: new Date(e.createdAt),
          updatedAt: new Date(e.updatedAt)
        }));
        this.estimationsSubject.next(parsed);
        // Sauvegarder pour persister les UUIDs générés lors de la migration
        this.saveToStorage(parsed);
      }
    } catch (error) {
      console.error('Erreur lors du chargement des estimations:', error);
    }
  }

  private saveToStorage(estimations: Estimation[]): void {
    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(estimations));
    } catch (error) {
      console.error('Erreur lors de la sauvegarde des estimations:', error);
    }
  }
}
