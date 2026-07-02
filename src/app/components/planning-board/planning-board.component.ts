import { Component, OnInit, OnDestroy, ElementRef, ViewChild, HostListener, ChangeDetectorRef, CUSTOM_ELEMENTS_SCHEMA, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';
import interact from 'interactjs';

import { PlanningService } from '../../services/planning.service';
import { EstimationService } from '../../services/estimation.service';
import { SettingsService } from '../../services/settings.service';
import { 
  PlanningBoard, 
  Sprint, 
  PlanningPosition, 
  Dependency,
  SprintInfo,
  StickyNote,
  DrawingStroke,
  DrawingPoint,
  DrawingSettings,
  DEFAULT_DRAWING_SETTINGS
} from '../../models/planning.model';
import { Estimation, TShirtSize } from '../../models/estimation.model';

import { SprintCardComponent } from '../sprint-card/sprint-card.component';
import { PlanningItemCardComponent } from '../planning-item-card/planning-item-card.component';
import { DependencyLineComponent } from '../dependency-line/dependency-line.component';
import { PlanningSidebarComponent } from '../planning-sidebar/planning-sidebar.component';
import { PlanningRecommendationsComponent } from '../planning-recommendations/planning-recommendations.component';
import { StickyNoteCardComponent } from '../sticky-note-card/sticky-note-card.component';

@Component({
  selector: 'app-planning-board',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    SprintCardComponent,
    PlanningItemCardComponent,
    DependencyLineComponent,
    PlanningSidebarComponent,
    PlanningRecommendationsComponent,
    StickyNoteCardComponent
  ],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  templateUrl: './planning-board.component.html',
  styleUrl: './planning-board.component.scss'
})
export class PlanningBoardComponent implements OnInit, OnDestroy {
  @ViewChild('boardContainer') boardContainer!: ElementRef<HTMLDivElement>;
  @ViewChild('canvas') canvas!: ElementRef<HTMLDivElement>;
  
  @Output() navigateToEstimation = new EventEmitter<void>();

  board!: PlanningBoard;
  estimations: Estimation[] = [];
  
  // État de l'interface
  isPanning = false;
  panStart = { x: 0, y: 0 };
  activePanel: 'backlog' | 'sprint' | 'recommendations' | null = 'backlog';
  showAddMenu = false;
  isCreatingDependency = false;
  dependencySource: string | null = null;
  showFeatures = true;
  showUserStories = true;
  showMetrics = true;
  
  // Mode création sprint
  isCreatingSprint = false;
  newSprintStart: { x: number; y: number } | null = null;
  newSprintCurrent: { x: number; y: number } | null = null;
  
  // Mode dessin
  isDrawingMode = false;
  isCurrentlyDrawing = false;
  isEraserMode = false;
  currentStroke: DrawingPoint[] = [];
  drawingSettings: DrawingSettings = { ...DEFAULT_DRAWING_SETTINGS };
  showDrawingSettings = false;

  private subscriptions: Subscription[] = [];

  constructor(
    public planningService: PlanningService,
    private estimationService: EstimationService,
    private settingsService: SettingsService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    // Charger le board
    this.subscriptions.push(
      this.planningService.board$.subscribe(board => {
        this.board = board;
        this.cdr.detectChanges();
      })
    );

    // Charger les estimations
    this.subscriptions.push(
      this.estimationService.estimations$.subscribe(estimations => {
        this.estimations = estimations;
        this.cdr.detectChanges();
      })
    );
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(s => s.unsubscribe());
  }

  // ==================== ZOOM & PAN ====================

  @HostListener('wheel', ['$event'])
  onWheel(event: WheelEvent): void {
    // Vérifier qu'on n'est pas sur un élément scrollable (sidebar, recommendations)
    const target = event.target as HTMLElement;
    if (target.closest('.floating-sidebar, .floating-recommendations')) {
      return;
    }
    
    event.preventDefault();
    
    // Zoom plus précis et fluide
    const delta = event.deltaY > 0 ? -0.05 : 0.05;
    const newZoom = Math.max(0.25, Math.min(3, this.board.zoom + delta));
    
    // Zoomer vers le curseur
    if (this.boardContainer) {
      const rect = this.boardContainer.nativeElement.getBoundingClientRect();
      const mouseX = event.clientX - rect.left;
      const mouseY = event.clientY - rect.top;
      
      // Calculer le nouveau pan offset pour garder le point sous le curseur
      const zoomRatio = newZoom / this.board.zoom;
      const newPanX = mouseX - (mouseX - this.board.panOffset.x) * zoomRatio;
      const newPanY = mouseY - (mouseY - this.board.panOffset.y) * zoomRatio;
      
      this.planningService.setPanOffset({ x: newPanX, y: newPanY });
    }
    
    this.setZoom(newZoom);
  }

  setZoom(zoom: number): void {
    this.planningService.setZoom(zoom);
  }

  zoomIn(): void {
    this.setZoom(this.board.zoom + 0.1);
  }

  zoomOut(): void {
    this.setZoom(this.board.zoom - 0.1);
  }

  resetZoom(): void {
    this.setZoom(1);
    this.planningService.setPanOffset({ x: 0, y: 0 });
  }

  onPanStart(event: MouseEvent): void {
    // Ne pas démarrer le pan si on clique sur un élément interactif
    if ((event.target as HTMLElement).closest('.planning-item, .sprint-card, .sidebar, .recommendations, .sticky-note-card')) {
      return;
    }
    
    // Mode création sprint
    if (this.isCreatingSprint) {
      const rect = this.boardContainer.nativeElement.getBoundingClientRect();
      this.newSprintStart = {
        x: (event.clientX - rect.left - this.board.panOffset.x) / this.board.zoom,
        y: (event.clientY - rect.top - this.board.panOffset.y) / this.board.zoom
      };
      this.newSprintCurrent = { ...this.newSprintStart };
      return;
    }

    this.isPanning = true;
    this.panStart = {
      x: event.clientX - this.board.panOffset.x,
      y: event.clientY - this.board.panOffset.y
    };
  }

  onPanMove(event: MouseEvent): void {
    if (this.isCreatingSprint && this.newSprintStart) {
      const rect = this.boardContainer.nativeElement.getBoundingClientRect();
      this.newSprintCurrent = {
        x: (event.clientX - rect.left - this.board.panOffset.x) / this.board.zoom,
        y: (event.clientY - rect.top - this.board.panOffset.y) / this.board.zoom
      };
      return;
    }

    if (!this.isPanning) return;
    
    this.planningService.setPanOffset({
      x: event.clientX - this.panStart.x,
      y: event.clientY - this.panStart.y
    });
  }

  onPanEnd(event: MouseEvent): void {
    if (this.isCreatingSprint && this.newSprintStart && this.newSprintCurrent) {
      // Créer le sprint
      const x = Math.min(this.newSprintStart.x, this.newSprintCurrent.x);
      const y = Math.min(this.newSprintStart.y, this.newSprintCurrent.y);
      const width = Math.abs(this.newSprintCurrent.x - this.newSprintStart.x);
      const height = Math.abs(this.newSprintCurrent.y - this.newSprintStart.y);

      if (width > 50 && height > 50) {
        this.planningService.createSprint({
          position: { x, y },
          width: Math.max(200, width),
          height: Math.max(150, height)
        });
      }

      this.newSprintStart = null;
      this.newSprintCurrent = null;
      this.isCreatingSprint = false;
      return;
    }

    this.isPanning = false;
  }

  // ==================== GRILLE ====================

  toggleGrid(): void {
    this.planningService.toggleGrid();
  }

  toggleFeatures(): void {
    this.showFeatures = !this.showFeatures;
  }

  toggleUserStories(): void {
    this.showUserStories = !this.showUserStories;
  }

  toggleMetrics(): void {
    this.showMetrics = !this.showMetrics;
  }

  snapToGrid(position: { x: number; y: number }): { x: number; y: number } {
    if (!this.board.gridEnabled) return position;
    
    return {
      x: Math.round(position.x / this.board.gridSize) * this.board.gridSize,
      y: Math.round(position.y / this.board.gridSize) * this.board.gridSize
    };
  }

  // ==================== SPRINTS ====================

  startCreatingSprint(): void {
    this.isCreatingSprint = true;
  }

  cancelCreatingSprint(): void {
    this.isCreatingSprint = false;
    this.newSprintStart = null;
    this.newSprintCurrent = null;
  }

  createQuickSprint(): void {
    // Créer un sprint à une position par défaut
    const existingSprints = this.board.sprints.length;
    // Espacement adapté pour les grands écrans
    const sprintWidth = 500;
    const sprintHeight = 400;
    const gap = 50;
    
    this.planningService.createSprint({
      name: `Sprint ${existingSprints + 1}`,
      position: { 
        x: 100 + (existingSprints % 3) * (sprintWidth + gap), 
        y: 100 + Math.floor(existingSprints / 3) * (sprintHeight + gap) 
      },
      width: sprintWidth,
      height: sprintHeight
    });
  }

  onSprintMoved(sprintId: string, position: { x: number; y: number }): void {
    this.planningService.updateSprint(sprintId, { position });
  }

  onSprintResized(sprintId: string, size: { width: number; height: number }): void {
    this.planningService.updateSprint(sprintId, size);
  }

  onSprintUpdated(sprintId: string, updates: Partial<Sprint>): void {
    this.planningService.updateSprint(sprintId, updates);
  }

  onSprintDeleted(sprintId: string): void {
    this.planningService.deleteSprint(sprintId);
  }

  getSprintInfo(sprintId: string): SprintInfo | null {
    return this.planningService.getSprintInfo(sprintId);
  }

  // ==================== ITEMS ====================

  /**
   * Retourne tous les items sur le board avec leurs positions
   */
  getAllItems(): { estimation: Estimation; position: PlanningPosition }[] {
    return this.board.positions
      .map(pos => {
        const estimation = this.estimations.find(e => e.id === pos.estimationId);
        return estimation ? { estimation, position: pos } : null;
      })
      .filter((item): item is { estimation: Estimation; position: PlanningPosition } => item !== null)
      .filter(item => {
        if (item.estimation.type === 'feature') {
          return this.showFeatures;
        }
        if (item.estimation.type === 'user-story') {
          return this.showUserStories;
        }
        return true; // Si pas de type, on affiche par défaut
      });
  }

  /**
   * Retourne les items dans un sprint (pour le calcul des stats)
   */
  getItemsInSprint(sprintId: string): { estimation: Estimation; position: PlanningPosition }[] {
    return this.planningService.getSprintItemsWithPositions(sprintId);
  }

  onItemMoved(estimationId: string, position: { x: number; y: number }): void {
    this.planningService.moveItem(estimationId, position);
  }

  onItemAddedToBoard(estimationId: string, position: { x: number; y: number }): void {
    this.planningService.setPosition(estimationId, position);
  }

  onItemRemovedFromBoard(estimationId: string): void {
    this.planningService.removeFromBoard(estimationId);
  }

  // ==================== DÉPENDANCES ====================

  startCreatingDependency(sourceId: string): void {
    this.isCreatingDependency = true;
    this.dependencySource = sourceId;
  }

  cancelCreatingDependency(): void {
    this.isCreatingDependency = false;
    this.dependencySource = null;
  }

  onDependencyTargetSelected(targetId: string): void {
    if (!this.dependencySource || this.dependencySource === targetId) {
      this.cancelCreatingDependency();
      return;
    }
    
    this.planningService.addDependency(
      this.dependencySource,
      targetId,
      'depends-on',
      'Dépendance à préciser'
    );
    
    this.cancelCreatingDependency();
  }

  onDependencyDeleted(dependencyId: string): void {
    this.planningService.removeDependency(dependencyId);
  }

  onDependencyUpdated(dependencyId: string, updates: Partial<Dependency>): void {
    this.planningService.updateDependency(dependencyId, updates);
  }

  getItemPosition(estimationId: string): { x: number; y: number } | null {
    const pos = this.board.positions.find(p => p.estimationId === estimationId);
    return pos?.position || null;
  }

  // ==================== UI ====================

  setActivePanel(panel: 'backlog' | 'sprint' | 'recommendations'): void {
    this.activePanel = this.activePanel === panel ? null : panel;
  }

  goToEstimation(): void {
    this.navigateToEstimation.emit();
  }

  getEstimation(id: string): Estimation | undefined {
    return this.estimations.find(e => e.id === id);
  }

  // ==================== SPRINT SUMMARY ====================

  /**
   * Retourne le nombre total d'éléments planifiés sur le board
   */
  getTotalPlannedItems(): number {
    return this.board.positions.length;
  }

  /**
   * Retourne le total des points planifiés
   */
  getTotalPlannedPoints(): number {
    return this.getAllItems().reduce((sum, item) => {
      return sum + this.getEstimationPoints(item.estimation);
    }, 0);
  }

  /**
   * Retourne les points d'une estimation
   */
  getEstimationPoints(estimation: Estimation): number {
    return Math.ceil(this.settingsService.calculateComplexityPoints(estimation));
  }

  /**
   * Retourne la taille T-shirt pour une estimation
   */
  getTShirtSize(estimation: Estimation): TShirtSize {
    const points = this.getEstimationPoints(estimation);
    const type = estimation.type || 'user-story';
    return this.settingsService.getTShirtSizeByPoints(points, type);
  }

  /**
   * Retourne les éléments qui sont sur le board mais pas dans un sprint
   */
  getUnassignedItems(): { estimation: Estimation; position: PlanningPosition }[] {
    return this.getAllItems().filter(item => {
      const sprintId = this.planningService.getSprintForItem(item.estimation.id);
      return !sprintId;
    });
  }

  /**
   * Centre la vue sur un sprint
   */
  focusOnSprint(sprint: Sprint): void {
    const centerX = sprint.position.x + sprint.width / 2;
    const centerY = sprint.position.y + sprint.height / 2;
    
    // Calculer le décalage pour centrer le sprint dans la vue
    const containerRect = this.boardContainer?.nativeElement?.getBoundingClientRect();
    if (containerRect) {
      const offsetX = containerRect.width / 2 - centerX * this.board.zoom;
      const offsetY = containerRect.height / 2 - centerY * this.board.zoom;
      this.planningService.setPanOffset({ x: offsetX, y: offsetY });
    }
  }

  /**
   * Centre la vue sur un élément
   */
  focusOnItem(estimationId: string): void {
    const position = this.getItemPosition(estimationId);
    if (position && this.boardContainer) {
      const containerRect = this.boardContainer.nativeElement.getBoundingClientRect();
      const offsetX = containerRect.width / 2 - position.x * this.board.zoom;
      const offsetY = containerRect.height / 2 - position.y * this.board.zoom;
      this.planningService.setPanOffset({ x: offsetX, y: offsetY });
    }
  }

  // Style helpers
  get canvasStyle(): { [key: string]: string } {
    return {
      transform: `translate(${this.board.panOffset.x}px, ${this.board.panOffset.y}px) scale(${this.board.zoom})`,
      'transform-origin': '0 0'
    };
  }

  get gridStyle(): { [key: string]: string } {
    if (!this.board.gridEnabled) return {};
    
    const size = this.board.gridSize;
    return {
      'background-size': `${size}px ${size}px`,
      'background-image': `
        linear-gradient(to right, var(--grid-color) 1px, transparent 1px),
        linear-gradient(to bottom, var(--grid-color) 1px, transparent 1px)
      `
    };
  }

  getNewSprintPreviewStyle(): { [key: string]: string } | null {
    if (!this.newSprintStart || !this.newSprintCurrent) return null;
    
    const x = Math.min(this.newSprintStart.x, this.newSprintCurrent.x);
    const y = Math.min(this.newSprintStart.y, this.newSprintCurrent.y);
    const width = Math.abs(this.newSprintCurrent.x - this.newSprintStart.x);
    const height = Math.abs(this.newSprintCurrent.y - this.newSprintStart.y);

    return {
      left: `${x}px`,
      top: `${y}px`,
      width: `${width}px`,
      height: `${height}px`
    };
  }

  trackBySprint(index: number, sprint: Sprint): string {
    return sprint.id;
  }

  trackByPosition(index: number, item: { estimation: Estimation; position: PlanningPosition }): string {
    return item.estimation.id;
  }

  trackByDependency(index: number, dep: Dependency): string {
    return dep.id;
  }

  trackByStickyNote(index: number, note: StickyNote): string {
    return note.id;
  }

  trackByDrawing(index: number, stroke: DrawingStroke): string {
    return stroke.id;
  }

  // ==================== STICKY NOTES ====================

  createQuickStickyNote(): void {
    // Position centrée par rapport à la vue actuelle
    const containerRect = this.boardContainer?.nativeElement?.getBoundingClientRect();
    let x = 300;
    let y = 200;
    
    if (containerRect) {
      x = (containerRect.width / 2 - this.board.panOffset.x) / this.board.zoom - 100;
      y = (containerRect.height / 2 - this.board.panOffset.y) / this.board.zoom - 100;
    }
    
    this.planningService.createStickyNote({
      position: { x, y }
    });
  }

  onStickyNoteMoved(noteId: string, position: { x: number; y: number }): void {
    this.planningService.moveStickyNote(noteId, position);
  }

  onStickyNoteResized(noteId: string, size: { width: number; height: number }): void {
    this.planningService.updateStickyNote(noteId, size);
  }

  onStickyNoteUpdated(noteId: string, updates: Partial<StickyNote>): void {
    this.planningService.updateStickyNote(noteId, updates);
  }

  onStickyNoteDeleted(noteId: string): void {
    this.planningService.deleteStickyNote(noteId);
  }

  // ==================== DRAWING MODE ====================

  toggleDrawingMode(): void {
    this.isDrawingMode = !this.isDrawingMode;
    if (!this.isDrawingMode) {
      this.showDrawingSettings = false;
      this.isCurrentlyDrawing = false;
      this.currentStroke = [];
      this.isEraserMode = false;
    } else {
      this.isEraserMode = false;
    }
  }

  toggleEraserMode(): void {
    this.isEraserMode = !this.isEraserMode;
  }

  toggleDrawingSettings(): void {
    this.showDrawingSettings = !this.showDrawingSettings;
  }

  setDrawingColor(color: string): void {
    this.drawingSettings.color = color;
    this.isEraserMode = false; // Désactiver la gomme quand on choisit une couleur
  }

  setDrawingThickness(thickness: number): void {
    this.drawingSettings.thickness = thickness;
  }

  onDrawingStart(event: MouseEvent): void {
    if (!this.isDrawingMode) return;
    
    event.preventDefault();
    event.stopPropagation();
    
    this.isCurrentlyDrawing = true;
    this.currentStroke = [];
    
    const point = this.getCanvasPoint(event);
    this.currentStroke.push(point);
  }

  onDrawingMove(event: MouseEvent): void {
    if (!this.isDrawingMode || !this.isCurrentlyDrawing) return;
    
    event.preventDefault();
    
    const point = this.getCanvasPoint(event);
    this.currentStroke.push(point);
  }

  onDrawingEnd(event: MouseEvent): void {
    if (!this.isDrawingMode || !this.isCurrentlyDrawing) return;
    
    event.preventDefault();
    
    if (this.currentStroke.length > 1) {
      this.planningService.addDrawingStroke({
        points: [...this.currentStroke],
        color: this.drawingSettings.color,
        thickness: this.drawingSettings.thickness
      });
    }
    
    this.isCurrentlyDrawing = false;
    this.currentStroke = [];
  }

  private getCanvasPoint(event: MouseEvent): DrawingPoint {
    const rect = this.boardContainer.nativeElement.getBoundingClientRect();
    return {
      x: (event.clientX - rect.left - this.board.panOffset.x) / this.board.zoom,
      y: (event.clientY - rect.top - this.board.panOffset.y) / this.board.zoom
    };
  }

  getStrokePath(points: DrawingPoint[]): string {
    if (points.length < 2) return '';
    
    let path = `M ${points[0].x} ${points[0].y}`;
    
    for (let i = 1; i < points.length; i++) {
      path += ` L ${points[i].x} ${points[i].y}`;
    }
    
    return path;
  }

  clearAllDrawings(): void {
    this.planningService.clearAllDrawings();
  }

  deleteDrawing(strokeId: string): void {
    this.planningService.deleteDrawingStroke(strokeId);
  }
}
