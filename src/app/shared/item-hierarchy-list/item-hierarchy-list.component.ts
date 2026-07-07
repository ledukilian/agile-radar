import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { flattenItemHierarchy, HierarchicalItemVM } from '../../core/utils/hierarchy.util';
import { ItemVM } from '../../features/workspace/workspace.types';
import { WorkItemCardComponent } from '../work-item-card/work-item-card.component';
import { IconComponent } from '../icon/icon.component';

@Component({
  selector: 'app-item-hierarchy-list',
  standalone: true,
  imports: [CommonModule, WorkItemCardComponent, IconComponent],
  templateUrl: './item-hierarchy-list.component.html',
  styleUrl: './item-hierarchy-list.component.scss'
})
export class ItemHierarchyListComponent {
  /** Réservé pour usage futur (backlog vs itération) — le filtrage est fait en amont. */
  @Input() containerIterationId: string | null = null;
  @Input() items: ItemVM[] = [];
  @Output() open = new EventEmitter<string>();

  get hierarchicalItems(): HierarchicalItemVM[] {
    return flattenItemHierarchy(this.items);
  }

  trackItem(_i: number, vm: HierarchicalItemVM): string {
    return vm.item.id;
  }
}
