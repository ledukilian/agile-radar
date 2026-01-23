import { Component, OnInit, OnDestroy, Output, EventEmitter, Input, ElementRef, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';
import interact from 'interactjs';

import { PlanningService } from '../../services/planning.service';
import { EstimationService } from '../../services/estimation.service';
import { SettingsService } from '../../services/settings.service';
import { Estimation, TShirtSize } from '../../models/estimation.model';

@Component({
  selector: 'app-planning-sidebar',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './planning-sidebar.component.html',
  styleUrl: './planning-sidebar.component.scss'
})
export class PlanningSidebarComponent implements OnInit, OnDestroy, AfterViewInit {
  @Input() isCreatingDependency = false;
  
  @Output() itemDropped = new EventEmitter<{ estimationId: string; position: { x: number; y: number } }>();
  @Output() itemClicked = new EventEmitter<{ estimationId: string }>();

  unplannedItems: Estimation[] = [];
  searchQuery = '';
  typeFilter: 'all' | 'feature' | 'user-story' = 'all';
  
  private subscriptions: Subscription[] = [];
  private interactables: any[] = [];

  constructor(
    private planningService: PlanningService,
    private estimationService: EstimationService,
    private settingsService: SettingsService,
    private elementRef: ElementRef
  ) {}

  ngOnInit(): void {
    // S'abonner aux changements
    this.subscriptions.push(
      this.planningService.board$.subscribe(() => {
        this.loadUnplannedItems();
      }),
      this.estimationService.estimations$.subscribe(() => {
        this.loadUnplannedItems();
      })
    );
  }

  ngAfterViewInit(): void {
    this.setupDraggables();
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(s => s.unsubscribe());
    // Nettoyer les interactables
    this.interactables.forEach(i => i.unset());
    this.interactables = [];
  }

  private loadUnplannedItems(): void {
    this.unplannedItems = this.planningService.getUnplannedItems();
  }

  // Clic simple pour ajouter au board
  onItemClick(estimation: Estimation): void {
    // Calculer une position par défaut au centre visible du board
    const boardElement = document.querySelector('.board-canvas');
    if (boardElement) {
      const boardRect = boardElement.getBoundingClientRect();
      const board = this.planningService.getBoard();
      
      // Centre de la zone visible
      const centerX = boardRect.width / 2;
      const centerY = boardRect.height / 2;
      
      // Convertir en coordonnées canvas
      const position = {
        x: (centerX - board.panOffset.x) / board.zoom,
        y: (centerY - board.panOffset.y) / board.zoom
      };
      
      this.itemDropped.emit({ estimationId: estimation.id, position });
    }
  }

  private setupDraggables(): void {
    // Nettoyer les anciens interactables
    this.interactables.forEach(i => i.unset());
    this.interactables = [];
    
    // Configuration du drag pour les éléments de la sidebar
    setTimeout(() => {
      const items = this.elementRef.nativeElement.querySelectorAll('.sidebar-item');
      
      items.forEach((item: HTMLElement) => {
        let hasDragged = false;
        let startX = 0;
        let startY = 0;
        
        const interactable = interact(item).draggable({
          inertia: false,
          autoScroll: true,
          ignoreFrom: 'button, .dropdown-menu, .dropdown-menu *, [data-no-drag]',
          listeners: {
            start: (event) => {
              hasDragged = false;
              startX = event.clientX;
              startY = event.clientY;
              event.target.classList.add('dragging');
              
              // Créer un clone pour le drag
              const clone = event.target.cloneNode(true) as HTMLElement;
              clone.id = 'drag-clone';
              clone.style.position = 'fixed';
              clone.style.zIndex = '10000';
              clone.style.width = event.target.offsetWidth + 'px';
              clone.style.pointerEvents = 'none';
              clone.style.opacity = '0.9';
              clone.style.transform = 'scale(1.02)';
              clone.style.boxShadow = '0 8px 32px rgba(0,0,0,0.3)';
              clone.style.borderRadius = '8px';
              clone.style.left = event.clientX - event.target.offsetWidth / 2 + 'px';
              clone.style.top = event.clientY - 20 + 'px';
              document.body.appendChild(clone);
            },
            move: (event) => {
              // Détecter si on a vraiment bougé (seuil de 5px)
              const dx = Math.abs(event.clientX - startX);
              const dy = Math.abs(event.clientY - startY);
              if (dx > 5 || dy > 5) {
                hasDragged = true;
              }
              
              const clone = document.getElementById('drag-clone');
              if (clone) {
                clone.style.left = event.clientX - clone.offsetWidth / 2 + 'px';
                clone.style.top = event.clientY - 20 + 'px';
              }
            },
            end: (event) => {
              event.target.classList.remove('dragging');
              const clone = document.getElementById('drag-clone');
              if (clone) {
                clone.remove();
              }

              // Si pas de vrai drag, ignorer (le clic sera géré par le click handler)
              if (!hasDragged) {
                return;
              }

              // Vérifier si on a droppé sur le board
              const estimationId = event.target.dataset['estimationId'];
              const boardElement = document.querySelector('.board-canvas');
              
              if (boardElement && estimationId) {
                const boardRect = boardElement.getBoundingClientRect();
                const x = event.clientX;
                const y = event.clientY;
                
                // Vérifier si le drop est dans le board
                if (x >= boardRect.left && x <= boardRect.right &&
                    y >= boardRect.top && y <= boardRect.bottom) {
                  
                  // Calculer la position relative au board (en tenant compte du zoom/pan)
                  const board = this.planningService.getBoard();
                  const position = {
                    x: (x - boardRect.left - board.panOffset.x) / board.zoom - 60,
                    y: (y - boardRect.top - board.panOffset.y) / board.zoom - 20
                  };
                  
                  this.itemDropped.emit({ estimationId, position });
                }
              }
            }
          }
        });
        
        this.interactables.push(interactable);
      });
    }, 100);
  }

  // ==================== FILTRES ====================

  get filteredItems(): Estimation[] {
    let items = this.unplannedItems;

    // Filtre par type
    if (this.typeFilter !== 'all') {
      items = items.filter(i => i.type === this.typeFilter);
    }

    // Filtre par recherche
    if (this.searchQuery.trim()) {
      const query = this.searchQuery.toLowerCase().trim();
      items = items.filter(i => 
        i.name.toLowerCase().includes(query) ||
        i.description?.toLowerCase().includes(query)
      );
    }

    return items;
  }

  get features(): Estimation[] {
    return this.filteredItems.filter(i => i.type === 'feature');
  }

  get userStories(): Estimation[] {
    return this.filteredItems.filter(i => i.type === 'user-story' || !i.type);
  }

  // ==================== HELPERS ====================

  getPoints(estimation: Estimation): number {
    return Math.ceil(this.settingsService.calculateComplexityPoints(estimation));
  }

  getTShirtSize(estimation: Estimation): TShirtSize {
    const points = this.getPoints(estimation);
    const type = estimation.type || 'user-story';
    return this.settingsService.getTShirtSizeByPoints(points, type);
  }

  getTypeIcon(estimation: Estimation): string {
    return estimation.type === 'feature' ? '⭐' : '🧩';
  }

  /**
   * Vérifie si au moins une dimension CURSE est critique
   */
  hasCriticalDimension(estimation: Estimation): boolean {
    return estimation.complexity >= 75 ||
           estimation.uncertainty >= 75 ||
           estimation.risk >= 75 ||
           estimation.size >= 75 ||
           estimation.effort >= 75;
  }

  /**
   * Vérifie si au moins une dimension est en warning
   */
  hasWarningDimension(estimation: Estimation): boolean {
    const values = [
      estimation.complexity,
      estimation.uncertainty,
      estimation.risk,
      estimation.size,
      estimation.effort
    ];
    return values.some(v => v >= 50 && v < 75) && !this.hasCriticalDimension(estimation);
  }

  trackByItem(index: number, item: Estimation): string {
    return item.id;
  }

  // Rafraîchir les draggables quand la liste change
  onFilterChange(): void {
    setTimeout(() => this.setupDraggables(), 50);
  }
}
