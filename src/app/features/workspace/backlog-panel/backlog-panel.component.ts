import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  WorkItemType,
  WORK_ITEM_TYPE_LIST,
  getTypeMeta,
  WorkItemTypeMeta
} from '../../../core/models/work-item.model';
import { ItemHierarchyListComponent } from '../../../shared/item-hierarchy-list/item-hierarchy-list.component';
import { IconComponent } from '../../../shared/icon/icon.component';
import { ItemVM } from '../workspace.types';

@Component({
  selector: 'app-backlog-panel',
  standalone: true,
  imports: [CommonModule, FormsModule, ItemHierarchyListComponent, IconComponent],
  templateUrl: './backlog-panel.component.html',
  styleUrl: './backlog-panel.component.scss'
})
export class BacklogPanelComponent {
  @Input() items: ItemVM[] = [];
  @Input() isDropTarget = false;

  @Output() openItem = new EventEmitter<string>();
  @Output() createItem = new EventEmitter<WorkItemType>();
  @Output() dropToBacklog = new EventEmitter<string>();
  @Output() dragEnterBacklog = new EventEmitter<void>();
  @Output() dragLeaveBacklog = new EventEmitter<void>();

  showCreateMenu = false;
  search = '';

  readonly types = WORK_ITEM_TYPE_LIST;
  meta = getTypeMeta;

  get filteredItems(): ItemVM[] {
    const q = this.search.trim().toLowerCase();
    if (!q) return this.items;
    return this.items.filter(vm => vm.item.title.toLowerCase().includes(q));
  }

  typeMeta(type: WorkItemType): WorkItemTypeMeta {
    return getTypeMeta(type);
  }

  toggleCreateMenu(): void {
    this.showCreateMenu = !this.showCreateMenu;
  }

  onCreate(type: WorkItemType): void {
    this.createItem.emit(type);
    this.showCreateMenu = false;
  }

  onDragOver(event: DragEvent): void {
    event.preventDefault();
    if (event.dataTransfer) event.dataTransfer.dropEffect = 'move';
    this.dragEnterBacklog.emit();
  }

  onDragLeave(): void {
    this.dragLeaveBacklog.emit();
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    const id = event.dataTransfer?.getData('text/plain');
    if (id) this.dropToBacklog.emit(id);
    this.dragLeaveBacklog.emit();
  }
}
