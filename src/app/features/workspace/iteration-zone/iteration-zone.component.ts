import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Iteration, getIterationCapacityPoints, getReservedPoints, formatPoints, roundPoints } from '../../../core/models/iteration.model';
import { IterationLoad } from '../../../core/scheduling/scheduling.types';
import { ItemHierarchyListComponent } from '../../../shared/item-hierarchy-list/item-hierarchy-list.component';
import { IconComponent } from '../../../shared/icon/icon.component';
import { ItemVM } from '../workspace.types';

interface GaugeSegment {
  label: string;
  color: string;
  widthPct: number;
  points: number;
  percentOfCapacity: number;
}

@Component({
  selector: 'app-iteration-zone',
  standalone: true,
  imports: [CommonModule, ItemHierarchyListComponent, IconComponent],
  templateUrl: './iteration-zone.component.html',
  styleUrl: './iteration-zone.component.scss'
})
export class IterationZoneComponent {
  @Input({ required: true }) iteration!: Iteration;
  @Input() load?: IterationLoad;
  @Input() items: ItemVM[] = [];
  @Input() isDropTarget = false;

  @Output() openItem = new EventEmitter<string>();
  @Output() dropItem = new EventEmitter<string>();
  @Output() editIteration = new EventEmitter<string>();
  @Output() addItem = new EventEmitter<string>();
  @Output() dragEnterZone = new EventEmitter<string>();
  @Output() dragLeaveZone = new EventEmitter<void>();

  get capacity(): number {
    return getIterationCapacityPoints(this.iteration);
  }

  get net(): number {
    return this.load?.netCapacity ?? 0;
  }

  get used(): number {
    return this.load?.usedPoints ?? 0;
  }

  get statusClass(): string {
    return 'status-' + (this.load?.status ?? 'empty');
  }

  get statusLabel(): string {
    switch (this.load?.status) {
      case 'overloaded':
        return 'Surchargé';
      case 'warning':
        return 'Proche saturation';
      case 'balanced':
        return 'Équilibré';
      default:
        return 'Vide';
    }
  }

  /** Segments de réserve exprimés en % de la capacité brute */
  get reserveSegments(): GaugeSegment[] {
    const cap = this.capacity;
    if (cap <= 0) return [];
    return this.iteration.reserves.map(r => {
      const pts = r.mode === 'percent' ? (cap * r.value) / 100 : r.value;
      const points = roundPoints(Math.max(0, pts));
      return {
        label: r.label,
        color: r.color,
        widthPct: Math.min(100, (points / cap) * 100),
        points,
        percentOfCapacity: cap > 0 ? roundPoints((points / cap) * 100) : 0
      };
    });
  }

  /** Part de la barre disponible pour le travail (capacité nette / brute). */
  get availableWidthPct(): number {
    const cap = this.capacity;
    if (cap <= 0) return 0;
    return Math.min(100, roundPoints((this.net / cap) * 100));
  }

  /** Remplissage en % de la zone disponible (peut dépasser 100 % si surcharge). */
  get usedOfAvailablePct(): number {
    const net = this.net;
    if (net <= 0) return this.used > 0 ? 100 : 0;
    return roundPoints((this.used / net) * 100);
  }

  get usedOverflowsAvailable(): boolean {
    return this.usedOfAvailablePct > 100;
  }

  /** Largeur affichée du remplissage (plafonnée à la zone disponible). */
  get usedFillPct(): number {
    return Math.min(100, this.usedOfAvailablePct);
  }

  get usedColor(): string {
    switch (this.load?.status) {
      case 'overloaded':
        return '#ef4444';
      case 'warning':
        return '#f59e0b';
      case 'balanced':
        return '#22c55e';
      default:
        return '#64748b';
    }
  }

  get overflowPoints(): number {
    return this.load?.overflowPoints ?? 0;
  }

  get overflowPercent(): number | null {
    const net = this.net;
    if (net <= 0 || this.overflowPoints <= 0) return null;
    return Math.round((this.overflowPoints / net) * 1000) / 10;
  }

  get overflowLabel(): string {
    const pts = this.overflowPoints;
    if (pts <= 0) return '';
    const pct = this.overflowPercent;
    if (pct === null) return `+${pts} pts`;
    return `+${pct}% (${pts} pts)`;
  }

  /** Total des points réservés (toutes bandes confondues) */
  get reservedPoints(): number {
    return getReservedPoints(this.iteration);
  }

  get reservedPercent(): number {
    const cap = this.capacity;
    if (cap <= 0) return 0;
    return roundPoints((this.reservedPoints / cap) * 100);
  }

  reserveLabel(points: number, percent: number): string {
    return `${formatPoints(points)} pts / ${formatPoints(percent)}%`;
  }

  get hasReserves(): boolean {
    return this.iteration.reserves.length > 0;
  }

  onDragOver(event: DragEvent): void {
    event.preventDefault();
    if (event.dataTransfer) event.dataTransfer.dropEffect = 'move';
    this.dragEnterZone.emit(this.iteration.id);
  }

  onDragLeave(): void {
    this.dragLeaveZone.emit();
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    const id = event.dataTransfer?.getData('text/plain');
    if (id) this.dropItem.emit(id);
    this.dragLeaveZone.emit();
  }
}
