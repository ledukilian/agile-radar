import { Component, EventEmitter, Output, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ProjectStore } from '../../core/store/project.store';
import { Iteration, getEffectiveTeamManDays } from '../../core/models/iteration.model';
import { CurseAxis } from '../../core/models/config.model';
import { generateId } from '../../core/utils/id.util';
import { IconComponent } from '../../shared/icon/icon.component';
import { ColorPickerComponent } from '../../shared/color-picker/color-picker.component';
import { IterationFormComponent } from '../../shared/iteration-form/iteration-form.component';

@Component({
  selector: 'app-setup',
  standalone: true,
  imports: [CommonModule, FormsModule, ColorPickerComponent, IconComponent, IterationFormComponent],
  templateUrl: './setup.component.html',
  styleUrl: './setup.component.scss'
})
export class SetupComponent {
  @Output() close = new EventEmitter<void>();

  trackIteration = (_i: number, it: Iteration): string => it.id;
  trackAxis = (_i: number, a: CurseAxis): string => a.key;

  readonly store = inject(ProjectStore);
  activeTab: 'project' | 'iterations' | 'curse' = 'project';

  setTab(tab: 'project' | 'iterations' | 'curse'): void {
    this.activeTab = tab;
  }

  // ==================== PROJET ====================

  get projectName(): string {
    return this.store.project().name;
  }
  set projectName(value: string) {
    this.store.setProjectName(value);
  }

  get author(): string {
    return this.store.config().author;
  }
  set author(value: string) {
    this.store.updateConfig({ author: value });
  }

  get pointsPerManDayDefault(): number {
    return this.store.config().pointsPerManDayDefault;
  }
  set pointsPerManDayDefault(value: number) {
    this.store.updateConfig({ pointsPerManDayDefault: +value });
  }

  get fibonacciText(): string {
    return this.store.config().fibonacci.join(', ');
  }
  set fibonacciText(value: string) {
    const scale = value
      .split(',')
      .map(v => parseInt(v.trim(), 10))
      .filter(v => !isNaN(v) && v > 0)
      .sort((a, b) => a - b);
    if (scale.length >= 2) {
      this.store.updateConfig({ fibonacci: scale });
    }
  }

  // ==================== AXES CURSE ====================

  get axes(): CurseAxis[] {
    return this.store.config().curseAxes;
  }

  updateAxis(index: number, patch: Partial<CurseAxis>): void {
    const axes = this.store.config().curseAxes.map((a, i) => (i === index ? { ...a, ...patch } : a));
    this.store.updateConfig({ curseAxes: axes });
  }

  addAxis(): void {
    const axes = [
      ...this.store.config().curseAxes,
      {
        key: 'axis_' + generateId().slice(0, 5),
        label: 'Nouvel axe',
        color: '#64748b',
        weight: 1,
        enabled: true
      }
    ];
    this.store.updateConfig({ curseAxes: axes });
  }

  removeAxis(index: number): void {
    const axes = this.store.config().curseAxes.filter((_, i) => i !== index);
    if (axes.length >= 1) {
      this.store.updateConfig({ curseAxes: axes });
    }
  }

  // ==================== ITÉRATIONS ====================

  get iterations(): Iteration[] {
    return this.store.iterations();
  }

  addIteration(): void {
    this.store.createIteration();
  }

  // ==================== RECALIBRAGE ====================

  get pastIterationsWithData(): Iteration[] {
    return this.iterations.filter(
      it => it.isPast && it.actualVelocity !== null && this.manDays(it) > 0
    );
  }

  manDays(it: Iteration): number {
    return getEffectiveTeamManDays(it.capacity);
  }

  observedRatio(it: Iteration): number {
    const md = this.manDays(it);
    return md > 0 && it.actualVelocity !== null ? it.actualVelocity / md : 0;
  }

  get suggestedRatio(): number | null {
    const past = this.pastIterationsWithData;
    if (past.length === 0) return null;
    const avg = past.reduce((s, it) => s + this.observedRatio(it), 0) / past.length;
    return Math.round(avg * 100) / 100;
  }

  applySuggestedRatio(): void {
    const ratio = this.suggestedRatio;
    if (ratio === null) return;
    this.store.updateConfig({ pointsPerManDayDefault: ratio });
    // Appliquer aux itérations futures (non passées) sans capacité manuelle
    this.iterations
      .filter(it => !it.isPast && it.capacity.manualPoints === null)
      .forEach(it => this.store.updateIterationCapacity(it.id, { pointsPerManDay: ratio }));
  }

  onClose(): void {
    this.close.emit();
  }
}
