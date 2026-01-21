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
  SprintInfo
} from '../../models/planning.model';
import { Estimation } from '../../models/estimation.model';

import { SprintCardComponent } from '../sprint-card/sprint-card.component';
import { PlanningItemCardComponent } from '../planning-item-card/planning-item-card.component';
import { DependencyLineComponent } from '../dependency-line/dependency-line.component';
import { PlanningSidebarComponent } from '../planning-sidebar/planning-sidebar.component';
import { PlanningRecommendationsComponent } from '../planning-recommendations/planning-recommendations.component';

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
    PlanningRecommendationsComponent
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
  showSidebar = true;
  showRecommendations = false;
  isCreatingDependency = false;
  dependencySource: string | null = null;
  
  // Mode création sprint
  isCreatingSprint = false;
  newSprintStart: { x: number; y: number } | null = null;
  newSprintCurrent: { x: number; y: number } | null = null;

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
    if (event.ctrlKey || event.metaKey) {
      event.preventDefault();
      const delta = event.deltaY > 0 ? -0.1 : 0.1;
      this.setZoom(this.board.zoom + delta);
    }
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
    if ((event.target as HTMLElement).closest('.planning-item, .sprint-card, .sidebar, .recommendations')) {
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
    this.planningService.createSprint({
      name: `Sprint ${existingSprints + 1}`,
      position: { 
        x: 100 + (existingSprints % 3) * 450, 
        y: 100 + Math.floor(existingSprints / 3) * 350 
      }
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

  getItemsInSprint(sprintId: string): Estimation[] {
    return this.planningService.getSprintItems(sprintId);
  }

  getItemsOutsideSprints(): { estimation: Estimation; position: PlanningPosition }[] {
    const positions = this.board.positions.filter(p => !p.sprintId);
    return positions
      .map(pos => {
        const estimation = this.estimations.find(e => e.id === pos.estimationId);
        return estimation ? { estimation, position: pos } : null;
      })
      .filter((item): item is { estimation: Estimation; position: PlanningPosition } => item !== null);
  }

  onItemMoved(estimationId: string, position: { x: number; y: number }): void {
    this.planningService.moveItem(estimationId, position);
  }

  onItemDroppedOnSprint(estimationId: string, sprintId: string): void {
    this.planningService.assignToSprint(estimationId, sprintId);
  }

  onItemRemovedFromSprint(estimationId: string): void {
    this.planningService.removeFromSprint(estimationId);
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
    
    // Ouvrir un dialogue pour le type et la description
    // Pour l'instant, on crée une dépendance par défaut
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

  toggleSidebar(): void {
    this.showSidebar = !this.showSidebar;
  }

  toggleRecommendations(): void {
    this.showRecommendations = !this.showRecommendations;
  }

  goToEstimation(): void {
    this.navigateToEstimation.emit();
  }

  getEstimation(id: string): Estimation | undefined {
    return this.estimations.find(e => e.id === id);
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
}
