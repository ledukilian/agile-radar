import { Component, Input, Output, EventEmitter, OnInit, OnDestroy, ElementRef, ViewChild, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import interact from 'interactjs';

import { Estimation, TShirtSize } from '../../models/estimation.model';
import { SettingsService } from '../../services/settings.service';

@Component({
  selector: 'app-planning-item-card',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './planning-item-card.component.html',
  styleUrl: './planning-item-card.component.scss'
})
export class PlanningItemCardComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('itemElement') itemElement!: ElementRef<HTMLDivElement>;

  @Input() estimation!: Estimation;
  @Input() position?: { x: number; y: number };
  @Input() compact = false;
  @Input() inSprint = false;
  @Input() isCreatingDependency = false;
  @Input() isSelected = false;

  @Output() moved = new EventEmitter<{ x: number; y: number }>();
  @Output() removed = new EventEmitter<{ x: number; y: number } | void>();
  @Output() startDependency = new EventEmitter<string>();
  @Output() selectAsTarget = new EventEmitter<string>();

  points = 0;
  tShirtSize: TShirtSize | null = null;
  showMenu = false;

  private interactable: any;

  constructor(private settingsService: SettingsService) {}

  ngOnInit(): void {
    this.calculateMetrics();
  }

  ngAfterViewInit(): void {
    this.setupInteract();
  }

  ngOnDestroy(): void {
    if (this.interactable) {
      this.interactable.unset();
    }
  }

  private calculateMetrics(): void {
    this.points = Math.ceil(this.settingsService.calculateComplexityPoints(this.estimation));
    const type = this.estimation.type || 'user-story';
    this.tShirtSize = this.settingsService.getTShirtSizeByPoints(this.points, type);
  }

  private setupInteract(): void {
    const element = this.itemElement.nativeElement;
    
    let startX = 0;
    let startY = 0;
    let isDraggingOutside = false;

    this.interactable = interact(element)
      .draggable({
        inertia: false,
        ignoreFrom: '.item-menu, .item-menu *, .dropdown-menu, .dropdown-menu *, button, [data-no-drag]',
        listeners: {
          start: () => {
            element.classList.add('dragging');
            isDraggingOutside = false;
            
            // Stocker la position initiale (depuis les props, pas les variables locales)
            startX = this.position?.x || 0;
            startY = this.position?.y || 0;
          },
          move: (event: any) => {
            // Calculer la nouvelle position en ajoutant le delta au point de départ
            startX += event.dx;
            startY += event.dy;
            
            // Vérifier si on sort du sprint (pour les items dans un sprint)
            if (this.inSprint) {
              const sprintElement = element.closest('.sprint-card');
              if (sprintElement) {
                const sprintRect = sprintElement.getBoundingClientRect();
                const isOutside = event.clientX < sprintRect.left || 
                                  event.clientX > sprintRect.right ||
                                  event.clientY < sprintRect.top || 
                                  event.clientY > sprintRect.bottom;
                
                if (isOutside && !isDraggingOutside) {
                  isDraggingOutside = true;
                  element.classList.add('dragging-outside');
                } else if (!isOutside && isDraggingOutside) {
                  isDraggingOutside = false;
                  element.classList.remove('dragging-outside');
                }
              }
            }
            
            // Émettre la nouvelle position
            this.moved.emit({ x: startX, y: startY });
          },
          end: (event: any) => {
            element.classList.remove('dragging');
            element.classList.remove('dragging-outside');
            
            // Pour les items dans un sprint, vérifier si on a droppé en dehors
            if (this.inSprint && isDraggingOutside) {
              // Émettre la position de drop pour placer l'élément sur le board
              this.removed.emit({ x: event.clientX, y: event.clientY });
            }
          }
        }
      });
  }

  // ==================== ACTIONS ====================

  onClick(): void {
    if (this.isCreatingDependency && !this.isSelected) {
      this.selectAsTarget.emit(this.estimation.id);
    }
  }

  onStartDependency(event: Event): void {
    event.stopPropagation();
    this.startDependency.emit(this.estimation.id);
  }

  onRemove(event: Event): void {
    event.stopPropagation();
    this.removed.emit();
    this.showMenu = false;
  }

  toggleMenu(event: Event): void {
    event.stopPropagation();
    this.showMenu = !this.showMenu;
  }

  // ==================== HELPERS ====================

  get typeIcon(): string {
    return this.estimation.type === 'feature' ? '⭐' : '🧩';
  }

  get typeLabel(): string {
    return this.estimation.type === 'feature' ? 'Feature' : 'US';
  }

  getCurseIndicatorClass(value: number): string {
    if (value >= 75) return 'indicator-danger';
    if (value >= 50) return 'indicator-warning';
    return 'indicator-ok';
  }

  get hasCriticalDimension(): boolean {
    return this.estimation.complexity >= 75 ||
           this.estimation.uncertainty >= 75 ||
           this.estimation.risk >= 75 ||
           this.estimation.size >= 75 ||
           this.estimation.effort >= 75;
  }

  get hasWarningDimension(): boolean {
    const values = [
      this.estimation.complexity,
      this.estimation.uncertainty,
      this.estimation.risk,
      this.estimation.size,
      this.estimation.effort
    ];
    return values.some(v => v >= 50 && v < 75);
  }

  get overallIndicatorClass(): string {
    if (this.hasCriticalDimension) return 'overall-danger';
    if (this.hasWarningDimension) return 'overall-warning';
    return 'overall-ok';
  }
}
