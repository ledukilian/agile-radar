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
  StickyNote,
  DrawingStroke,
  DEFAULT_BOARD,
  DEFAULT_SPRINT,
  DEFAULT_STICKY_NOTE,
  STICKY_NOTE_COLORS
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
   * Supprime un sprint (les éléments restent à leur position)
   */
  deleteSprint(id: string): void {
    const board = this.boardSubject.value;
    this.updateBoard({
      sprints: board.sprints.filter(s => s.id !== id)
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
  setPosition(estimationId: string, position: { x: number; y: number }): void {
    const board = this.boardSubject.value;
    const existingIndex = board.positions.findIndex(p => p.estimationId === estimationId);

    const newPosition: PlanningPosition = {
      estimationId,
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
    this.setPosition(estimationId, position);
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
   * Vérifie si une position est à l'intérieur d'un sprint (basé sur le centre de l'item)
   */
  isPositionInSprint(position: { x: number; y: number }, sprint: Sprint, itemWidth = 120, itemHeight = 80): boolean {
    // Calculer le centre de l'item
    const centerX = position.x + itemWidth / 2;
    const centerY = position.y + itemHeight / 2;
    
    // Zone du sprint (avec une marge pour le header)
    const sprintHeaderHeight = 50;
    const sprintLeft = sprint.position.x;
    const sprintTop = sprint.position.y + sprintHeaderHeight;
    const sprintRight = sprint.position.x + sprint.width;
    const sprintBottom = sprint.position.y + sprint.height;
    
    return centerX >= sprintLeft && centerX <= sprintRight &&
           centerY >= sprintTop && centerY <= sprintBottom;
  }

  /**
   * Trouve le sprint qui contient une position donnée
   */
  findSprintAtPosition(position: { x: number; y: number }): Sprint | null {
    const sprints = this.boardSubject.value.sprints;
    return sprints.find(sprint => this.isPositionInSprint(position, sprint)) || null;
  }

  /**
   * Retourne les éléments d'un sprint (détection par zone)
   */
  getSprintItems(sprintId: string): Estimation[] {
    const sprint = this.getSprint(sprintId);
    if (!sprint) return [];
    
    const positions = this.boardSubject.value.positions.filter(p => 
      this.isPositionInSprint(p.position, sprint)
    );
    const estimations = this.estimationService.getAllEstimations();
    
    return positions
      .map(p => estimations.find(e => e.id === p.estimationId))
      .filter((e): e is Estimation => e !== undefined);
  }

  /**
   * Retourne les éléments d'un sprint avec leurs positions (détection par zone)
   */
  getSprintItemsWithPositions(sprintId: string): { estimation: Estimation; position: PlanningPosition }[] {
    const sprint = this.getSprint(sprintId);
    if (!sprint) return [];
    
    const positions = this.boardSubject.value.positions.filter(p => 
      this.isPositionInSprint(p.position, sprint)
    );
    const estimations = this.estimationService.getAllEstimations();
    
    return positions
      .map(p => {
        const estimation = estimations.find(e => e.id === p.estimationId);
        return estimation ? { estimation, position: p } : null;
      })
      .filter((item): item is { estimation: Estimation; position: PlanningPosition } => item !== null);
  }

  /**
   * Retourne le sprint qui contient un élément donné
   */
  getSprintForItem(estimationId: string): string | null {
    const position = this.getPosition(estimationId);
    if (!position) return null;
    
    const sprint = this.findSprintAtPosition(position.position);
    return sprint?.id || null;
  }

  /**
   * Retourne les éléments qui ne sont dans aucun sprint
   */
  getItemsOutsideSprints(): { estimation: Estimation; position: PlanningPosition }[] {
    const board = this.boardSubject.value;
    const estimations = this.estimationService.getAllEstimations();
    
    return board.positions
      .filter(p => !this.findSprintAtPosition(p.position))
      .map(p => {
        const estimation = estimations.find(e => e.id === p.estimationId);
        return estimation ? { estimation, position: p } : null;
      })
      .filter((item): item is { estimation: Estimation; position: PlanningPosition } => item !== null);
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

    // Trouver les sprints contenant chaque élément
    const sourceSprint = this.findSprintAtPosition(sourcePos.position);
    const targetSprint = this.findSprintAtPosition(targetPos.position);

    // Si dans le même sprint ou pas dans un sprint, on considère OK
    if (sourceSprint?.id === targetSprint?.id) return true;

    // Sinon, il faudrait comparer l'ordre des sprints (basé sur les dates)
    // Pour simplifier, on considère résolu si les deux sont dans des sprints
    return sourceSprint !== null && targetSprint !== null;
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

  // ==================== STICKY NOTES ====================

  /**
   * Retourne tous les sticky notes
   */
  getStickyNotes(): StickyNote[] {
    return this.boardSubject.value.stickyNotes || [];
  }

  /**
   * Retourne un sticky note par son ID
   */
  getStickyNote(id: string): StickyNote | undefined {
    return (this.boardSubject.value.stickyNotes || []).find(s => s.id === id);
  }

  /**
   * Crée un nouveau sticky note
   */
  createStickyNote(note?: Partial<Omit<StickyNote, 'id' | 'createdAt' | 'updatedAt'>>): StickyNote {
    const defaultColor = STICKY_NOTE_COLORS[0];
    const newNote: StickyNote = {
      ...DEFAULT_STICKY_NOTE,
      position: { x: 200, y: 200 },
      ...note,
      id: this.generateId(),
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const board = this.boardSubject.value;
    this.updateBoard({
      stickyNotes: [...(board.stickyNotes || []), newNote]
    });

    return newNote;
  }

  /**
   * Met à jour un sticky note existant
   */
  updateStickyNote(id: string, updates: Partial<Omit<StickyNote, 'id' | 'createdAt'>>): StickyNote | null {
    const board = this.boardSubject.value;
    const stickyNotes = board.stickyNotes || [];
    const index = stickyNotes.findIndex(s => s.id === id);
    
    if (index === -1) return null;

    const updatedNote = {
      ...stickyNotes[index],
      ...updates,
      updatedAt: new Date()
    };

    const newStickyNotes = [...stickyNotes];
    newStickyNotes[index] = updatedNote;
    
    this.updateBoard({ stickyNotes: newStickyNotes });
    return updatedNote;
  }

  /**
   * Supprime un sticky note
   */
  deleteStickyNote(id: string): void {
    const board = this.boardSubject.value;
    this.updateBoard({
      stickyNotes: (board.stickyNotes || []).filter(s => s.id !== id)
    });
  }

  /**
   * Déplace un sticky note
   */
  moveStickyNote(id: string, position: { x: number; y: number }): void {
    this.updateStickyNote(id, { position });
  }

  // ==================== DRAWINGS ====================

  /**
   * Retourne tous les dessins
   */
  getDrawings(): DrawingStroke[] {
    return this.boardSubject.value.drawings || [];
  }

  /**
   * Ajoute un nouveau trait de dessin
   */
  addDrawingStroke(stroke: Omit<DrawingStroke, 'id' | 'createdAt'>): DrawingStroke {
    const newStroke: DrawingStroke = {
      ...stroke,
      id: this.generateId(),
      createdAt: new Date()
    };

    const board = this.boardSubject.value;
    this.updateBoard({
      drawings: [...(board.drawings || []), newStroke]
    });

    return newStroke;
  }

  /**
   * Supprime un trait de dessin
   */
  deleteDrawingStroke(id: string): void {
    const board = this.boardSubject.value;
    this.updateBoard({
      drawings: (board.drawings || []).filter(d => d.id !== id)
    });
  }

  /**
   * Supprime tous les dessins
   */
  clearAllDrawings(): void {
    this.updateBoard({ drawings: [] });
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
        // Migration: ajouter les nouvelles propriétés si elles n'existent pas
        if (!board.stickyNotes) {
          board.stickyNotes = [];
        } else {
          board.stickyNotes = board.stickyNotes.map((n: any) => ({
            ...n,
            createdAt: new Date(n.createdAt),
            updatedAt: new Date(n.updatedAt)
          }));
        }
        if (!board.drawings) {
          board.drawings = [];
        } else {
          board.drawings = board.drawings.map((d: any) => ({
            ...d,
            createdAt: new Date(d.createdAt)
          }));
        }
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
