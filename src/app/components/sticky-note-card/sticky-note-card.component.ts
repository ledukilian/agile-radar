import { Component, Input, Output, EventEmitter, ElementRef, OnInit, OnDestroy, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import interact from 'interactjs';
import { StickyNote, STICKY_NOTE_COLORS } from '../../models/planning.model';

@Component({
  selector: 'app-sticky-note-card',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './sticky-note-card.component.html',
  styleUrl: './sticky-note-card.component.scss'
})
export class StickyNoteCardComponent implements OnInit, OnDestroy {
  @Input() note!: StickyNote;
  
  @Output() moved = new EventEmitter<{ x: number; y: number }>();
  @Output() resized = new EventEmitter<{ width: number; height: number }>();
  @Output() updated = new EventEmitter<Partial<StickyNote>>();
  @Output() deleted = new EventEmitter<void>();
  
  @ViewChild('noteElement') noteElement!: ElementRef<HTMLDivElement>;
  
  isEditing = false;
  showColorPicker = false;
  editableHeader = '';
  editableContent = '';
  editableFooter = '';
  
  colors = STICKY_NOTE_COLORS;
  
  private interactable: any;

  ngOnInit(): void {
    this.editableHeader = this.note.header;
    this.editableContent = this.note.content;
    this.editableFooter = this.note.footer;
  }

  ngAfterViewInit(): void {
    this.setupInteract();
  }

  ngOnDestroy(): void {
    if (this.interactable) {
      this.interactable.unset();
    }
  }

  private setupInteract(): void {
    const element = this.noteElement?.nativeElement;
    if (!element) return;

    this.interactable = interact(element)
      .draggable({
        inertia: true,
        modifiers: [
          interact.modifiers.restrictRect({
            restriction: 'parent',
            endOnly: true
          })
        ],
        autoScroll: true,
        listeners: {
          move: (event) => {
            const target = event.target;
            const x = (parseFloat(target.getAttribute('data-x')) || this.note.position.x) + event.dx;
            const y = (parseFloat(target.getAttribute('data-y')) || this.note.position.y) + event.dy;

            target.style.left = `${x}px`;
            target.style.top = `${y}px`;

            target.setAttribute('data-x', x.toString());
            target.setAttribute('data-y', y.toString());
          },
          end: (event) => {
            const x = parseFloat(event.target.getAttribute('data-x')) || this.note.position.x;
            const y = parseFloat(event.target.getAttribute('data-y')) || this.note.position.y;
            this.moved.emit({ x, y });
          }
        }
      })
      .resizable({
        edges: { left: false, right: true, bottom: true, top: false },
        listeners: {
          move: (event) => {
            const target = event.target;
            target.style.width = `${event.rect.width}px`;
            target.style.height = `${event.rect.height}px`;
          },
          end: (event) => {
            this.resized.emit({
              width: event.rect.width,
              height: event.rect.height
            });
          }
        },
        modifiers: [
          interact.modifiers.restrictSize({
            min: { width: 150, height: 150 },
            max: { width: 400, height: 500 }
          })
        ],
        inertia: true
      });
  }

  startEditing(): void {
    this.isEditing = true;
    this.editableHeader = this.note.header;
    this.editableContent = this.note.content;
    this.editableFooter = this.note.footer;
  }

  saveEditing(): void {
    this.isEditing = false;
    this.updated.emit({
      header: this.editableHeader,
      content: this.editableContent,
      footer: this.editableFooter
    });
  }

  cancelEditing(): void {
    this.isEditing = false;
    this.editableHeader = this.note.header;
    this.editableContent = this.note.content;
    this.editableFooter = this.note.footer;
  }

  toggleColorPicker(): void {
    this.showColorPicker = !this.showColorPicker;
  }

  selectColor(color: { name: string; value: string; textColor: string }): void {
    this.updated.emit({
      color: color.value,
      textColor: color.textColor
    });
    this.showColorPicker = false;
  }

  onDelete(): void {
    this.deleted.emit();
  }

  get noteStyle(): { [key: string]: string } {
    return {
      left: `${this.note.position.x}px`,
      top: `${this.note.position.y}px`,
      width: `${this.note.width}px`,
      height: `${this.note.height}px`,
      backgroundColor: this.note.color,
      color: this.note.textColor
    };
  }
}
