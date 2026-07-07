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
import { IconComponent } from '../icon/icon.component';

export interface SelectOption {
  value: string;
  label: string;
  icon?: string;
  color?: string;
}

/**
 * Select personnalisé (rendu "app propriétaire") remplaçant le <select> natif.
 * Le panneau est téléporté sur document.body pour éviter le clipping des modales.
 */
@Component({
  selector: 'app-select',
  standalone: true,
  imports: [CommonModule, IconComponent],
  templateUrl: './select.component.html',
  styleUrl: './select.component.scss'
})
export class SelectComponent implements OnDestroy {
  @Input() options: SelectOption[] = [];
  @Input() value: string | null = '';
  @Input() placeholder = 'Choisir…';
  @Input() dense = false;

  @Output() valueChange = new EventEmitter<string>();

  @ViewChild('trigger') triggerRef?: ElementRef<HTMLButtonElement>;
  @ViewChild('backdrop') backdropRef?: ElementRef<HTMLDivElement>;
  @ViewChild('panel') panelRef?: ElementRef<HTMLDivElement>;

  private readonly document = inject(DOCUMENT);

  open = false;
  panelStyle: Record<string, string> = {};
  private scrollListener?: () => void;

  get selected(): SelectOption | undefined {
    return this.options.find(o => o.value === (this.value ?? ''));
  }

  toggle(): void {
    if (this.open) {
      this.close();
      return;
    }
    this.open = true;
    // Attendre le rendu du panneau avant positionnement + téléportation.
    requestAnimationFrame(() => this.openOverlay());
  }

  private openOverlay(): void {
    if (!this.open) return;
    if (!this.panelRef?.nativeElement) {
      setTimeout(() => this.openOverlay(), 0);
      return;
    }
    this.updatePanelPosition();
    this.moveOverlayToBody();
  }

  close(): void {
    this.detachScrollListener();
    this.open = false;
  }

  select(o: SelectOption): void {
    this.valueChange.emit(o.value);
    this.close();
  }

  isSelected(o: SelectOption): boolean {
    return o.value === (this.value ?? '');
  }

  ngOnDestroy(): void {
    this.detachScrollListener();
  }

  @HostListener('window:resize')
  onResize(): void {
    if (this.open) {
      this.updatePanelPosition();
    }
  }

  @HostListener('window:scroll')
  onScroll(): void {
    if (this.open) {
      this.close();
    }
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
    const panel = this.panelRef?.nativeElement;
    if (backdrop && backdrop.parentElement !== body) {
      body.appendChild(backdrop);
    }
    if (panel && panel.parentElement !== body) {
      body.appendChild(panel);
    }
    this.attachScrollListener();
  }

  private updatePanelPosition(): void {
    const el = this.triggerRef?.nativeElement;
    if (!el) return;

    const rect = el.getBoundingClientRect();
    const gap = 5;
    const maxPanel = 260;
    const spaceBelow = window.innerHeight - rect.bottom - gap;
    const spaceAbove = rect.top - gap;
    const openUp = spaceBelow < 120 && spaceAbove > spaceBelow;

    const base: Record<string, string> = {
      position: 'fixed',
      left: `${rect.left}px`,
      width: `${Math.max(rect.width, 80)}px`,
      zIndex: '10001'
    };

    if (openUp) {
      this.panelStyle = {
        ...base,
        bottom: `${window.innerHeight - rect.top + gap}px`,
        maxHeight: `${Math.min(maxPanel, spaceAbove)}px`
      };
    } else {
      this.panelStyle = {
        ...base,
        top: `${rect.bottom + gap}px`,
        maxHeight: `${Math.min(maxPanel, spaceBelow)}px`
      };
    }
  }
}
