import { Component, EventEmitter, Input, Output, computed, effect, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ProjectStore } from '../../core/store/project.store';
import { IterationFormComponent } from '../../shared/iteration-form/iteration-form.component';
import { IconComponent } from '../../shared/icon/icon.component';

@Component({
  selector: 'app-iteration-settings',
  standalone: true,
  imports: [CommonModule, IterationFormComponent, IconComponent],
  templateUrl: './iteration-settings.component.html',
  styleUrl: './iteration-settings.component.scss'
})
export class IterationSettingsComponent {
  @Input({ required: true }) set iterationId(value: string) {
    this._iterationId.set(value);
  }
  @Output() close = new EventEmitter<void>();

  private readonly _iterationId = signal('');
  private readonly store = inject(ProjectStore);

  readonly iteration = computed(() =>
    this.store.iterations().find(it => it.id === this._iterationId())
  );

  constructor() {
    effect(() => {
      const id = this._iterationId();
      if (id && !this.iteration()) {
        this.close.emit();
      }
    });
  }

  get iterationIdValue(): string {
    return this._iterationId();
  }

  onClose(): void {
    this.close.emit();
  }
}
