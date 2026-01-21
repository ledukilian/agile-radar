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
  @Output() removed = new EventEmitter<void>();
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
    // Toujours configurer interact pour permettre le drag (même depuis un sprint)
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
    let dragClone: HTMLElement | null = null;

    this.interactable = interact(element)
      .draggable({
        inertia: this.inSprint ? false : true,
        // Ignorer les boutons et menus pour permettre les clics
        ignoreFrom: '.item-menu, .item-menu *, .dropdown-menu, .dropdown-menu *, button, [data-no-drag]',
        modifiers: this.inSprint ? [] : [
          interact.modifiers.restrictRect({
            restriction: 'parent',
            endOnly: true
          })
        ],
        listeners: {
          start: (event) => {
            element.classList.add('dragging');
            
            // Pour les items dans un sprint, créer un clone visuel
            if (this.inSprint) {
              dragClone = element.cloneNode(true) as HTMLElement;
              dragClone.id = 'drag-clone-item';
              dragClone.style.position = 'fixed';
              dragClone.style.zIndex = '10000';
              dragClone.style.width = element.offsetWidth + 'px';
              dragClone.style.pointerEvents = 'none';
              dragClone.style.opacity = '0.9';
              dragClone.style.transform = 'rotate(3deg) scale(1.05)';
              dragClone.style.left = event.clientX - element.offsetWidth / 2 + 'px';
              dragClone.style.top = event.clientY - element.offsetHeight / 2 + 'px';
              document.body.appendChild(dragClone);
            }
          },
          move: (event) => {
            if (this.inSprint && dragClone) {
              // Déplacer le clone
              dragClone.style.left = event.clientX - dragClone.offsetWidth / 2 + 'px';
              dragClone.style.top = event.clientY - dragClone.offsetHeight / 2 + 'px';
            } else {
              // Comportement normal pour items hors sprint
              const x = (this.position?.x || 0) + event.dx;
              const y = (this.position?.y || 0) + event.dy;
              this.moved.emit({ x, y });
            }
          },
          end: (event) => {
            element.classList.remove('dragging');
            
            if (this.inSprint && dragClone) {
              dragClone.remove();
              dragClone = null;
              
              // Vérifier si on a droppé en dehors du sprint parent
              const sprintElement = element.closest('.sprint-card');
              if (sprintElement) {
                const sprintRect = sprintElement.getBoundingClientRect();
                const x = event.clientX;
                const y = event.clientY;
                
                // Si le drop est hors du sprint, retirer l'item
                if (x < sprintRect.left || x > sprintRect.right ||
                    y < sprintRect.top || y > sprintRect.bottom) {
                  this.removed.emit();
                }
              }
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

  /**
   * Retourne la classe de couleur selon la valeur CURSE
   */
  getCurseIndicatorClass(value: number): string {
    if (value >= 75) return 'indicator-danger';
    if (value >= 50) return 'indicator-warning';
    return 'indicator-ok';
  }

  /**
   * Vérifie si au moins une dimension est critique
   */
  get hasCriticalDimension(): boolean {
    return this.estimation.complexity >= 75 ||
           this.estimation.uncertainty >= 75 ||
           this.estimation.risk >= 75 ||
           this.estimation.size >= 75 ||
           this.estimation.effort >= 75;
  }

  /**
   * Vérifie si au moins une dimension est en warning
   */
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
