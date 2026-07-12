import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

export type IconName =
  // Types d'éléments
  | 'epic' | 'feature' | 'user-story' | 'enabler' | 'bug' | 'spike' | 'task'
  // Actions / UI
  | 'settings' | 'radar' | 'download' | 'upload' | 'file-plus' | 'close'
  | 'arrow-up' | 'arrow-down' | 'trash' | 'plus' | 'minus' | 'edit' | 'note'
  | 'camera' | 'help' | 'grid' | 'dots' | 'save' | 'search' | 'chevron-down'
  | 'link' | 'alert-triangle' | 'alert-octagon' | 'scissors' | 'check-circle'
  | 'send' | 'calendar' | 'lightbulb' | 'move' | 'reset' | 'flag'
  | 'message-circle' | 'tag';

/**
 * Jeu d'icônes SVG maison (style trait, colorable via `currentColor`).
 * Remplace les emojis pour un rendu "app propriétaire" cohérent.
 */
@Component({
  selector: 'app-icon',
  standalone: true,
  imports: [CommonModule],
  template: `
    <svg
      [attr.width]="size"
      [attr.height]="size"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      [attr.stroke-width]="strokeWidth"
      stroke-linecap="round"
      stroke-linejoin="round"
      [style.color]="color || null"
      [style.display]="'inline-block'"
      [style.verticalAlign]="'-0.15em'"
      [ngSwitch]="name"
    >
      <!-- ===== Types ===== -->
      <ng-container *ngSwitchCase="'epic'">
        <polygon points="12 2 2 7 12 12 22 7 12 2" />
        <polyline points="2 17 12 22 22 17" />
        <polyline points="2 12 12 17 22 12" />
      </ng-container>
      <ng-container *ngSwitchCase="'feature'">
        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
      </ng-container>
      <ng-container *ngSwitchCase="'user-story'">
        <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
        <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
      </ng-container>
      <ng-container *ngSwitchCase="'enabler'">
        <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
      </ng-container>
      <ng-container *ngSwitchCase="'bug'">
        <path d="M8 2l1.5 2.5" />
        <path d="M16 2l-1.5 2.5" />
        <rect x="7" y="6" width="10" height="12" rx="5" />
        <line x1="12" y1="8" x2="12" y2="18" />
        <line x1="7" y1="9" x2="3" y2="7" />
        <line x1="7" y1="13" x2="3" y2="13" />
        <line x1="7" y1="17" x2="3" y2="19" />
        <line x1="17" y1="9" x2="21" y2="7" />
        <line x1="17" y1="13" x2="21" y2="13" />
        <line x1="17" y1="17" x2="21" y2="19" />
      </ng-container>
      <ng-container *ngSwitchCase="'spike'">
        <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
      </ng-container>
      <ng-container *ngSwitchCase="'task'">
        <polyline points="9 11 12 14 22 4" />
        <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
      </ng-container>

      <!-- ===== UI / actions ===== -->
      <ng-container *ngSwitchCase="'settings'">
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
      </ng-container>
      <ng-container *ngSwitchCase="'radar'">
        <circle cx="12" cy="12" r="9" />
        <circle cx="12" cy="12" r="5" />
        <circle cx="12" cy="12" r="1.4" fill="currentColor" stroke="none" />
        <line x1="12" y1="12" x2="19" y2="6.5" />
      </ng-container>
      <ng-container *ngSwitchCase="'download'">
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
        <polyline points="7 10 12 15 17 10" />
        <line x1="12" y1="15" x2="12" y2="3" />
      </ng-container>
      <ng-container *ngSwitchCase="'upload'">
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
        <polyline points="17 8 12 3 7 8" />
        <line x1="12" y1="3" x2="12" y2="15" />
      </ng-container>
      <ng-container *ngSwitchCase="'file-plus'">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
        <line x1="12" y1="18" x2="12" y2="12" />
        <line x1="9" y1="15" x2="15" y2="15" />
      </ng-container>
      <ng-container *ngSwitchCase="'close'">
        <line x1="18" y1="6" x2="6" y2="18" />
        <line x1="6" y1="6" x2="18" y2="18" />
      </ng-container>
      <ng-container *ngSwitchCase="'arrow-up'">
        <line x1="12" y1="19" x2="12" y2="5" />
        <polyline points="5 12 12 5 19 12" />
      </ng-container>
      <ng-container *ngSwitchCase="'arrow-down'">
        <line x1="12" y1="5" x2="12" y2="19" />
        <polyline points="19 12 12 19 5 12" />
      </ng-container>
      <ng-container *ngSwitchCase="'trash'">
        <polyline points="3 6 5 6 21 6" />
        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
        <line x1="10" y1="11" x2="10" y2="17" />
        <line x1="14" y1="11" x2="14" y2="17" />
      </ng-container>
      <ng-container *ngSwitchCase="'plus'">
        <line x1="12" y1="5" x2="12" y2="19" />
        <line x1="5" y1="12" x2="19" y2="12" />
      </ng-container>
      <ng-container *ngSwitchCase="'minus'">
        <line x1="5" y1="12" x2="19" y2="12" />
      </ng-container>
      <ng-container *ngSwitchCase="'edit'">
        <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
      </ng-container>
      <ng-container *ngSwitchCase="'note'">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
        <line x1="16" y1="13" x2="8" y2="13" />
        <line x1="16" y1="17" x2="8" y2="17" />
        <line x1="10" y1="9" x2="8" y2="9" />
      </ng-container>
      <ng-container *ngSwitchCase="'camera'">
        <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
        <circle cx="12" cy="13" r="4" />
      </ng-container>
      <ng-container *ngSwitchCase="'help'">
        <circle cx="12" cy="12" r="10" />
        <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
        <line x1="12" y1="17" x2="12.01" y2="17" />
      </ng-container>
      <ng-container *ngSwitchCase="'grid'">
        <rect x="3" y="3" width="7" height="7" />
        <rect x="14" y="3" width="7" height="7" />
        <rect x="14" y="14" width="7" height="7" />
        <rect x="3" y="14" width="7" height="7" />
      </ng-container>
      <ng-container *ngSwitchCase="'dots'">
        <circle cx="12" cy="12" r="1.6" fill="currentColor" stroke="none" />
        <circle cx="19" cy="12" r="1.6" fill="currentColor" stroke="none" />
        <circle cx="5" cy="12" r="1.6" fill="currentColor" stroke="none" />
      </ng-container>
      <ng-container *ngSwitchCase="'save'">
        <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
        <polyline points="17 21 17 13 7 13 7 21" />
        <polyline points="7 3 7 8 15 8" />
      </ng-container>
      <ng-container *ngSwitchCase="'search'">
        <circle cx="11" cy="11" r="8" />
        <line x1="21" y1="21" x2="16.65" y2="16.65" />
      </ng-container>
      <ng-container *ngSwitchCase="'chevron-down'">
        <polyline points="6 9 12 15 18 9" />
      </ng-container>
      <ng-container *ngSwitchCase="'link'">
        <path d="M15 7h3a5 5 0 0 1 5 5 5 5 0 0 1-5 5h-3m-6 0H6a5 5 0 0 1-5-5 5 5 0 0 1 5-5h3" />
        <line x1="8" y1="12" x2="16" y2="12" />
      </ng-container>
      <ng-container *ngSwitchCase="'alert-triangle'">
        <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
        <line x1="12" y1="9" x2="12" y2="13" />
        <line x1="12" y1="17" x2="12.01" y2="17" />
      </ng-container>
      <ng-container *ngSwitchCase="'alert-octagon'">
        <polygon points="7.86 2 16.14 2 22 7.86 22 16.14 16.14 22 7.86 22 2 16.14 2 7.86 7.86 2" />
        <line x1="12" y1="8" x2="12" y2="12" />
        <line x1="12" y1="16" x2="12.01" y2="16" />
      </ng-container>
      <ng-container *ngSwitchCase="'scissors'">
        <circle cx="6" cy="6" r="3" />
        <circle cx="6" cy="18" r="3" />
        <line x1="20" y1="4" x2="8.12" y2="15.88" />
        <line x1="14.47" y1="14.48" x2="20" y2="20" />
        <line x1="8.12" y1="8.12" x2="12" y2="12" />
      </ng-container>
      <ng-container *ngSwitchCase="'check-circle'">
        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
        <polyline points="22 4 12 14.01 9 11.01" />
      </ng-container>
      <ng-container *ngSwitchCase="'send'">
        <line x1="22" y1="2" x2="11" y2="13" />
        <polygon points="22 2 15 22 11 13 2 9 22 2" />
      </ng-container>
      <ng-container *ngSwitchCase="'calendar'">
        <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
        <line x1="16" y1="2" x2="16" y2="6" />
        <line x1="8" y1="2" x2="8" y2="6" />
        <line x1="3" y1="10" x2="21" y2="10" />
      </ng-container>
      <ng-container *ngSwitchCase="'lightbulb'">
        <path d="M9 18h6" />
        <path d="M10 22h4" />
        <path d="M15.09 14c.18-.98.65-1.74 1.41-2.5A4.65 4.65 0 0 0 18 8 6 6 0 0 0 6 8c0 1 .23 2.23 1.5 3.5.76.76 1.23 1.52 1.41 2.5" />
      </ng-container>
      <ng-container *ngSwitchCase="'move'">
        <polyline points="5 9 2 12 5 15" />
        <polyline points="9 5 12 2 15 5" />
        <polyline points="15 19 12 22 9 19" />
        <polyline points="19 9 22 12 19 15" />
        <line x1="2" y1="12" x2="22" y2="12" />
        <line x1="12" y1="2" x2="12" y2="22" />
      </ng-container>
      <ng-container *ngSwitchCase="'reset'">
        <polyline points="1 4 1 10 7 10" />
        <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
      </ng-container>
      <ng-container *ngSwitchCase="'flag'">
        <path d="M4 14s1-1 3.5-1 4 1.5 5.5 1.5 3.5-1 3.5-1V3s-1 1-3.5 1-4-1.5-5.5-1.5-3.5 1-3.5 1z" />
        <line x1="4" y1="22" x2="4" y2="14" />
      </ng-container>
      <ng-container *ngSwitchCase="'message-circle'">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
      </ng-container>
      <ng-container *ngSwitchCase="'tag'">
        <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" />
        <line x1="7" y1="7" x2="7.01" y2="7" />
      </ng-container>

      <ng-container *ngSwitchDefault>
        <circle cx="12" cy="12" r="9" />
      </ng-container>
    </svg>
  `
})
export class IconComponent {
  @Input({ required: true }) name!: IconName | string;
  @Input() size = 16;
  @Input() color?: string;
  @Input() strokeWidth = 2;
}
