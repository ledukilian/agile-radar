import { Component, EventEmitter, Input, Output, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ProjectStore } from '../../core/store/project.store';
import { SchedulingService } from '../../core/scheduling/scheduling.service';
import {
  WorkItem,
  WorkItemType,
  WORK_ITEM_TYPE_LIST,
  getTypeMeta,
  canBeParent,
  WorkItemTypeMeta
} from '../../core/models/work-item.model';
import { Dependency, DependencyType, DEPENDENCY_TYPE_LABELS } from '../../core/models/dependency.model';
import { computeEffectivePoints, getChildren, suggestPointsFromCurse } from '../../core/estimation/estimation.util';
import { RadarChartComponent } from '../../shared/radar-chart/radar-chart.component';
import { IconComponent } from '../../shared/icon/icon.component';
import { SelectComponent, SelectOption } from '../../shared/select/select.component';
import { extractJiraTicketKey } from '../../core/utils/jira.util';

@Component({
  selector: 'app-item-detail',
  standalone: true,
  imports: [CommonModule, FormsModule, RadarChartComponent, IconComponent, SelectComponent],
  templateUrl: './item-detail.component.html',
  styleUrl: './item-detail.component.scss'
})
export class ItemDetailComponent {
  @Input({ required: true }) set itemId(value: string) {
    this._itemId.set(value);
  }
  @Output() close = new EventEmitter<void>();
  @Output() openItem = new EventEmitter<string>();

  private readonly _itemId = signal<string>('');
  readonly store = inject(ProjectStore);
  readonly scheduling = inject(SchedulingService);

  readonly types = WORK_ITEM_TYPE_LIST;
  readonly depTypeLabels = DEPENDENCY_TYPE_LABELS;
  suggestedPoints: number | null = null;
  showRadar = false;

  // dépendance en cours d'ajout
  newDepTarget = '';
  newDepType: DependencyType = 'must-precede';

  readonly item = computed<WorkItem | undefined>(() =>
    this.store.items().find(i => i.id === this._itemId())
  );

  readonly children = computed<WorkItem[]>(() => {
    const it = this.item();
    return it ? getChildren(it.id, this.store.items()) : [];
  });

  readonly hasChildren = computed(() => this.children().length > 0);

  readonly effectivePoints = computed(() => {
    const it = this.item();
    return it ? computeEffectivePoints(it, this.store.items()) : 0;
  });

  readonly schedule = computed(() => {
    const it = this.item();
    return it ? this.scheduling.result().itemSchedules.get(it.id) : undefined;
  });

  get config() {
    return this.store.config();
  }

  meta = getTypeMeta;

  typeMeta(t: WorkItemType): WorkItemTypeMeta {
    return getTypeMeta(t);
  }

  // ==================== OPTIONS DE SELECT ====================

  readonly typeOptions = computed<SelectOption[]>(() =>
    this.types.map(t => {
      const m = getTypeMeta(t);
      return { value: t, label: m.label, icon: m.icon, color: m.color };
    })
  );

  readonly parentOptions = computed<SelectOption[]>(() => [
    { value: '', label: '— Aucun —' },
    ...this.eligibleParents().map(p => {
      const m = getTypeMeta(p.type);
      return { value: p.id, label: p.title || '(sans titre)', icon: m.icon, color: m.color };
    })
  ]);

  readonly iterationOptions = computed<SelectOption[]>(() => [
    { value: '', label: '— Backlog —' },
    ...this.iterations.map(itr => ({ value: itr.id, label: itr.name }))
  ]);

  readonly depTargetOptions = computed<SelectOption[]>(() => [
    { value: '', label: 'Choisir un élément…' },
    ...this.otherItems().map(o => {
      const m = getTypeMeta(o.type);
      return { value: o.id, label: o.title || '(sans titre)', icon: m.icon, color: m.color };
    })
  ]);

  // ==================== CHAMPS ====================

  update(patch: Partial<WorkItem>): void {
    const it = this.item();
    if (it) this.store.updateItem(it.id, patch);
  }

  setType(type: string): void {
    this.update({ type: type as WorkItemType });
  }

  setPoints(points: number): void {
    this.update({ points, pointsManual: true });
    this.suggestedPoints = null;
  }

  // ==================== PARENT ====================

  readonly eligibleParents = computed<WorkItem[]>(() => {
    const it = this.item();
    if (!it) return [];
    const descendants = this.collectDescendants(it.id);
    return this.store.items().filter(
      candidate =>
        candidate.id !== it.id &&
        !descendants.has(candidate.id) &&
        canBeParent(candidate.type, it.type)
    );
  });

  private collectDescendants(id: string): Set<string> {
    const set = new Set<string>();
    const walk = (parentId: string) => {
      for (const child of this.store.items().filter(i => i.parentId === parentId)) {
        if (!set.has(child.id)) {
          set.add(child.id);
          walk(child.id);
        }
      }
    };
    walk(id);
    return set;
  }

  setParent(parentId: string): void {
    this.update({ parentId: parentId || null });
  }

  // ==================== PLACEMENT ====================

  get iterations() {
    return this.store.iterations();
  }

  setIteration(iterationId: string): void {
    const it = this.item();
    if (it) this.store.placeItem(it.id, iterationId || null);
  }

  // ==================== RADAR / CURSE ====================

  get activeAxes() {
    return this.config.curseAxes.filter(a => a.enabled);
  }

  curseValue(key: string): number {
    return this.item()?.curse[key] ?? 0;
  }

  setCurse(key: string, value: number): void {
    const it = this.item();
    if (!it) return;
    const curse = { ...it.curse, [key]: +value };
    this.store.updateItem(it.id, { curse });
  }

  computeSuggestion(): void {
    const it = this.item();
    if (!it) return;
    this.suggestedPoints = suggestPointsFromCurse(it.curse, this.config.curseAxes, this.config.fibonacci);
  }

  applySuggestion(): void {
    if (this.suggestedPoints !== null) {
      this.setPoints(this.suggestedPoints);
    }
  }

  toggleRadar(): void {
    this.showRadar = !this.showRadar;
    if (this.showRadar) this.computeSuggestion();
  }

  jiraTicketKey(url: string | null | undefined): string | null {
    return extractJiraTicketKey(url);
  }

  setJiraUrl(url: string): void {
    this.update({ jiraUrl: url.trim() || null });
  }

  // ==================== DÉPENDANCES ====================

  readonly outgoingDeps = computed<Dependency[]>(() => {
    const it = this.item();
    return it ? this.store.dependencies().filter(d => d.sourceId === it.id) : [];
  });

  readonly incomingDeps = computed<Dependency[]>(() => {
    const it = this.item();
    return it ? this.store.dependencies().filter(d => d.targetId === it.id) : [];
  });

  readonly otherItems = computed<WorkItem[]>(() => {
    const it = this.item();
    return this.store.items().filter(i => i.id !== it?.id);
  });

  itemTitle(id: string): string {
    return this.store.items().find(i => i.id === id)?.title ?? '—';
  }

  addDependency(): void {
    const it = this.item();
    if (!it || !this.newDepTarget) return;
    this.store.addDependency(it.id, this.newDepTarget, this.newDepType, '');
    this.newDepTarget = '';
  }

  removeDependency(id: string): void {
    this.store.deleteDependency(id);
  }

  // ==================== ACTIONS ====================

  deleteItem(): void {
    const it = this.item();
    if (it && confirm(`Supprimer "${it.title}" ?`)) {
      this.store.deleteItem(it.id);
      this.close.emit();
    }
  }

  onClose(): void {
    this.close.emit();
  }
}
