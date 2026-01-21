import { Component, Input, Output, EventEmitter, OnChanges, SimpleChanges, NO_ERRORS_SCHEMA } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { 
  Dependency, 
  DependencyType,
  DEPENDENCY_TYPE_LABELS, 
  DEPENDENCY_TYPE_COLORS 
} from '../../models/planning.model';

@Component({
  selector: '[app-dependency-line]',
  standalone: true,
  imports: [CommonModule, FormsModule],
  schemas: [NO_ERRORS_SCHEMA],
  templateUrl: './dependency-line.component.html',
  styleUrl: './dependency-line.component.scss'
})
export class DependencyLineComponent implements OnChanges {
  @Input() dependency!: Dependency;
  @Input() sourcePosition: { x: number; y: number } | null = null;
  @Input() targetPosition: { x: number; y: number } | null = null;
  @Input() isResolved = false;

  @Output() delete = new EventEmitter<void>();
  @Output() update = new EventEmitter<Partial<Dependency>>();

  // Coordonnées calculées
  x1 = 0;
  y1 = 0;
  x2 = 0;
  y2 = 0;
  
  // Midpoint pour le label
  midX = 0;
  midY = 0;
  
  // Contrôle du tooltip/menu
  showTooltip = false;
  isEditing = false;
  editDescription = '';
  editType: DependencyType = 'depends-on';

  // Offset pour centrer sur les cartes (approximatif)
  private readonly CARD_OFFSET = { x: 90, y: 30 };

  ngOnChanges(changes: SimpleChanges): void {
    this.calculatePath();
  }

  private calculatePath(): void {
    if (!this.sourcePosition || !this.targetPosition) {
      return;
    }

    // Ajouter offset pour centrer sur les cartes
    this.x1 = this.sourcePosition.x + this.CARD_OFFSET.x;
    this.y1 = this.sourcePosition.y + this.CARD_OFFSET.y;
    this.x2 = this.targetPosition.x + this.CARD_OFFSET.x;
    this.y2 = this.targetPosition.y + this.CARD_OFFSET.y;
    
    // Point milieu
    this.midX = (this.x1 + this.x2) / 2;
    this.midY = (this.y1 + this.y2) / 2;
  }

  get isVisible(): boolean {
    return this.sourcePosition !== null && this.targetPosition !== null;
  }

  get lineColor(): string {
    if (!this.isResolved) {
      return '#ef4444'; // Rouge si non résolu
    }
    return DEPENDENCY_TYPE_COLORS[this.dependency.type].line;
  }

  get strokeDasharray(): string {
    if (!this.isResolved) {
      return '8,4'; // Ligne pointillée si non résolu
    }
    return 'none';
  }

  get typeLabel(): string {
    return DEPENDENCY_TYPE_LABELS[this.dependency.type];
  }

  get typeBgClass(): string {
    return DEPENDENCY_TYPE_COLORS[this.dependency.type].bg;
  }

  // Calcul du chemin courbe (Bézier quadratique)
  get pathD(): string {
    if (!this.isVisible) return '';
    
    // Calculer un point de contrôle pour la courbe
    const dx = this.x2 - this.x1;
    const dy = this.y2 - this.y1;
    const distance = Math.sqrt(dx * dx + dy * dy);
    
    // Courbe plus prononcée pour les longues distances
    const curvature = Math.min(distance * 0.2, 80);
    
    // Point de contrôle perpendiculaire à la ligne
    const cx = this.midX - (dy / distance) * curvature;
    const cy = this.midY + (dx / distance) * curvature;

    return `M ${this.x1} ${this.y1} Q ${cx} ${cy} ${this.x2} ${this.y2}`;
  }

  // Calcul de l'angle pour la flèche
  get arrowRotation(): number {
    const angle = Math.atan2(this.y2 - this.y1, this.x2 - this.x1) * 180 / Math.PI;
    return angle;
  }

  // Position de la flèche (proche de la cible)
  get arrowX(): number {
    return this.x2 - Math.cos(this.arrowRotation * Math.PI / 180) * 15;
  }

  get arrowY(): number {
    return this.y2 - Math.sin(this.arrowRotation * Math.PI / 180) * 15;
  }

  // ==================== ACTIONS ====================

  onLineClick(event: MouseEvent): void {
    event.stopPropagation();
    this.showTooltip = !this.showTooltip;
    this.isEditing = false;
  }

  onStartEdit(): void {
    this.editDescription = this.dependency.description;
    this.editType = this.dependency.type;
    this.isEditing = true;
  }

  onSaveEdit(): void {
    this.update.emit({
      type: this.editType,
      description: this.editDescription
    });
    this.isEditing = false;
    this.showTooltip = false;
  }

  onCancelEdit(): void {
    this.isEditing = false;
  }

  onDelete(): void {
    if (confirm('Supprimer cette dépendance ?')) {
      this.delete.emit();
      this.showTooltip = false;
    }
  }

  closeTooltip(): void {
    this.showTooltip = false;
    this.isEditing = false;
  }

  get dependencyTypes(): { value: DependencyType; label: string }[] {
    return [
      { value: 'blocks', label: 'Bloque' },
      { value: 'depends-on', label: 'Dépend de' },
      { value: 'must-precede', label: 'Doit précéder' }
    ];
  }
}
