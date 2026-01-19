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

  /**
   * Retourne toutes les estimations de type "feature"
   */
  getFeatures(): Estimation[] {
    return this.estimationsSubject.value.filter(e => e.type === 'feature');
  }

  /**
   * Retourne les user stories rattachées à une feature donnée
   */
  getUserStoriesForFeature(featureId: string): Estimation[] {
    return this.estimationsSubject.value.filter(e => 
      e.type === 'user-story' && e.parentFeatureId === featureId
    );
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
    const isFeature = estimation.type === 'feature';
    const isSumMode = isFeature && estimation.complexityMode === 'sum-us';
    const itemLabel = isFeature ? 'feature' : 'user story';
    const ItemLabel = isFeature ? 'Feature' : 'User Story';

    // Mode Somme des US : conseils spécifiques
    if (isSumMode) {
      const childUS = this.getUserStoriesForFeature(estimation.id);
      
      if (childUS.length === 0) {
        recommendations.push({
          type: 'info',
          icon: 'ℹ️',
          title: 'Aucune User Story rattachée',
          text: 'Cette feature est en mode "Somme des US" mais aucune user story n\'y est rattachée. Créez des US et liez-les à cette feature pour calculer sa complexité automatiquement.'
        });
      } else {
        // Analyser les US rattachées
        const avgUS = childUS.reduce((sum, us) => {
          return sum + (us.complexity + us.uncertainty + us.risk + us.size + us.effort) / 5;
        }, 0) / childUS.length;

        recommendations.push({
          type: 'info',
          icon: 'ℹ️',
          title: `${childUS.length} User ${childUS.length > 1 ? 'Stories' : 'Story'} rattachée${childUS.length > 1 ? 's' : ''}`,
          text: `La complexité de cette feature est calculée automatiquement à partir des ${childUS.length} US liées. Score moyen des US : ${Math.round(avgUS)}%.`
        });

        // Identifier les US problématiques
        const highRiskUS = childUS.filter(us => us.risk >= 75);
        const highUncertaintyUS = childUS.filter(us => us.uncertainty >= 75);
        const largeUS = childUS.filter(us => us.size >= 75);

        if (highRiskUS.length > 0) {
          recommendations.push({
            type: 'danger',
            icon: '🔴',
            title: `${highRiskUS.length} US à risque élevé`,
            text: `Attention : ${highRiskUS.length} user ${highRiskUS.length > 1 ? 'stories présentent' : 'story présente'} un risque critique. Traitez ces risques en priorité avant de poursuivre la feature.`,
            dimension: 'risk'
          });
        }

        if (highUncertaintyUS.length > 0) {
          recommendations.push({
            type: 'warning',
            icon: '⚠️',
            title: `${highUncertaintyUS.length} US avec forte incertitude`,
            text: `${highUncertaintyUS.length} user ${highUncertaintyUS.length > 1 ? 'stories nécessitent' : 'story nécessite'} des clarifications. Planifiez des sessions de refinement ciblées.`,
            dimension: 'uncertainty'
          });
        }

        if (largeUS.length > 0) {
          recommendations.push({
            type: 'warning',
            icon: '⚠️',
            title: `${largeUS.length} US volumineuse${largeUS.length > 1 ? 's' : ''}`,
            text: `${largeUS.length} user ${largeUS.length > 1 ? 'stories sont très grandes' : 'story est très grande'}. Envisagez de les redécouper pour faciliter le suivi.`,
            dimension: 'size'
          });
        }

        // Message positif si tout va bien
        if (avgUS <= 30 && highRiskUS.length === 0 && highUncertaintyUS.length === 0) {
          recommendations.push({
            type: 'success',
            icon: '✅',
            title: 'Feature bien découpée',
            text: 'Les user stories de cette feature sont bien calibrées. L\'équipe peut avancer sereinement.'
          });
        }
      }

      return recommendations;
    }

    // Mode classique : analyse des dimensions CURSE
    const { size, complexity, uncertainty, risk, effort } = estimation;
    const avg = (complexity + uncertainty + risk + size + effort) / 5;

    if (isFeature) {
      // === CONSEILS SPÉCIFIQUES AUX FEATURES ===
      this.addFeatureRecommendations(recommendations, estimation, avg);
    } else {
      // === CONSEILS POUR LES USER STORIES ===
      this.addUserStoryRecommendations(recommendations, estimation, avg);
    }

    return recommendations;
  }

  /**
   * Ajoute les recommandations spécifiques aux Features
   */
  private addFeatureRecommendations(
    recommendations: Recommendation[],
    estimation: Estimation,
    avg: number
  ): void {
    const { size, complexity, uncertainty, risk, effort } = estimation;

    // === ERREURS (DANGER) - Reprises des US, adaptées au vocabulaire feature ===
    
    // Taille élevée
    if (size >= 75) {
      recommendations.push({
        type: 'danger',
        icon: '🔴',
        title: 'Feature volumineuse',
        text: 'Le périmètre est large. Envisagez de découper en features plus petites ou passez en mode "Somme des US" pour un meilleur pilotage.',
        dimension: 'size'
      });
    }

    // Complexité élevée
    if (complexity >= 75) {
      recommendations.push({
        type: 'danger',
        icon: '🔴',
        title: 'Complexité élevée',
        text: 'La complexité est importante. Prévoyez des spikes techniques et validez l\'architecture avant de lancer le développement.',
        dimension: 'complexity'
      });
    }

    // Incertitude élevée
    if (uncertainty >= 75) {
      recommendations.push({
        type: 'danger',
        icon: '🔴',
        title: 'Incertitude élevée',
        text: 'Plusieurs inconnues subsistent. Organisez des ateliers de cadrage (Impact Mapping, Event Storming) pour clarifier.',
        dimension: 'uncertainty'
      });
    }

    // Risque élevé
    if (risk >= 75) {
      recommendations.push({
        type: 'danger',
        icon: '🔴',
        title: 'Risques élevés',
        text: 'Les risques identifiés sont importants. Établissez un plan de mitigation et identifiez des alternatives.',
        dimension: 'risk'
      });
    }

    // Effort élevé
    if (effort >= 75) {
      recommendations.push({
        type: 'danger',
        icon: '🔴',
        title: 'Effort important',
        text: 'L\'effort requis est conséquent. Planifiez en plusieurs itérations avec des jalons intermédiaires.',
        dimension: 'effort'
      });
    }

    // === WARNINGS - Spécifiques aux features (stratégiques, orientés gouvernance) ===

    // Taille moyenne → conseil de découpage produit
    if (size >= 50 && size < 75) {
      recommendations.push({
        type: 'warning',
        icon: '⚠️',
        title: 'Périmètre à structurer',
        text: 'Le périmètre est conséquent. Identifiez un MVP et envisagez un découpage en releases pour livrer de la valeur plus tôt.',
        dimension: 'size'
      });
    }

    // Complexité moyenne → conseil architecture
    if (complexity >= 50 && complexity < 75) {
      recommendations.push({
        type: 'warning',
        icon: '⚠️',
        title: 'Architecture à définir',
        text: 'Assurez-vous que l\'architecture cible est documentée et validée par l\'équipe technique avant de démarrer les développements.',
        dimension: 'complexity'
      });
    }

    // Incertitude moyenne → conseil de cadrage
    if (uncertainty >= 50 && uncertainty < 75) {
      recommendations.push({
        type: 'warning',
        icon: '⚠️',
        title: 'Cadrage à renforcer',
        text: 'Des zones restent floues. Planifiez des sessions de refinement avec les parties prenantes pour clarifier les attentes.',
        dimension: 'uncertainty'
      });
    }

    // Risque moyen → conseil de suivi
    if (risk >= 50 && risk < 75) {
      recommendations.push({
        type: 'warning',
        icon: '⚠️',
        title: 'Risques à piloter',
        text: 'Intégrez le suivi des risques dans vos cérémonies agiles (sprint review, rétrospective) et préparez des plans de contingence.',
        dimension: 'risk'
      });
    }

    // Effort moyen → conseil de staffing
    if (effort >= 50 && effort < 75) {
      recommendations.push({
        type: 'warning',
        icon: '⚠️',
        title: 'Capacité à anticiper',
        text: 'Vérifiez que les ressources nécessaires sont disponibles et planifiées. Anticipez les besoins en compétences spécifiques.',
        dimension: 'effort'
      });
    }

    // Conseil feature sans US (en mode feature-only)
    const childUS = this.getUserStoriesForFeature(estimation.id);
    if (estimation.complexityMode !== 'sum-us' && childUS.length === 0) {
      recommendations.push({
        type: 'info',
        icon: 'ℹ️',
        title: 'Pas encore de User Stories',
        text: 'Aucune US n\'est rattachée à cette feature. Pensez à la décomposer en user stories pour faciliter le suivi et l\'estimation.'
      });
    }

    // Message positif
    if (recommendations.filter(r => r.type === 'danger' || r.type === 'warning').length === 0) {
      if (avg <= 25) {
        recommendations.push({
          type: 'success',
          icon: '✅',
          title: 'Feature bien calibrée',
          text: 'Cette feature est maîtrisée sur tous les axes. L\'équipe peut planifier son développement sereinement.'
        });
      } else if (avg <= 40) {
        recommendations.push({
          type: 'success',
          icon: '👍',
          title: 'Bonne maîtrise',
          text: 'Les indicateurs sont globalement favorables. Restez vigilants sur les points de friction éventuels.'
        });
      }
    }
  }

  /**
   * Ajoute les recommandations spécifiques aux User Stories
   */
  private addUserStoryRecommendations(
    recommendations: Recommendation[],
    estimation: Estimation,
    avg: number
  ): void {
    const { size, complexity, uncertainty, risk, effort } = estimation;

    // === ERREURS (DANGER) ===

    if (size >= 75) {
      recommendations.push({
        type: 'danger',
        icon: '🔴',
        title: 'User Story trop grande',
        text: 'Cette US est trop volumineuse pour un sprint. Découpez-la en plusieurs stories indépendantes (INVEST) pour faciliter le suivi.',
        dimension: 'size'
      });
    }

    if (complexity >= 75) {
      recommendations.push({
        type: 'danger',
        icon: '🔴',
        title: 'Complexité élevée',
        text: 'La complexité technique est trop importante. Prévoyez un spike ou du mob programming pour explorer les solutions.',
        dimension: 'complexity'
      });
    }

    if (uncertainty >= 75) {
      recommendations.push({
        type: 'danger',
        icon: '🔴',
        title: 'Forte incertitude',
        text: 'Trop d\'inconnues persistent. Clarifiez avec le Product Owner et les experts métier avant de vous engager.',
        dimension: 'uncertainty'
      });
    }

    if (risk >= 75) {
      recommendations.push({
        type: 'danger',
        icon: '🔴',
        title: 'Risque élevé',
        text: 'Les risques sont significatifs. Définissez un plan de mitigation et prévoyez des solutions de fallback.',
        dimension: 'risk'
      });
    }

    if (effort >= 75) {
      recommendations.push({
        type: 'danger',
        icon: '🔴',
        title: 'Effort conséquent',
        text: 'L\'effort requis est important. Envisagez de répartir le travail ou de découper cette US.',
        dimension: 'effort'
      });
    }

    // === WARNINGS ===

    if (size >= 50 && size < 75) {
      recommendations.push({
        type: 'warning',
        icon: '⚠️',
        title: 'Taille modérée',
        text: 'La taille est notable. Identifiez les sous-tâches techniques pour mieux répartir le travail.',
        dimension: 'size'
      });
    }

    if (complexity >= 50 && complexity < 75) {
      recommendations.push({
        type: 'warning',
        icon: '⚠️',
        title: 'Complexité technique',
        text: 'Assurez-vous que l\'équipe maîtrise les technologies impliquées. Le pair programming pourrait aider.',
        dimension: 'complexity'
      });
    }

    if (uncertainty >= 50 && uncertainty < 75) {
      recommendations.push({
        type: 'warning',
        icon: '⚠️',
        title: 'Incertitude modérée',
        text: 'Certains aspects restent flous. Validez les hypothèses clés avec le PO avant de coder.',
        dimension: 'uncertainty'
      });
    }

    if (risk >= 50 && risk < 75) {
      recommendations.push({
        type: 'warning',
        icon: '⚠️',
        title: 'Risques à surveiller',
        text: 'Des risques ont été identifiés. Surveillez-les régulièrement et préparez des alternatives.',
        dimension: 'risk'
      });
    }

    if (effort >= 50 && effort < 75) {
      recommendations.push({
        type: 'warning',
        icon: '⚠️',
        title: 'Effort notable',
        text: 'Prévoyez suffisamment de temps et évitez de surcharger le sprint avec d\'autres tâches complexes.',
        dimension: 'effort'
      });
    }

    // US orpheline
    if (!estimation.parentFeatureId) {
      recommendations.push({
        type: 'info',
        icon: 'ℹ️',
        title: 'US sans feature parente',
        text: 'Cette user story n\'est rattachée à aucune feature. Envisagez de la lier pour une meilleure organisation du backlog.'
      });
    }

    // Message positif
    if (recommendations.filter(r => r.type === 'danger' || r.type === 'warning').length === 0) {
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
          text: 'Les indicateurs sont globalement favorables. Restez vigilants sur les points de friction éventuels.'
        });
      }
    }
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
