import { Component, Input, Output, EventEmitter, OnInit, OnDestroy, OnChanges, ElementRef, ViewChild, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import interact from 'interactjs';

import { Sprint, SprintInfo, SprintStatus } from '../../models/planning.model';
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

  @Input() sprint!: Sprint;
  @Input() sprintInfo: SprintInfo | null = null;
  @Input() items: Estimation[] = [];
  @Input() isCreatingDependency = false;
  @Input() dependencySource: string | null = null;

  @Output() moved = new EventEmitter<{ x: number; y: number }>();
  @Output() resized = new EventEmitter<{ width: number; height: number }>();
  @Output() updated = new EventEmitter<Partial<Sprint>>();
  @Output() deleted = new EventEmitter<void>();
  @Output() itemMoved = new EventEmitter<{ id: string; position: { x: number; y: number } }>();
  @Output() itemRemoved = new EventEmitter<string>();
  @Output() itemDropped = new EventEmitter<string>();
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
    // Synchroniser editCapacity avec sprint.capacity quand il change
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

    // Draggable (sur le header uniquement)
    this.interactable = interact(element.querySelector('.sprint-header') as HTMLElement)
      .draggable({
        inertia: true,
        // Ignorer les boutons et menus pour permettre les clics
        ignoreFrom: 'button, input, .dropdown-menu, .dropdown-menu *, [data-no-drag]',
        modifiers: [
          interact.modifiers.restrictRect({
            restriction: 'parent',
            endOnly: true
          })
        ],
        listeners: {
          move: (event) => {
            const x = this.sprint.position.x + event.dx;
            const y = this.sprint.position.y + event.dy;
            this.moved.emit({ x, y });
          }
        }
      });

    // Resizable
    this.resizable = interact(element)
      .resizable({
        edges: { right: true, bottom: true, left: false, top: false },
        modifiers: [
          interact.modifiers.restrictSize({
            min: { width: 200, height: 150 }
          })
        ],
        listeners: {
          move: (event) => {
            this.resized.emit({
              width: event.rect.width,
              height: event.rect.height
            });
          }
        }
      });

    // Dropzone
    this.dropzone = interact(element)
      .dropzone({
        accept: '.planning-item',
        overlap: 0.5,
        ondrop: (event) => {
          const estimationId = event.relatedTarget.dataset['estimationId'];
          if (estimationId) {
            this.itemDropped.emit(estimationId);
          }
        },
        ondragenter: (event) => {
          element.classList.add('drop-active');
        },
        ondragleave: (event) => {
          element.classList.remove('drop-active');
        },
        ondropdeactivate: (event) => {
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

  onItemRemoved(estimationId: string): void {
    this.itemRemoved.emit(estimationId);
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

  trackByItem(index: number, item: Estimation): string {
    return item.id;
  }
}
