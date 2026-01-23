import { Component, Input, Output, EventEmitter, OnInit, OnDestroy, OnChanges, ElementRef, ViewChild, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import interact from 'interactjs';

import { Sprint, SprintInfo, PlanningPosition } from '../../models/planning.model';
import { Estimation } from '../../models/estimation.model';
import { PlanningItemCardComponent } from '../planning-item-card/planning-item-card.component';

@Component({
  selector: 'app-sprint-card',
  standalone: true,
  imports: [CommonModule, FormsModule, PlanningItemCardComponent],
  templateUrl: './sprint-card.component.html',
  styleUrl: './sprint-card.component.scss'
})
export class SprintCardComponent implements OnInit, OnChanges, AfterViewInit, OnDestroy {
  @ViewChild('sprintElement') sprintElement!: ElementRef<HTMLDivElement>;
  @ViewChild('contentArea') contentArea!: ElementRef<HTMLDivElement>;

  @Input() sprint!: Sprint;
  @Input() sprintInfo: SprintInfo | null = null;
  @Input() items: { estimation: Estimation; position: PlanningPosition }[] = [];
  @Input() isCreatingDependency = false;
  @Input() dependencySource: string | null = null;

  @Output() moved = new EventEmitter<{ x: number; y: number }>();
  @Output() resized = new EventEmitter<{ width: number; height: number }>();
  @Output() updated = new EventEmitter<Partial<Sprint>>();
  @Output() deleted = new EventEmitter<void>();
  @Output() itemMoved = new EventEmitter<{ id: string; position: { x: number; y: number } }>();
  @Output() itemRemoved = new EventEmitter<{ id: string; dropPosition?: { x: number; y: number } }>();
  @Output() itemDropped = new EventEmitter<{ id: string; localPosition: { x: number; y: number } }>();
  @Output() startDependency = new EventEmitter<string>();
  @Output() selectDependencyTarget = new EventEmitter<string>();

  isEditing = false;
  editName = '';
  editCapacity: number | undefined = undefined;
  showSettings = false;

  private interactable: any;
  private resizable: any;
  private dropzone: any;

  ngOnInit(): void {
    this.editName = this.sprint.name;
    this.editCapacity = this.sprint.capacity;
  }

  ngOnChanges(): void {
    this.editCapacity = this.sprint.capacity;
  }

  ngAfterViewInit(): void {
    this.setupInteract();
  }

  ngOnDestroy(): void {
    if (this.interactable) {
      this.interactable.unset();
    }
    if (this.resizable) {
      this.resizable.unset();
    }
    if (this.dropzone) {
      this.dropzone.unset();
    }
  }

  private setupInteract(): void {
    const element = this.sprintElement.nativeElement;

    let currentX = 0;
    let currentY = 0;

    // Draggable (sur le header uniquement)
    this.interactable = interact(element.querySelector('.sprint-header') as HTMLElement)
      .draggable({
        inertia: false,
        ignoreFrom: 'button, input, .dropdown-menu, .dropdown-menu *, [data-no-drag]',
        listeners: {
          start: () => {
            currentX = this.sprint.position.x;
            currentY = this.sprint.position.y;
          },
          move: (event: any) => {
            currentX += event.dx;
            currentY += event.dy;
            this.moved.emit({ x: currentX, y: currentY });
          }
        }
      });

    // Variables pour le resize
    let startWidth = 0;
    let startHeight = 0;

    // Resizable
    this.resizable = interact(element)
      .resizable({
        edges: { right: true, bottom: true, left: false, top: false },
        modifiers: [
          interact.modifiers.restrictSize({
            min: { width: 250, height: 200 }
          })
        ],
        listeners: {
          start: () => {
            // Capturer les dimensions initiales au début du resize
            startWidth = this.sprint.width;
            startHeight = this.sprint.height;
          },
          move: (event) => {
            // Calculer les nouvelles dimensions basées sur le delta
            const newWidth = Math.max(250, startWidth + event.deltaRect.width);
            const newHeight = Math.max(200, startHeight + event.deltaRect.height);
            
            // Mettre à jour les dimensions de départ pour le prochain move
            startWidth = newWidth;
            startHeight = newHeight;
            
            this.resized.emit({
              width: newWidth,
              height: newHeight
            });
          }
        }
      });

    // Dropzone
    this.dropzone = interact(element)
      .dropzone({
        accept: '.planning-item, .sidebar-item',
        overlap: 0.3,
        ondrop: (event) => {
          const estimationId = event.relatedTarget.dataset['estimationId'];
          if (estimationId) {
            // Calculer la position locale dans le sprint
            const contentRect = this.contentArea?.nativeElement?.getBoundingClientRect();
            if (contentRect) {
              // Position du curseur relative à la zone de contenu
              const localX = event.dragEvent.clientX - contentRect.left;
              const localY = event.dragEvent.clientY - contentRect.top;
              
              // Centrer l'élément sous le curseur (estimation de la taille de la carte)
              const cardHalfWidth = 60;
              const cardHalfHeight = 25;
              
              this.itemDropped.emit({ 
                id: estimationId, 
                localPosition: { 
                  x: Math.max(10, localX - cardHalfWidth), 
                  y: Math.max(10, localY - cardHalfHeight) 
                }
              });
            } else {
              this.itemDropped.emit({ id: estimationId, localPosition: { x: 20, y: 20 } });
            }
          }
        },
        ondragenter: () => {
          element.classList.add('drop-active');
        },
        ondragleave: () => {
          element.classList.remove('drop-active');
        },
        ondropdeactivate: () => {
          element.classList.remove('drop-active');
        }
      });
  }

  // ==================== EDITION ====================

  startEditing(): void {
    this.editName = this.sprint.name;
    this.editCapacity = this.sprint.capacity;
    this.isEditing = true;
  }

  saveEditing(): void {
    this.updated.emit({
      name: this.editName,
      capacity: this.editCapacity
    });
    this.isEditing = false;
  }

  cancelEditing(): void {
    this.editName = this.sprint.name;
    this.editCapacity = this.sprint.capacity;
    this.isEditing = false;
  }

  toggleSettings(): void {
    this.showSettings = !this.showSettings;
  }

  updateDates(startDate: string, endDate: string): void {
    this.updated.emit({ startDate, endDate });
  }

  confirmDelete(): void {
    if (confirm(`Supprimer le sprint "${this.sprint.name}" ? Les éléments qu'il contient seront libérés.`)) {
      this.deleted.emit();
    }
  }

  // ==================== ITEMS ====================

  onItemMoved(estimationId: string, position: { x: number; y: number }): void {
    this.itemMoved.emit({ id: estimationId, position });
  }

  onItemRemoved(estimationId: string, dropPosition?: { x: number; y: number }): void {
    this.itemRemoved.emit({ id: estimationId, dropPosition });
  }

  onStartDependency(estimationId: string): void {
    this.startDependency.emit(estimationId);
  }

  onSelectAsTarget(estimationId: string): void {
    this.selectDependencyTarget.emit(estimationId);
  }

  // ==================== HELPERS ====================

  get statusClass(): string {
    if (!this.sprintInfo) return '';
    
    switch (this.sprintInfo.status) {
      case 'overloaded': return 'status-overloaded';
      case 'at-risk': return 'status-at-risk';
      case 'warning': return 'status-warning';
      case 'balanced': return 'status-balanced';
      default: return '';
    }
  }

  get statusLabel(): string {
    if (!this.sprintInfo) return '';
    
    switch (this.sprintInfo.status) {
      case 'overloaded': return 'Surchargé';
      case 'at-risk': return 'À risque';
      case 'warning': return 'Attention';
      case 'balanced': return 'Équilibré';
      case 'empty': return 'Vide';
      default: return '';
    }
  }

  get loadBarWidth(): number {
    if (!this.sprintInfo) return 0;
    return Math.min(100, this.sprintInfo.loadPercentage);
  }

  get loadBarClass(): string {
    if (!this.sprintInfo) return 'bg-gray-300';
    
    if (this.sprintInfo.loadPercentage > 100) return 'bg-red-500';
    if (this.sprintInfo.loadPercentage > 85) return 'bg-amber-500';
    if (this.sprintInfo.loadPercentage > 60) return 'bg-green-500';
    return 'bg-blue-400';
  }

  trackByItem(index: number, item: { estimation: Estimation; position: PlanningPosition }): string {
    return item.estimation.id;
  }
}
