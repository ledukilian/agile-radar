import { Component, EventEmitter, Output, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ProjectStore } from '../../core/store/project.store';
import { SchedulingService } from '../../core/scheduling/scheduling.service';
import { getTypeMeta } from '../../core/models/work-item.model';
import { IconComponent } from '../../shared/icon/icon.component';

interface Insight {
  type: 'success' | 'warning' | 'danger' | 'info';
  icon: string;
  title: string;
  text: string;
  itemId?: string;
}

/**
 * Insights basés sur les DONNÉES réelles (remplace les anciens "Conseils" génériques).
 */
@Component({
  selector: 'app-insights-panel',
  standalone: true,
  imports: [CommonModule, IconComponent],
  templateUrl: './insights-panel.component.html',
  styleUrl: './insights-panel.component.scss'
})
export class InsightsPanelComponent {
  @Output() openItem = new EventEmitter<string>();

  readonly store = inject(ProjectStore);
  readonly scheduling = inject(SchedulingService);

  readonly insights = computed<Insight[]>(() => {
    const result = this.scheduling.result();
    const items = this.store.items();
    const iterations = this.store.iterations();
    const titleOf = (id: string) => items.find(i => i.id === id)?.title ?? '—';
    const list: Insight[] = [];

    // Itérations : surcharge / empiètement réserve / proche saturation
    for (const it of iterations) {
      const load = result.iterationLoads.get(it.id);
      if (!load) continue;
      if (load.status === 'overloaded') {
        list.push({
          type: 'danger',
          icon: 'alert-octagon',
          title: `${it.name} surchargée`,
          text: `Dépasse la capacité nette de ${Math.round(load.usedPoints - load.netCapacity)} pts (${load.usedPoints}/${load.netCapacity}).`
        });
      } else if (load.usedPoints > load.netCapacity && load.usedPoints <= load.capacity) {
        list.push({
          type: 'warning',
          icon: 'alert-triangle',
          title: `${it.name} empiète sur la réserve`,
          text: `La charge dépasse la capacité nette et grignote les réserves (${load.usedPoints}/${load.netCapacity}).`
        });
      } else if (load.status === 'warning') {
        list.push({
          type: 'warning',
          icon: 'alert-triangle',
          title: `${it.name} proche saturation`,
          text: `Charge à ${load.loadPercentage}% de la capacité nette. Gardez une marge.`
        });
      }
    }

    // Feuilles trop grosses
    for (const id of result.tooBigItemIds) {
      list.push({
        type: 'danger',
        icon: 'scissors',
        title: `"${titleOf(id)}" trop grosse`,
        text: 'Cet élément ne tient pas dans une itération. Découpez-le.',
        itemId: id
      });
    }

    // Débordements
    for (const id of result.overflowItemIds) {
      if (result.tooBigItemIds.includes(id)) continue;
      list.push({
        type: 'warning',
        icon: 'send',
        title: `"${titleOf(id)}" déborde`,
        text: "Pas de capacité disponible dans l'horizon des itérations. Ajoutez une itération ou allégez.",
        itemId: id
      });
    }

    // Dépendances violées
    for (const v of result.dependencyViolations) {
      list.push({
        type: 'danger',
        icon: 'link',
        title: 'Dépendance non respectée',
        text: `"${titleOf(v.sourceId)}" doit précéder "${titleOf(v.targetId)}" — ${v.reason}`,
        itemId: v.targetId
      });
    }

    // Features/Epics qui s'étalent (glissement)
    for (const item of items) {
      if (item.type !== 'feature' && item.type !== 'epic') continue;
      const s = result.itemSchedules.get(item.id);
      if (!s || s.startIndex === null || s.landingIndex === null) continue;
      if (s.landingIndex > s.startIndex) {
        list.push({
          type: 'info',
          icon: getTypeMeta(item.type).icon,
          title: `"${item.title}" s'étale`,
          text: `Démarre It. ${s.startIndex + 1} et atterrit It. ${s.landingIndex + 1} (${s.landingIndex - s.startIndex + 1} itérations).`,
          itemId: item.id
        });
      }
    }

    if (list.length === 0) {
      list.push({
        type: 'success',
        icon: 'check-circle',
        title: 'Tout est sous contrôle',
        text: 'Aucune surcharge, aucun débordement ni dépendance violée détectés.'
      });
    }

    return list;
  });

  colorFor(type: Insight['type']): string {
    switch (type) {
      case 'danger':
        return '#ef4444';
      case 'warning':
        return '#f59e0b';
      case 'success':
        return '#22c55e';
      default:
        return '#3b82f6';
    }
  }

  onClick(insight: Insight): void {
    if (insight.itemId) this.openItem.emit(insight.itemId);
  }
}
