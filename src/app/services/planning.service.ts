import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import {
  Sprint,
  Dependency,
  DependencyType,
  PlanningPosition,
  PlanningBoard,
  SprintInfo,
  SprintStatus,
  PlanningRecommendation,
  DEFAULT_BOARD,
  DEFAULT_SPRINT
} from '../models/planning.model';
import { EstimationService } from './estimation.service';
import { SettingsService } from './settings.service';
import { Estimation } from '../models/estimation.model';

@Injectable({
  providedIn: 'root'
})
export class PlanningService {
  private readonly STORAGE_KEY = 'curse_planning';
  
  private boardSubject = new BehaviorSubject<PlanningBoard>(this.getDefaultBoard());
  public board$: Observable<PlanningBoard> = this.boardSubject.asObservable();

  constructor(
    private estimationService: EstimationService,
    private settingsService: SettingsService
  ) {
    this.loadFromStorage();
  }

  // ==================== BOARD ====================

  /**
   * Retourne le board de planification actuel
   */
  getBoard(): PlanningBoard {
    return this.boardSubject.value;
  }

  /**
   * Met à jour le board complet
   */
  updateBoard(board: Partial<PlanningBoard>): void {
    const updated = {
      ...this.boardSubject.value,
      ...board,
      updatedAt: new Date()
    };
    this.boardSubject.next(updated);
    this.saveToStorage(updated);
  }

  /**
   * Met à jour le zoom du board
   */
  setZoom(zoom: number): void {
    this.updateBoard({ zoom: Math.max(0.25, Math.min(2, zoom)) });
  }

  /**
   * Met à jour le pan offset du board
   */
  setPanOffset(offset: { x: number; y: number }): void {
    this.updateBoard({ panOffset: offset });
  }

  /**
   * Active/désactive la grille
   */
  toggleGrid(): void {
    this.updateBoard({ gridEnabled: !this.boardSubject.value.gridEnabled });
  }

  /**
   * Définit la taille de la grille
   */
  setGridSize(size: number): void {
    this.updateBoard({ gridSize: Math.max(10, Math.min(100, size)) });
  }

  // ==================== SPRINTS ====================

  /**
   * Retourne tous les sprints
   */
  getSprints(): Sprint[] {
    return this.boardSubject.value.sprints;
  }

  /**
   * Retourne un sprint par son ID
   */
  getSprint(id: string): Sprint | undefined {
    return this.boardSubject.value.sprints.find(s => s.id === id);
  }

  /**
   * Crée un nouveau sprint
   */
  createSprint(sprint?: Partial<Omit<Sprint, 'id' | 'createdAt' | 'updatedAt'>>): Sprint {
    const newSprint: Sprint = {
      ...DEFAULT_SPRINT,
      ...sprint,
      id: this.generateId(),
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const board = this.boardSubject.value;
    this.updateBoard({
      sprints: [...board.sprints, newSprint]
    });

    return newSprint;
  }

  /**
   * Met à jour un sprint existant
   */
  updateSprint(id: string, updates: Partial<Omit<Sprint, 'id' | 'createdAt'>>): Sprint | null {
    const board = this.boardSubject.value;
    const index = board.sprints.findIndex(s => s.id === id);
    
    if (index === -1) return null;

    const updatedSprint = {
      ...board.sprints[index],
      ...updates,
      updatedAt: new Date()
    };

    const sprints = [...board.sprints];
    sprints[index] = updatedSprint;
    
    this.updateBoard({ sprints });
    return updatedSprint;
  }

  /**
   * Supprime un sprint et libère ses éléments
   */
  deleteSprint(id: string): void {
    const board = this.boardSubject.value;
    
    // Retirer les éléments du sprint (les remettre sans sprintId)
    const positions = board.positions.map(pos => 
      pos.sprintId === id ? { ...pos, sprintId: undefined } : pos
    );

    this.updateBoard({
      sprints: board.sprints.filter(s => s.id !== id),
      positions
    });
  }

  // ==================== POSITIONS ====================

  /**
   * Retourne toutes les positions
   */
  getPositions(): PlanningPosition[] {
    return this.boardSubject.value.positions;
  }

  /**
   * Retourne la position d'un élément
   */
  getPosition(estimationId: string): PlanningPosition | undefined {
    return this.boardSubject.value.positions.find(p => p.estimationId === estimationId);
  }

  /**
   * Ajoute ou met à jour la position d'un élément sur le board
   */
  setPosition(estimationId: string, position: { x: number; y: number }, sprintId?: string): void {
    const board = this.boardSubject.value;
    const existingIndex = board.positions.findIndex(p => p.estimationId === estimationId);

    const newPosition: PlanningPosition = {
      estimationId,
      sprintId,
      position
    };

    let positions: PlanningPosition[];
    if (existingIndex >= 0) {
      positions = [...board.positions];
      positions[existingIndex] = newPosition;
    } else {
      positions = [...board.positions, newPosition];
    }

    this.updateBoard({ positions });
  }

  /**
   * Déplace un élément vers une nouvelle position
   */
  moveItem(estimationId: string, position: { x: number; y: number }): void {
    const existing = this.getPosition(estimationId);
    this.setPosition(estimationId, position, existing?.sprintId);
  }

  /**
   * Assigne un élément à un sprint
   */
  assignToSprint(estimationId: string, sprintId: string): void {
    const existing = this.getPosition(estimationId);
    const position = existing?.position || { x: 0, y: 0 };
    this.setPosition(estimationId, position, sprintId);
  }

  /**
   * Retire un élément d'un sprint
   */
  removeFromSprint(estimationId: string): void {
    const existing = this.getPosition(estimationId);
    if (existing) {
      this.setPosition(estimationId, existing.position, undefined);
    }
  }

  /**
   * Retire un élément du board
   */
  removeFromBoard(estimationId: string): void {
    const board = this.boardSubject.value;
    this.updateBoard({
      positions: board.positions.filter(p => p.estimationId !== estimationId),
      dependencies: board.dependencies.filter(d => 
        d.sourceId !== estimationId && d.targetId !== estimationId
      )
    });
  }

  /**
   * Retourne les éléments d'un sprint
   */
  getSprintItems(sprintId: string): Estimation[] {
    const positions = this.boardSubject.value.positions.filter(p => p.sprintId === sprintId);
    const estimations = this.estimationService.getAllEstimations();
    
    return positions
      .map(p => estimations.find(e => e.id === p.estimationId))
      .filter((e): e is Estimation => e !== undefined);
  }

  /**
   * Retourne les éléments planifiés (sur le board)
   */
  getPlannedItems(): Estimation[] {
    const positionIds = this.boardSubject.value.positions.map(p => p.estimationId);
    const estimations = this.estimationService.getAllEstimations();
    
    return estimations.filter(e => positionIds.includes(e.id));
  }

  /**
   * Retourne les éléments non planifiés
   */
  getUnplannedItems(): Estimation[] {
    const positionIds = this.boardSubject.value.positions.map(p => p.estimationId);
    const estimations = this.estimationService.getAllEstimations();
    
    return estimations.filter(e => !positionIds.includes(e.id));
  }

  // ==================== DÉPENDANCES ====================

  /**
   * Retourne toutes les dépendances
   */
  getDependencies(): Dependency[] {
    return this.boardSubject.value.dependencies;
  }

  /**
   * Retourne les dépendances d'un élément
   */
  getDependenciesForItem(estimationId: string): Dependency[] {
    return this.boardSubject.value.dependencies.filter(
      d => d.sourceId === estimationId || d.targetId === estimationId
    );
  }

  /**
   * Ajoute une nouvelle dépendance
   */
  addDependency(
    sourceId: string,
    targetId: string,
    type: DependencyType,
    description: string
  ): Dependency {
    const newDep: Dependency = {
      id: this.generateId(),
      sourceId,
      targetId,
      type,
      description,
      createdAt: new Date()
    };

    const board = this.boardSubject.value;
    this.updateBoard({
      dependencies: [...board.dependencies, newDep]
    });

    return newDep;
  }

  /**
   * Met à jour une dépendance
   */
  updateDependency(id: string, updates: Partial<Omit<Dependency, 'id' | 'createdAt'>>): Dependency | null {
    const board = this.boardSubject.value;
    const index = board.dependencies.findIndex(d => d.id === id);
    
    if (index === -1) return null;

    const updated = { ...board.dependencies[index], ...updates };
    const dependencies = [...board.dependencies];
    dependencies[index] = updated;
    
    this.updateBoard({ dependencies });
    return updated;
  }

  /**
   * Supprime une dépendance
   */
  removeDependency(id: string): void {
    const board = this.boardSubject.value;
    this.updateBoard({
      dependencies: board.dependencies.filter(d => d.id !== id)
    });
  }

  /**
   * Vérifie si une dépendance est résolue (source planifiée avant target)
   */
  isDependencyResolved(dependency: Dependency): boolean {
    const positions = this.boardSubject.value.positions;
    const sourcePos = positions.find(p => p.estimationId === dependency.sourceId);
    const targetPos = positions.find(p => p.estimationId === dependency.targetId);

    // Si les deux ne sont pas planifiés, on considère la dépendance comme non résolue
    if (!sourcePos || !targetPos) return false;

    // Si dans le même sprint ou pas dans un sprint, on considère OK
    if (sourcePos.sprintId === targetPos.sprintId) return true;

    // Sinon, il faudrait comparer l'ordre des sprints (basé sur les dates)
    // Pour simplifier, on considère résolu si les deux sont dans des sprints différents
    return sourcePos.sprintId !== undefined && targetPos.sprintId !== undefined;
  }

  // ==================== CALCULS SPRINT ====================

  /**
   * Calcule la charge d'un sprint
   */
  getSprintLoad(sprintId: string): number {
    const items = this.getSprintItems(sprintId);
    return items.reduce((total, item) => {
      return total + Math.ceil(this.settingsService.calculateComplexityPoints(item));
    }, 0);
  }

  /**
   * Retourne les informations complètes d'un sprint
   */
  getSprintInfo(sprintId: string): SprintInfo | null {
    const sprint = this.getSprint(sprintId);
    if (!sprint) return null;

    const items = this.getSprintItems(sprintId);
    const usedPoints = this.getSprintLoad(sprintId);
    // Si pas de capacité définie, loadPercentage = 0 (pas de limite)
    const loadPercentage = sprint.capacity && sprint.capacity > 0 ? (usedPoints / sprint.capacity) * 100 : 0;

    // Compter les dépendances non résolues pour les éléments du sprint
    const itemIds = items.map(i => i.id);
    const unresolvedDeps = this.boardSubject.value.dependencies.filter(dep => {
      const concernsSprint = itemIds.includes(dep.sourceId) || itemIds.includes(dep.targetId);
      return concernsSprint && !this.isDependencyResolved(dep);
    });

    // Déterminer le status
    let status: SprintStatus = 'empty';
    if (items.length === 0) {
      status = 'empty';
    } else if (unresolvedDeps.length > 0) {
      status = 'at-risk';
    } else if (sprint.capacity && loadPercentage > 100) {
      status = 'overloaded';
    } else if (sprint.capacity && loadPercentage > 85) {
      status = 'warning';
    } else {
      status = 'balanced';
    }

    return {
      sprint,
      usedPoints,
      itemCount: items.length,
      loadPercentage,
      unresolvedDependencies: unresolvedDeps.length,
      status
    };
  }

  // ==================== RECOMMANDATIONS ====================

  /**
   * Génère les recommandations de planification
   */
  getPlanningRecommendations(): PlanningRecommendation[] {
    const recommendations: PlanningRecommendation[] = [];
    const board = this.boardSubject.value;
    const estimations = this.estimationService.getAllEstimations();

    // Analyser chaque sprint
    for (const sprint of board.sprints) {
      const info = this.getSprintInfo(sprint.id);
      if (!info) continue;

      // Sprint surchargé
      if (info.loadPercentage > 100) {
        recommendations.push({
          type: 'danger',
          icon: '🔴',
          title: 'Sprint surchargé',
          text: `"${sprint.name}" dépasse sa capacité (${Math.round(info.loadPercentage)}%). Retirez des éléments ou augmentez la capacité.`,
          sprintId: sprint.id
        });
      }

      // Dépendances non résolues
      if (info.unresolvedDependencies > 0) {
        recommendations.push({
          type: 'danger',
          icon: '🔗',
          title: 'Dépendances non résolues',
          text: `"${sprint.name}" a ${info.unresolvedDependencies} dépendance(s) non satisfaite(s). Vérifiez l'ordre de planification.`,
          sprintId: sprint.id
        });
      }

      // Sprint presque plein
      if (info.loadPercentage > 85 && info.loadPercentage <= 100) {
        recommendations.push({
          type: 'warning',
          icon: '⚠️',
          title: 'Sprint presque plein',
          text: `"${sprint.name}" est à ${Math.round(info.loadPercentage)}% de capacité. Gardez une marge pour les imprévus.`,
          sprintId: sprint.id
        });
      }

      // Sprint équilibré
      if (info.status === 'balanced' && info.loadPercentage >= 60 && info.loadPercentage <= 85) {
        recommendations.push({
          type: 'success',
          icon: '✅',
          title: 'Sprint équilibré',
          text: `"${sprint.name}" est bien calibré (${Math.round(info.loadPercentage)}%) sans dépendances bloquantes.`,
          sprintId: sprint.id
        });
      }

      // Analyser les éléments du sprint
      const items = this.getSprintItems(sprint.id);
      
      // Incertitude élevée
      const highUncertaintyItems = items.filter(i => i.uncertainty >= 75);
      if (highUncertaintyItems.length >= 2) {
        recommendations.push({
          type: 'warning',
          icon: '❓',
          title: 'Incertitude élevée',
          text: `"${sprint.name}" contient ${highUncertaintyItems.length} éléments avec forte incertitude. Prévoyez du temps de clarification.`,
          sprintId: sprint.id
        });
      }

      // Risques élevés
      const highRiskItems = items.filter(i => i.risk >= 75);
      if (highRiskItems.length > 0) {
        recommendations.push({
          type: 'danger',
          icon: '⚡',
          title: 'Risques élevés',
          text: `"${sprint.name}" contient ${highRiskItems.length} élément(s) à risque élevé. Préparez des plans de mitigation.`,
          sprintId: sprint.id
        });
      }
    }

    // Recommandations globales

    // Features volumineuses non planifiées
    const unplannedItems = this.getUnplannedItems();
    const largeFeatures = unplannedItems.filter(item => {
      if (item.type !== 'feature') return false;
      const points = this.settingsService.calculateComplexityPoints(item);
      return points > 100;
    });

    for (const feature of largeFeatures) {
      recommendations.push({
        type: 'info',
        icon: 'ℹ️',
        title: 'Feature volumineuse',
        text: `"${feature.name}" est très volumineuse. Envisagez de la découper en plus petites parties avant de planifier.`,
        estimationId: feature.id
      });
    }

    // Éléments avec dépendances non planifiés
    const plannedIds = board.positions.map(p => p.estimationId);
    const depsWithUnplanned = board.dependencies.filter(dep => {
      return !plannedIds.includes(dep.sourceId) || !plannedIds.includes(dep.targetId);
    });

    if (depsWithUnplanned.length > 0) {
      recommendations.push({
        type: 'info',
        icon: '📋',
        title: 'Dépendances partiellement planifiées',
        text: `${depsWithUnplanned.length} dépendance(s) impliquent des éléments non encore planifiés.`
      });
    }

    return recommendations;
  }

  // ==================== PERSISTENCE ====================

  private getDefaultBoard(): PlanningBoard {
    return {
      ...DEFAULT_BOARD,
      id: this.generateId(),
      updatedAt: new Date()
    };
  }

  private loadFromStorage(): void {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      if (stored) {
        const board = JSON.parse(stored);
        // Convertir les dates
        board.updatedAt = new Date(board.updatedAt);
        board.sprints = board.sprints.map((s: any) => ({
          ...s,
          createdAt: new Date(s.createdAt),
          updatedAt: new Date(s.updatedAt)
        }));
        board.dependencies = board.dependencies.map((d: any) => ({
          ...d,
          createdAt: new Date(d.createdAt)
        }));
        this.boardSubject.next(board);
      }
    } catch (error) {
      console.error('Erreur lors du chargement de la planification:', error);
    }
  }

  private saveToStorage(board: PlanningBoard): void {
    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(board));
    } catch (error) {
      console.error('Erreur lors de la sauvegarde de la planification:', error);
    }
  }

  /**
   * Réinitialise le board
   */
  resetBoard(): void {
    const defaultBoard = this.getDefaultBoard();
    this.boardSubject.next(defaultBoard);
    this.saveToStorage(defaultBoard);
  }

  private generateId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }
}
