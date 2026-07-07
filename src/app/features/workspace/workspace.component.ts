import {
  AfterViewInit,
  Component,
  ElementRef,
  EventEmitter,
  OnDestroy,
  Output,
  ViewChild,
  computed,
  inject,
  signal
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import * as htmlToImage from 'html-to-image';
import { ProjectStore } from '../../core/store/project.store';
import { SchedulingService } from '../../core/scheduling/scheduling.service';
import {
  WorkItemType,
  WORK_ITEM_TYPE_LIST,
  getTypeMeta,
  WorkItemTypeMeta,
  WorkItem,
  Position
} from '../../core/models/work-item.model';
import { Iteration } from '../../core/models/iteration.model';
import { StickyNote, DrawingStroke, DrawingPoint, DEFAULT_DRAWING_SETTINGS } from '../../core/models/board-extras.model';
import { IterationZoneComponent } from './iteration-zone/iteration-zone.component';
import { BacklogPanelComponent } from './backlog-panel/backlog-panel.component';
import { StickyNoteComponent } from '../../shared/sticky-note/sticky-note.component';
import { ColorPickerComponent } from '../../shared/color-picker/color-picker.component';
import { IconComponent } from '../../shared/icon/icon.component';
import { ItemVM } from './workspace.types';

@Component({
  selector: 'app-workspace',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    IterationZoneComponent,
    BacklogPanelComponent,
    StickyNoteComponent,
    ColorPickerComponent,
    IconComponent
  ],
  templateUrl: './workspace.component.html',
  styleUrl: './workspace.component.scss'
})
export class WorkspaceComponent implements AfterViewInit, OnDestroy {
  @Output() openItem = new EventEmitter<string>();
  @Output() openSetup = new EventEmitter<void>();
  @Output() openIterationSettings = new EventEmitter<string>();

  @ViewChild('viewport') viewportRef?: ElementRef<HTMLElement>;

  readonly store = inject(ProjectStore);
  readonly scheduling = inject(SchedulingService);

  readonly types = WORK_ITEM_TYPE_LIST;
  readonly enabledTypes = signal<Set<WorkItemType>>(new Set(WORK_ITEM_TYPE_LIST));

  // Cible de drop en surbrillance
  readonly dropTarget = signal<string | null>(null); // iterationId | 'backlog' | null

  // Vue globale des items -> VMs
  private readonly allVMs = computed<Map<string, ItemVM>>(() => {
    const result = this.scheduling.result();
    const items = this.store.items();
    const violated = new Set<string>();
    for (const v of result.dependencyViolations) {
      violated.add(v.sourceId);
      violated.add(v.targetId);
    }
    const childCount = new Map<string, number>();
    for (const it of items) {
      if (it.parentId) childCount.set(it.parentId, (childCount.get(it.parentId) ?? 0) + 1);
    }
    const depCount = new Map<string, number>();
    for (const dep of this.store.dependencies()) {
      depCount.set(dep.sourceId, (depCount.get(dep.sourceId) ?? 0) + 1);
      depCount.set(dep.targetId, (depCount.get(dep.targetId) ?? 0) + 1);
    }
    const map = new Map<string, ItemVM>();
    const itemById = new Map(items.map(i => [i.id, i]));
    for (const item of items) {
      const cc = childCount.get(item.id) ?? 0;
      const parent = item.parentId ? itemById.get(item.parentId) : undefined;
      map.set(item.id, {
        item,
        schedule: result.itemSchedules.get(item.id),
        hasChildren: cc > 0,
        childCount: cc,
        depViolation: violated.has(item.id),
        depCount: depCount.get(item.id) ?? 0,
        parentTitle: parent?.title ?? null
      });
    }
    return map;
  });

  readonly iterations = computed(() => this.store.iterations());

  readonly backlogVMs = computed<ItemVM[]>(() => {
    const enabled = this.enabledTypes();
    return Array.from(this.allVMs().values()).filter(
      vm => vm.item.iterationId === null && enabled.has(vm.item.type)
    );
  });

  readonly overflowCount = computed(() => this.scheduling.result().overflowItemIds.length);
  readonly tooBigCount = computed(() => this.scheduling.result().tooBigItemIds.length);
  readonly violationCount = computed(() => this.scheduling.result().dependencyViolations.length);

  meta = getTypeMeta;

  typeMeta(t: WorkItemType): WorkItemTypeMeta {
    return getTypeMeta(t);
  }

  itemsForIteration(iterationId: string): ItemVM[] {
    const enabled = this.enabledTypes();
    return Array.from(this.allVMs().values()).filter(
      vm => vm.item.iterationId === iterationId && enabled.has(vm.item.type)
    );
  }

  loadFor(iterationId: string) {
    return this.scheduling.result().iterationLoads.get(iterationId);
  }

  // ==================== FILTRES ====================

  isTypeEnabled(t: WorkItemType): boolean {
    return this.enabledTypes().has(t);
  }

  toggleType(t: WorkItemType): void {
    const next = new Set(this.enabledTypes());
    if (next.has(t)) next.delete(t);
    else next.add(t);
    this.enabledTypes.set(next);
  }

  // ==================== DRAG & DROP ====================

  onDropToIteration(itemId: string, iterationId: string): void {
    this.store.placeItem(itemId, iterationId);
    this.dropTarget.set(null);
  }

  onDropToBacklog(itemId: string): void {
    this.store.placeItem(itemId, null);
    this.dropTarget.set(null);
  }

  setDropTarget(target: string | null): void {
    this.dropTarget.set(target);
  }

  // ==================== ACTIONS ====================

  onCreateItem(type: WorkItemType): void {
    const item = this.store.createItem({ type });
    this.openItem.emit(item.id);
  }

  addIteration(): void {
    this.store.createIteration();
  }

  // ==================== ZOOM / PAN ====================

  get zoom(): number {
    return this.store.board().zoom;
  }

  get panOffset() {
    return this.store.board().panOffset;
  }

  get gridEnabled(): boolean {
    return this.store.board().gridEnabled;
  }

  zoomIn(): void {
    this.store.setZoom(this.zoom + 0.1);
  }
  zoomOut(): void {
    this.store.setZoom(this.zoom - 0.1);
  }
  resetZoom(): void {
    this.store.setZoom(1);
    this.store.setPanOffset({ x: 0, y: 0 });
  }
  toggleGrid(): void {
    this.store.toggleGrid();
  }

  private isPanning = false;
  private panStart = { x: 0, y: 0 };
  private readonly onWheelBound = (event: WheelEvent) => this.onCanvasWheel(event);

  ngAfterViewInit(): void {
    this.viewportRef?.nativeElement.addEventListener('wheel', this.onWheelBound, { passive: false });
  }

  ngOnDestroy(): void {
    this.viewportRef?.nativeElement.removeEventListener('wheel', this.onWheelBound);
  }

  onCanvasWheel(event: WheelEvent): void {
    const target = event.target as HTMLElement;
    if (
      target.closest('.zone-body') ||
      target.closest('.backlog-panel .flex-1.overflow-y-auto') ||
      target.closest('.workspace-float') ||
      target.closest('.topbar') ||
      target.closest('.insights-col')
    ) {
      return;
    }

    event.preventDefault();

    const rect = this.viewportRef?.nativeElement.getBoundingClientRect();
    if (!rect) return;

    const mouseX = event.clientX - rect.left;
    const mouseY = event.clientY - rect.top;
    const prevZoom = this.zoom;
    const newZoom = Math.max(0.25, Math.min(3, prevZoom * Math.exp(-event.deltaY * 0.001)));
    if (newZoom === prevZoom) return;

    const scale = newZoom / prevZoom;
    const pan = this.panOffset;
    this.store.setPanOffset({
      x: mouseX - (mouseX - pan.x) * scale,
      y: mouseY - (mouseY - pan.y) * scale
    });
    this.store.setZoom(newZoom);
  }

  onCanvasMouseDown(event: MouseEvent): void {
    if (this.drawMode()) {
      this.beginStroke(event);
      return;
    }
    const target = event.target as HTMLElement;
    if (
      target.closest('.iteration-zone, .work-item-card, .sticky-note, .workspace-float, .topbar, .insights-col')
    ) {
      return;
    }
    this.isPanning = true;
    this.panStart = { x: event.clientX - this.panOffset.x, y: event.clientY - this.panOffset.y };
  }

  onCanvasMouseMove(event: MouseEvent): void {
    if (this.drawMode() && this.currentStroke()) {
      this.appendPoint(event);
      return;
    }
    if (!this.isPanning) return;
    this.store.setPanOffset({ x: event.clientX - this.panStart.x, y: event.clientY - this.panStart.y });
  }

  onCanvasMouseUp(): void {
    if (this.drawMode() && this.currentStroke()) {
      this.endStroke();
      return;
    }
    this.isPanning = false;
  }

  get canvasTransform(): string {
    return `translate(${this.panOffset.x}px, ${this.panOffset.y}px) scale(${this.zoom})`;
  }

  // ==================== COORDONNÉES CANVAS ====================

  private toCanvasCoords(clientX: number, clientY: number): Position {
    const rect = this.viewportRef?.nativeElement.getBoundingClientRect();
    const left = rect?.left ?? 0;
    const top = rect?.top ?? 0;
    return {
      x: (clientX - left - this.panOffset.x) / this.zoom,
      y: (clientY - top - this.panOffset.y) / this.zoom
    };
  }

  // ==================== STICKY NOTES ====================

  get stickyNotes(): StickyNote[] {
    return this.store.stickyNotes();
  }

  addStickyNote(): void {
    const center = this.toCanvasCoords(
      (this.viewportRef?.nativeElement.clientWidth ?? 400) / 2 + (this.viewportRef?.nativeElement.getBoundingClientRect().left ?? 0),
      (this.viewportRef?.nativeElement.clientHeight ?? 300) / 3 + (this.viewportRef?.nativeElement.getBoundingClientRect().top ?? 0)
    );
    this.store.createStickyNote(center);
  }

  moveSticky(id: string, position: Position): void {
    this.store.updateStickyNote(id, { position });
  }

  setStickyContent(id: string, content: string): void {
    this.store.updateStickyNote(id, { content });
  }

  setStickyColor(id: string, color: string, textColor: string): void {
    this.store.updateStickyNote(id, { color, textColor });
  }

  removeSticky(id: string): void {
    this.store.deleteStickyNote(id);
  }

  // ==================== DESSIN LIBRE ====================

  /** Feature désactivée tant que le dessin libre n'est pas prêt */
  readonly drawingEnabled = false;
  readonly drawMode = signal(false);
  readonly currentStroke = signal<DrawingStroke | null>(null);
  drawColor = DEFAULT_DRAWING_SETTINGS.color;
  drawThickness = DEFAULT_DRAWING_SETTINGS.thickness;

  toggleDrawMode(): void {
    this.drawMode.update(v => !v);
  }

  get drawings(): DrawingStroke[] {
    return this.store.drawings();
  }

  private beginStroke(event: MouseEvent): void {
    const p = this.toCanvasCoords(event.clientX, event.clientY);
    this.currentStroke.set({
      id: 'tmp',
      points: [p],
      color: this.drawColor,
      thickness: this.drawThickness,
      createdAt: ''
    });
  }

  private appendPoint(event: MouseEvent): void {
    const stroke = this.currentStroke();
    if (!stroke) return;
    const p = this.toCanvasCoords(event.clientX, event.clientY);
    this.currentStroke.set({ ...stroke, points: [...stroke.points, p] });
  }

  private endStroke(): void {
    const stroke = this.currentStroke();
    this.currentStroke.set(null);
    if (stroke && stroke.points.length > 1) {
      this.store.addDrawing({
        points: stroke.points,
        color: stroke.color,
        thickness: stroke.thickness
      });
    }
  }

  clearDrawings(): void {
    if (this.drawings.length > 0 && confirm('Effacer tous les dessins ?')) {
      this.store.clearDrawings();
    }
  }

  strokePath(points: DrawingPoint[]): string {
    if (points.length === 0) return '';
    return points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
  }

  trackByStroke(_i: number, s: DrawingStroke): string {
    return s.id;
  }

  trackBySticky(_i: number, n: StickyNote): string {
    return n.id;
  }

  // ==================== EXPORT PNG ====================

  isExporting = false;

  async exportPng(): Promise<void> {
    const el = this.viewportRef?.nativeElement;
    if (!el || this.isExporting) return;
    this.isExporting = true;
    try {
      const dataUrl = await htmlToImage.toPng(el, { pixelRatio: 2 });
      const link = document.createElement('a');
      const name = this.store.project().name.replace(/[^a-zA-Z0-9-_]/g, '-');
      link.download = `agile-radar-${name}.png`;
      link.href = dataUrl;
      link.click();
    } catch (err) {
      console.error('Erreur export PNG:', err);
    } finally {
      this.isExporting = false;
    }
  }

  trackByIteration(_i: number, it: Iteration): string {
    return it.id;
  }

  trackByItem(_i: number, item: WorkItem): string {
    return item.id;
  }
}
