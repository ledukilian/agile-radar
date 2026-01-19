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

  // Tables de migration des anciens labels vers valeurs numériques
  private readonly LABEL_TO_VALUE: Record<string, Record<string, number>> = {
    complexity: {
      'aucune': 0, 'simple': 25, 'moyenne': 50, 'complexe': 75, 'impossible': 100
    },
    uncertainty: {
      'aucune': 0, 'faible': 25, 'moyenne': 50, 'élevée': 75, 'totale': 100
    },
    risk: {
      'aucun': 0, 'faible': 33, 'moyen': 66, 'élevé': 100
    },
    size: {
      'petit': 0, 'moyen': 33, 'grand': 66, 'énorme': 100
    },
    effort: {
      'petit': 0, 'moyen': 33, 'grand': 66, 'inconnu': 100
    }
  };

  constructor() {
    this.loadFromStorage();
  }

  /**
   * Convertit une ancienne valeur label en valeur numérique
   */
  private migrateValue(value: string | number, axis: string): number {
    // Si c'est déjà un nombre, le retourner directement
    if (typeof value === 'number') {
      return Math.max(0, Math.min(100, value));
    }
    // Sinon, chercher le label dans la table de migration
    const labelMap = this.LABEL_TO_VALUE[axis];
    if (labelMap) {
      const numericValue = labelMap[value.toLowerCase()];
      if (numericValue !== undefined) {
        return numericValue;
      }
    }
    // Valeur par défaut si non trouvé
    return 0;
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
   * Supprime toutes les estimations
   */
  deleteAllEstimations(): void {
    this.estimationsSubject.next([]);
    this.saveToStorage([]);
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
   * Supporte les deux formats : ancien (labels) et nouveau (valeurs numériques)
   * @param jsonContent Le contenu JSON à importer
   * @returns Un objet avec le nombre d'estimations ajoutées et mises à jour
   */
  importFromJson(jsonContent: string): { added: number; updated: number } {
    try {
      const imported = JSON.parse(jsonContent);
      
      if (!Array.isArray(imported)) {
        throw new Error('Le fichier doit contenir un tableau d\'estimations');
      }

      // Valider et convertir les estimations importées (avec migration si nécessaire)
      const validEstimations: Estimation[] = imported.map((e: any) => ({
        id: this.generateId(), // Toujours générer un nouvel id local
        uuid: e.uuid || this.generateUuid(), // Garder l'UUID ou en générer un nouveau
        name: e.name || 'Estimation importée',
        description: e.description || '',
        date: e.date || '',
        author: e.author || '',
        type: (e.type === 'user-story' || e.type === 'feature') ? e.type : undefined,
        complexity: this.migrateValue(e.complexity ?? 0, 'complexity'),
        uncertainty: this.migrateValue(e.uncertainty ?? 0, 'uncertainty'),
        risk: this.migrateValue(e.risk ?? 0, 'risk'),
        size: this.migrateValue(e.size ?? 0, 'size'),
        effort: this.migrateValue(e.effort ?? 0, 'effort'),
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
        // Convertir les dates et migrer les anciennes estimations (labels → nombres, UUID)
        const parsed: Estimation[] = estimations.map((e: any) => ({
          ...e,
          uuid: e.uuid || this.generateUuid(), // Migration : ajouter UUID si absent
          // Migration : convertir les labels en valeurs numériques si nécessaire
          complexity: this.migrateValue(e.complexity ?? 0, 'complexity'),
          uncertainty: this.migrateValue(e.uncertainty ?? 0, 'uncertainty'),
          risk: this.migrateValue(e.risk ?? 0, 'risk'),
          size: this.migrateValue(e.size ?? 0, 'size'),
          effort: this.migrateValue(e.effort ?? 0, 'effort'),
          createdAt: new Date(e.createdAt),
          updatedAt: new Date(e.updatedAt)
        }));
        this.estimationsSubject.next(parsed);
        // Sauvegarder pour persister les migrations
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

  /**
   * Calcule les recommandations pour une estimation donnée
   * @param estimation L'estimation à analyser
   * @returns Liste des recommandations avec type, icône, titre, texte et dimension optionnelle
   */
  getRecommendations(estimation: Estimation | null | undefined): Recommendation[] {
    if (!estimation) return [];

    const recommendations: Recommendation[] = [];

    const { size, complexity, uncertainty, risk, effort } = estimation;
    const avg = (complexity + uncertainty + risk + size + effort) / 5;

    // Analyse de la taille
    if (size >= 75) {
      recommendations.push({
        type: 'danger',
        icon: '❗',
        title: 'Taille importante',
        text: 'Cette user story semble très volumineuse. Envisagez de la découper en plusieurs stories plus petites et indépendantes pour faciliter le suivi et réduire les risques.',
        dimension: 'size'
      });
    } else if (size >= 50) {
      recommendations.push({
        type: 'warning',
        icon: '⚠️',
        title: 'Taille modérée',
        text: 'La taille est conséquente. Identifiez les sous-tâches distinctes pour mieux répartir le travail.',
        dimension: 'size'
      });
    }

    // Analyse de la complexité
    if (complexity >= 75) {
      recommendations.push({
        type: 'danger',
        icon: '❗',
        title: 'Complexité élevée',
        text: 'La complexité technique est importante. Prévoyez un spike technique ou une session de mob programming pour explorer les solutions avant de commencer.',
        dimension: 'complexity'
      });
    } else if (complexity >= 50) {
      recommendations.push({
        type: 'warning',
        icon: '⚠️',
        title: 'Complexité technique',
        text: 'Assurez-vous que l\'équipe maîtrise les technologies impliquées. Le pair programming pourrait être bénéfique.',
        dimension: 'complexity'
      });
    }

    // Analyse de l'incertitude
    if (uncertainty >= 75) {
      recommendations.push({
        type: 'danger',
        icon: '❗',
        title: 'Forte incertitude',
        text: 'Trop d\'inconnues persistent. Organisez une session de clarification avec le Product Owner et les experts métier avant de vous engager.',
        dimension: 'uncertainty'
      });
    } else if (uncertainty >= 50) {
      recommendations.push({
        type: 'warning',
        icon: '⚠️',
        title: 'Incertitude modérée',
        text: 'Certains aspects restent flous. Validez les hypothèses clés avec le PO et documentez les décisions prises.',
        dimension: 'uncertainty'
      });
    }

    // Analyse du risque
    if (risk >= 75) {
      recommendations.push({
        type: 'danger',
        icon: '❗',
        title: 'Risque élevé',
        text: 'Les risques identifiés sont significatifs. Définissez un plan de mitigation et prévoyez des solutions de fallback avant de démarrer.',
        dimension: 'risk'
      });
    } else if (risk >= 50) {
      recommendations.push({
        type: 'warning',
        icon: '⚠️',
        title: 'Risques à surveiller',
        text: 'Des risques ont été identifiés. Surveillez-les régulièrement et préparez des alternatives si nécessaire.',
        dimension: 'risk'
      });
    }

    // Analyse de l'effort
    if (effort >= 75) {
      recommendations.push({
        type: 'danger',
        icon: '❗',
        title: 'Effort conséquent',
        text: 'L\'effort requis est important. Planifiez des points de synchronisation réguliers et envisagez de répartir le travail sur plusieurs développeurs.',
        dimension: 'effort'
      });
    } else if (effort >= 50) {
      recommendations.push({
        type: 'warning',
        icon: '⚠️',
        title: 'Effort notable',
        text: 'Prévoyez suffisamment de temps et évitez de surcharger le sprint avec d\'autres tâches complexes.',
        dimension: 'effort'
      });
    }

    // Message global basé sur la moyenne
    if (recommendations.length === 0) {
      if (avg <= 25) {
        recommendations.push({
          type: 'success',
          icon: '✅',
          title: 'Estimation maîtrisée',
          text: 'Cette estimation est bien calibrée. L\'équipe peut se lancer sereinement dans le développement.'
        });
      } else if (avg <= 40) {
        recommendations.push({
          type: 'success',
          icon: '👍',
          title: 'Bonne estimation',
          text: 'Les indicateurs sont globalement favorables. Restez vigilants sur les éventuels points de friction.'
        });
      }
    }

    return recommendations;
  }
}

/**
 * Type pour les recommandations
 */
export interface Recommendation {
  type: 'success' | 'warning' | 'danger' | 'info';
  icon: string;
  title: string;
  text: string;
  dimension?: string;
}
