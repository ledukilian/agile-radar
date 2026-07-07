import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { WorkItem, getTypeMeta } from '../../core/models/work-item.model';
import { ItemSchedule } from '../../core/scheduling/scheduling.types';
import { IconComponent } from '../icon/icon.component';
import { extractJiraTicketKey } from '../../core/utils/jira.util';

/**
 * Carte d'un WorkItem, utilisée dans le backlog et dans les itérations.
 * Draggable en natif (HTML5 DnD) : sérialise l'id dans le dataTransfer.
 */
@Component({
  selector: 'app-work-item-card',
  standalone: true,
  imports: [CommonModule, IconComponent],
  templateUrl: './work-item-card.component.html',
  styleUrl: './work-item-card.component.scss'
})
export class WorkItemCardComponent {
  @Input({ required: true }) item!: WorkItem;
  @Input() schedule?: ItemSchedule;
  @Input() hasChildren = false;
  @Input() childCount = 0;
  @Input() depViolation = false;
  @Input() depCount = 0;
  @Input() depth = 0;

  @Output() open = new EventEmitter<string>();
  @Output() dragStarted = new EventEmitter<string>();
  @Output() dragEnded = new EventEmitter<void>();

  get meta() {
    return getTypeMeta(this.item.type);
  }

  get effectivePoints(): number {
    return this.schedule ? this.schedule.effectivePoints : this.item.points;
  }

  get landingLabel(): string {
    if (!this.schedule || this.schedule.landingIndex === null) return '';
    const start = this.schedule.startIndex;
    const land = this.schedule.landingIndex;
    if (start !== null && land !== null && start !== land) {
      return `It. ${start + 1} → ${land + 1}`;
    }
    return `It. ${land + 1}`;
  }

  get hasWarning(): boolean {
    return (
      this.depViolation ||
      !!this.schedule?.tooBig ||
      !!this.schedule?.overflow
    );
  }

  get warningText(): string {
    if (this.schedule?.tooBig) return 'Trop grosse pour une itération — à découper';
    if (this.schedule?.overflow) return "Déborde au-delà de l'horizon des itérations";
    if (this.depViolation) return 'Dépendance non respectée';
    return '';
  }

  get jiraTicketKey(): string | null {
    return extractJiraTicketKey(this.item.jiraUrl);
  }

  onJiraClick(event: MouseEvent): void {
    event.stopPropagation();
    if (this.item.jiraUrl) window.open(this.item.jiraUrl, '_blank', 'noopener');
  }

  onDragStart(event: DragEvent): void {
    if (event.dataTransfer) {
      event.dataTransfer.setData('text/plain', this.item.id);
      event.dataTransfer.effectAllowed = 'move';
    }
    this.dragStarted.emit(this.item.id);
  }

  onDragEnd(): void {
    this.dragEnded.emit();
  }

  onDblClick(): void {
    this.open.emit(this.item.id);
  }
}
