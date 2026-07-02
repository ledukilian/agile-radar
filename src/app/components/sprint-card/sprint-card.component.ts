import { Component, Input, Output, EventEmitter, OnInit, OnDestroy, OnChanges, ElementRef, ViewChild, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import interact from 'interactjs';

import { Sprint, SprintInfo } from '../../models/planning.model';

@Component({
  selector: 'app-sprint-card',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './sprint-card.component.html',
  styleUrl: './sprint-card.component.scss'
})
export class SprintCardComponent implements OnInit, OnChanges, AfterViewInit, OnDestroy {
  @ViewChild('sprintElement') sprintElement!: ElementRef<HTMLDivElement>;

  @Input() sprint!: Sprint;
  @Input() sprintInfo: SprintInfo | null = null;

  @Output() moved = new EventEmitter<{ x: number; y: number }>();
  @Output() resized = new EventEmitter<{ width: number; height: number }>();
  @Output() updated = new EventEmitter<Partial<Sprint>>();
  @Output() deleted = new EventEmitter<void>();

  isEditing = false;
  editName = '';
  editCapacity: number | undefined = undefined;
  showSettings = false;

  // Variables locales pour le drag/resize fluide (évite les re-renders constants)
  isDragging = false;
  isResizing = false;
  localX = 0;
  localY = 0;
  localWidth = 0;
  localHeight = 0;

  private interactable: any;
  private resizable: any;

  ngOnInit(): void {
    this.editName = this.sprint.name;
    this.editCapacity = this.sprint.capacity;
    this.syncLocalValues();
  }

  ngOnChanges(): void {
    this.editCapacity = this.sprint.capacity;
    // Synchroniser les valeurs locales seulement si on n'est pas en train de drag/resize
    if (!this.isDragging && !this.isResizing) {
      this.syncLocalValues();
    }
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
  }

  private syncLocalValues(): void {
    this.localX = this.sprint.position.x;
    this.localY = this.sprint.position.y;
    this.localWidth = this.sprint.width;
    this.localHeight = this.sprint.height;
  }

  private setupInteract(): void {
    const element = this.sprintElement.nativeElement;

    // Draggable (sur le header uniquement)
    this.interactable = interact(element.querySelector('.sprint-header') as HTMLElement)
      .draggable({
        inertia: false,
        ignoreFrom: 'button, input, .dropdown-menu, .dropdown-menu *, [data-no-drag]',
        listeners: {
          start: () => {
            this.isDragging = true;
            this.localX = this.sprint.position.x;
            this.localY = this.sprint.position.y;
            element.classList.add('dragging');
          },
          move: (event: any) => {
            // Mise à jour locale seulement (pas d'émission)
            this.localX += event.dx;
            this.localY += event.dy;
          },
          end: () => {
            element.classList.remove('dragging');
            // Émettre seulement à la fin
            this.moved.emit({ x: this.localX, y: this.localY });
            this.isDragging = false;
          }
        }
      });

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
            this.isResizing = true;
            this.localWidth = this.sprint.width;
            this.localHeight = this.sprint.height;
            element.classList.add('resizing');
          },
          move: (event) => {
            // Mise à jour locale seulement (pas d'émission)
            this.localWidth = Math.max(250, this.localWidth + event.deltaRect.width);
            this.localHeight = Math.max(200, this.localHeight + event.deltaRect.height);
          },
          end: () => {
            element.classList.remove('resizing');
            // Émettre seulement à la fin
            this.resized.emit({
              width: this.localWidth,
              height: this.localHeight
            });
            this.isResizing = false;
          }
        }
      });
  }

  // Getters pour les styles (utilise les valeurs locales pendant drag/resize)
  get displayX(): number {
    return this.isDragging ? this.localX : this.sprint.position.x;
  }

  get displayY(): number {
    return this.isDragging ? this.localY : this.sprint.position.y;
  }

  get displayWidth(): number {
    return this.isResizing ? this.localWidth : this.sprint.width;
  }

  get displayHeight(): number {
    return this.isResizing ? this.localHeight : this.sprint.height;
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
    this.deleted.emit();
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
}
