import { Component, Input, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ProjectStore } from '../../core/store/project.store';
import {
  Iteration,
  Reserve,
  getIterationCapacityPoints,
  getNetCapacityPoints,
  getReservedPoints,
  formatPoints,
  getGrossTeamManDays,
  getEffectiveTeamManDays
} from '../../core/models/iteration.model';
import { ColorPickerComponent } from '../color-picker/color-picker.component';
import { IconComponent } from '../icon/icon.component';
import { SelectComponent, SelectOption } from '../select/select.component';

@Component({
  selector: 'app-iteration-form',
  standalone: true,
  imports: [CommonModule, FormsModule, ColorPickerComponent, IconComponent, SelectComponent],
  templateUrl: './iteration-form.component.html',
  styleUrl: './iteration-form.component.scss'
})
export class IterationFormComponent {
  @Input({ required: true }) iterationId!: string;
  @Input() index?: number;
  @Input() showReorder = true;
  @Input() showDelete = true;
  @Input() embedded = false;

  readonly store = inject(ProjectStore);

  readonly reserveModeOptions: SelectOption[] = [
    { value: 'percent', label: '%' },
    { value: 'points', label: 'pts' }
  ];

  readonly iteration = computed(() =>
    this.store.iterations().find(it => it.id === this.iterationId)
  );

  readonly iterations = computed(() => this.store.iterations());

  trackReserve = (_i: number, r: Reserve): string => r.id;

  capacityPoints = getIterationCapacityPoints;
  netCapacityPoints = getNetCapacityPoints;
  reservedPoints = getReservedPoints;
  formatPoints = formatPoints;

  setIterationField(field: 'name' | 'startDate' | 'endDate', value: string): void {
    if (field === 'name') {
      this.store.updateIteration(this.iterationId, { name: value });
    } else if (field === 'startDate') {
      this.store.updateIteration(this.iterationId, { startDate: value || null });
    } else {
      this.store.updateIteration(this.iterationId, { endDate: value || null });
    }
  }

  setCapacityField(field: 'focusFactor' | 'pointsPerManDay', value: number): void {
    const num = +value;
    if (field === 'focusFactor') {
      this.store.updateIterationCapacity(this.iterationId, { focusFactor: num, manualPoints: null });
    } else {
      this.store.updateIterationCapacity(this.iterationId, { pointsPerManDay: num, manualPoints: null });
    }
  }

  setTeamManDays(value: number): void {
    const num = Math.max(0, +value);
    this.store.updateIterationCapacity(this.iterationId, {
      people: 1,
      daysPerPerson: num,
      manualPoints: null
    });
  }

  teamManDays(it: Iteration): number {
    return getGrossTeamManDays(it.capacity);
  }

  setManualPoints(value: string): void {
    const trimmed = value.trim();
    this.store.updateIterationCapacity(this.iterationId, { manualPoints: trimmed === '' ? null : +trimmed });
  }

  togglePast(it: Iteration): void {
    this.store.updateIteration(it.id, { isPast: !it.isPast });
  }

  setActualVelocity(value: string): void {
    const trimmed = value.trim();
    this.store.updateIteration(this.iterationId, { actualVelocity: trimmed === '' ? null : +trimmed });
  }

  addReserve(): void {
    this.store.addReserve(this.iterationId);
  }

  updateReserveField(
    reserveId: string,
    field: 'label' | 'color' | 'mode' | 'value',
    value: string
  ): void {
    if (field === 'value') {
      this.store.updateReserve(this.iterationId, reserveId, { value: +value });
    } else if (field === 'mode') {
      this.store.updateReserve(this.iterationId, reserveId, { mode: value as 'percent' | 'points' });
    } else if (field === 'label') {
      this.store.updateReserve(this.iterationId, reserveId, { label: value });
    } else {
      this.store.updateReserve(this.iterationId, reserveId, { color: value });
    }
  }

  removeReserve(reserveId: string): void {
    this.store.deleteReserve(this.iterationId, reserveId);
  }

  removeIteration(): void {
    if (confirm('Supprimer cette itération ? Les éléments repartiront au backlog.')) {
      this.store.deleteIteration(this.iterationId);
    }
  }

  moveUp(it: Iteration): void {
    const ordered = this.iterations().map(i => i.id);
    const idx = ordered.indexOf(it.id);
    if (idx > 0) {
      [ordered[idx - 1], ordered[idx]] = [ordered[idx], ordered[idx - 1]];
      this.store.reorderIterations(ordered);
    }
  }

  moveDown(it: Iteration): void {
    const ordered = this.iterations().map(i => i.id);
    const idx = ordered.indexOf(it.id);
    if (idx < ordered.length - 1) {
      [ordered[idx + 1], ordered[idx]] = [ordered[idx], ordered[idx + 1]];
      this.store.reorderIterations(ordered);
    }
  }

  manDays(it: Iteration): number {
    return getEffectiveTeamManDays(it.capacity);
  }

  observedRatio(it: Iteration): number {
    const md = this.manDays(it);
    return md > 0 && it.actualVelocity !== null ? it.actualVelocity / md : 0;
  }
}
