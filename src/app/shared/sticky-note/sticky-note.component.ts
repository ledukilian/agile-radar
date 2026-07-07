import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { StickyNote, STICKY_NOTE_COLORS } from '../../core/models/board-extras.model';
import { Position } from '../../core/models/work-item.model';
import { IconComponent } from '../icon/icon.component';

@Component({
  selector: 'app-sticky-note',
  standalone: true,
  imports: [CommonModule, FormsModule, IconComponent],
  templateUrl: './sticky-note.component.html',
  styleUrl: './sticky-note.component.scss'
})
export class StickyNoteComponent {
  @Input({ required: true }) note!: StickyNote;
  @Input() zoom = 1;

  @Output() moved = new EventEmitter<Position>();
  @Output() contentChange = new EventEmitter<string>();
  @Output() colorChange = new EventEmitter<{ color: string; textColor: string }>();
  @Output() remove = new EventEmitter<void>();

  readonly colors = STICKY_NOTE_COLORS;
  showColors = false;

  private dragging = false;
  private startX = 0;
  private startY = 0;
  private origin: Position = { x: 0, y: 0 };

  onDragStart(event: MouseEvent): void {
    event.stopPropagation();
    this.dragging = true;
    this.startX = event.clientX;
    this.startY = event.clientY;
    this.origin = { ...this.note.position };
    const move = (e: MouseEvent) => this.onDragMove(e);
    const up = () => {
      this.dragging = false;
      window.removeEventListener('mousemove', move);
      window.removeEventListener('mouseup', up);
    };
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
  }

  private onDragMove(event: MouseEvent): void {
    if (!this.dragging) return;
    const dx = (event.clientX - this.startX) / this.zoom;
    const dy = (event.clientY - this.startY) / this.zoom;
    this.moved.emit({ x: this.origin.x + dx, y: this.origin.y + dy });
  }

  pickColor(c: { value: string; textColor: string }): void {
    this.colorChange.emit({ color: c.value, textColor: c.textColor });
    this.showColors = false;
  }
}
