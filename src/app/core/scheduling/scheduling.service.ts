import { Injectable, Signal, computed, inject } from '@angular/core';
import { ProjectStore } from '../store/project.store';
import { schedule } from './scheduler';
import { ScheduleResult, ItemSchedule, IterationLoad } from './scheduling.types';

/**
 * Expose le résultat d'ordonnancement de façon réactive, recalculé
 * automatiquement quand le projet change (bouton "Recalculer" = simple lecture,
 * le calcul étant déjà à jour).
 */
@Injectable({ providedIn: 'root' })
export class SchedulingService {
  private readonly store = inject(ProjectStore);

  readonly result: Signal<ScheduleResult> = computed(() => {
    const project = this.store.project();
    return schedule(project);
  });

  itemSchedule(itemId: string): ItemSchedule | undefined {
    return this.result().itemSchedules.get(itemId);
  }

  iterationLoad(iterationId: string): IterationLoad | undefined {
    return this.result().iterationLoads.get(iterationId);
  }
}
