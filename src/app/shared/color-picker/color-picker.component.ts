import {
  Component,
  ElementRef,
  EventEmitter,
  HostListener,
  Input,
  OnDestroy,
  Output,
  ViewChild,
  inject
} from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

/**
 * Sélecteur de couleur dédié et personnalisé (palette + saisie hex).
 * Le popover est téléporté sur document.body pour éviter le clipping des modales.
 */
@Component({
  selector: 'app-color-picker',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './color-picker.component.html',
  styleUrl: './color-picker.component.scss'
})
export class ColorPickerComponent implements OnDestroy {
  @Input() value = '#6366f1';
  @Input() size = 30;
  @Output() valueChange = new EventEmitter<string>();

  @ViewChild('swatch') swatchRef?: ElementRef<HTMLButtonElement>;
  @ViewChild('backdrop') backdropRef?: ElementRef<HTMLDivElement>;
  @ViewChild('popover') popoverRef?: ElementRef<HTMLDivElement>;

  private readonly document = inject(DOCUMENT);

  open = false;
  hexDraft = '';
  popoverStyle: Record<string, string> = {};
  private scrollListener?: () => void;

  readonly palette: string[] = [
    '#1F1F1F', '#64748b', '#94a3b8', '#e2e8f0',
    '#ef4444', '#f97316', '#f59e0b', '#eab308',
    '#84cc16', '#22c55e', '#10b981', '#14b8a6',
    '#06b6d4', '#0ea5e9', '#3b82f6', '#6366f1',
    '#8b5cf6', '#a855f7', '#d946ef', '#ec4899',
    '#f43f5e', '#78716c', '#0f766e', '#1d4ed8'
  ];

  toggle(): void {
    if (this.open) {
      this.close();
      return;
    }
    this.open = true;
    this.hexDraft = this.value;
    requestAnimationFrame(() => this.openOverlay());
  }

  close(): void {
    this.detachScrollListener();
    this.open = false;
  }

  isSelected(c: string): boolean {
    return c.toLowerCase() === (this.value || '').toLowerCase();
  }

  pick(c: string): void {
    this.valueChange.emit(c);
    this.close();
  }

  applyHex(): void {
    const v = this.normalize(this.hexDraft);
    if (v) {
      this.valueChange.emit(v);
      this.close();
    }
  }

  ngOnDestroy(): void {
    this.detachScrollListener();
  }

  @HostListener('window:resize')
  onResize(): void {
    if (this.open) {
      this.updatePopoverPosition();
    }
  }

  @HostListener('window:scroll')
  onScroll(): void {
    if (this.open) {
      this.close();
    }
  }

  private openOverlay(): void {
    if (!this.open) return;
    if (!this.popoverRef?.nativeElement) {
      setTimeout(() => this.openOverlay(), 0);
      return;
    }
    this.updatePopoverPosition();
    this.moveOverlayToBody();
  }

  private attachScrollListener(): void {
    this.detachScrollListener();
    this.scrollListener = () => {
      if (this.open) {
        this.close();
      }
    };
    this.document.addEventListener('scroll', this.scrollListener, true);
  }

  private detachScrollListener(): void {
    if (!this.scrollListener) return;
    this.document.removeEventListener('scroll', this.scrollListener, true);
    this.scrollListener = undefined;
  }

  private moveOverlayToBody(): void {
    const body = this.document.body;
    const backdrop = this.backdropRef?.nativeElement;
    const popover = this.popoverRef?.nativeElement;
    if (backdrop && backdrop.parentElement !== body) {
      body.appendChild(backdrop);
    }
    if (popover && popover.parentElement !== body) {
      body.appendChild(popover);
    }
    this.attachScrollListener();
  }

  private updatePopoverPosition(): void {
    const el = this.swatchRef?.nativeElement;
    if (!el) return;

    const rect = el.getBoundingClientRect();
    const gap = 6;
    const popoverWidth = 208;
    const popoverHeight = 160;
    const spaceBelow = window.innerHeight - rect.bottom - gap;
    const spaceAbove = rect.top - gap;
    const openUp = spaceBelow < popoverHeight && spaceAbove > spaceBelow;

    let left = rect.left;
    if (left + popoverWidth > window.innerWidth - 8) {
      left = window.innerWidth - popoverWidth - 8;
    }
    left = Math.max(8, left);

    const base: Record<string, string> = {
      position: 'fixed',
      left: `${left}px`,
      width: `${popoverWidth}px`,
      zIndex: '10001'
    };

    if (openUp) {
      this.popoverStyle = {
        ...base,
        bottom: `${window.innerHeight - rect.top + gap}px`
      };
    } else {
      this.popoverStyle = {
        ...base,
        top: `${rect.bottom + gap}px`
      };
    }
  }

  private normalize(input: string): string | null {
    let h = (input || '').trim();
    if (!h) return null;
    if (!h.startsWith('#')) h = '#' + h;
    return /^#([0-9a-fA-F]{6}|[0-9a-fA-F]{3})$/.test(h) ? h : null;
  }
}
