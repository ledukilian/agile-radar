import { Injectable, computed, effect, signal } from '@angular/core';
import {
  Project,
  createEmptyProject,
  SCHEMA_VERSION,
  DEFAULT_BOARD_VIEW
} from '../models/project.model';
import {
  WorkItem,
  WorkItemType,
  Position,
  getTypeMeta
} from '../models/work-item.model';
import {
  Iteration,
  CapacityDef,
  DEFAULT_CAPACITY,
  Reserve
} from '../models/iteration.model';
import { Dependency, DependencyType } from '../models/dependency.model';
import { StickyNote, DrawingStroke, DEFAULT_STICKY_NOTE } from '../models/board-extras.model';
import { getDefaultConfig, ProjectConfig } from '../models/config.model';
import { emptyCurseScores } from '../estimation/estimation.util';
import { generateId } from '../utils/id.util';

const STORAGE_KEY = 'agile_radar_project';

@Injectable({ providedIn: 'root' })
export class ProjectStore {
  private readonly _project = signal<Project>(this.loadOrCreate());

  /** Projet courant (lecture seule) */
  readonly project = this._project.asReadonly();

  // Sélecteurs dérivés
  readonly items = computed(() => this._project().items);
  readonly iterations = computed(() =>
    [...this._project().iterations].sort((a, b) => a.order - b.order)
  );
  readonly dependencies = computed(() => this._project().dependencies);
  readonly stickyNotes = computed(() => this._project().stickyNotes);
  readonly drawings = computed(() => this._project().drawings);
  readonly config = computed(() => this._project().config);
  readonly board = computed(() => this._project().board);

  /** Éléments non placés (backlog) */
  readonly backlogItems = computed(() =>
    this._project().items.filter(i => i.iterationId === null)
  );

  constructor() {
    // Persistance automatique à chaque changement
    effect(() => {
      const project = this._project();
      this.persist(project);
    });
  }

  // ==================== PROJET ====================

  private patch(mutator: (draft: Project) => void): void {
    const current = this._project();
    const draft: Project = structuredClone(current);
    mutator(draft);
    draft.updatedAt = new Date().toISOString();
    this._project.set(draft);
  }

  setProjectName(name: string): void {
    this.patch(d => {
      d.name = name;
    });
  }

  updateConfig(config: Partial<ProjectConfig>): void {
    this.patch(d => {
      d.config = { ...d.config, ...config };
    });
  }

  newProject(name = 'Nouveau projet'): void {
    this._project.set(createEmptyProject(generateId(), name));
  }

  resetProject(): void {
    this.newProject();
  }

  // ==================== WORK ITEMS ====================

  createItem(partial: Partial<WorkItem> & { type: WorkItemType }): WorkItem {
    const now = new Date().toISOString();
    const item: WorkItem = {
      id: generateId(),
      type: partial.type,
      title: partial.title ?? `${getTypeMeta(partial.type).label}`,
      description: partial.description ?? '',
      parentId: partial.parentId ?? null,
      points: partial.points ?? 0,
      pointsManual: partial.pointsManual ?? true,
      curse: partial.curse ?? emptyCurseScores(this._project().config.curseAxes),
      iterationId: partial.iterationId ?? null,
      position: partial.position ?? { x: 40, y: 40 },
      color: partial.color ?? null,
      jiraUrl: partial.jiraUrl ?? null,
      createdAt: now,
      updatedAt: now
    };
    this.patch(d => {
      d.items.push(item);
    });
    return item;
  }

  updateItem(id: string, updates: Partial<WorkItem>): void {
    this.patch(d => {
      const idx = d.items.findIndex(i => i.id === id);
      if (idx === -1) return;
      d.items[idx] = { ...d.items[idx], ...updates, id, updatedAt: new Date().toISOString() };
    });
  }

  deleteItem(id: string): void {
    this.patch(d => {
      // Détacher les enfants (deviennent orphelins/autonomes)
      d.items.forEach(i => {
        if (i.parentId === id) i.parentId = null;
      });
      d.items = d.items.filter(i => i.id !== id);
      d.dependencies = d.dependencies.filter(dep => dep.sourceId !== id && dep.targetId !== id);
    });
  }

  /** Place un item dans une itération (ou le renvoie au backlog si null) */
  placeItem(id: string, iterationId: string | null, position?: Position): void {
    this.patch(d => {
      const item = d.items.find(i => i.id === id);
      if (!item) return;
      item.iterationId = iterationId;
      if (position) item.position = position;
      item.updatedAt = new Date().toISOString();
    });
  }

  moveItem(id: string, position: Position): void {
    this.patch(d => {
      const item = d.items.find(i => i.id === id);
      if (!item) return;
      item.position = position;
    });
  }

  setParent(childId: string, parentId: string | null): void {
    this.updateItem(childId, { parentId });
  }

  // ==================== ITÉRATIONS ====================

  createIteration(partial?: Partial<Iteration>): Iteration {
    const project = this._project();
    const order = partial?.order ?? project.iterations.length;
    const capacity: CapacityDef = partial?.capacity ?? {
      ...DEFAULT_CAPACITY,
      pointsPerManDay: project.config.pointsPerManDayDefault
    };
    const iteration: Iteration = {
      id: generateId(),
      order,
      name: partial?.name ?? `Itération ${order + 1}`,
      startDate: partial?.startDate ?? null,
      endDate: partial?.endDate ?? null,
      capacity,
      reserves: partial?.reserves ?? [],
      position: partial?.position ?? { x: 120 + order * 520, y: 120 },
      width: partial?.width ?? 480,
      height: partial?.height ?? 560,
      isPast: partial?.isPast ?? false,
      actualVelocity: partial?.actualVelocity ?? null
    };
    this.patch(d => {
      d.iterations.push(iteration);
    });
    return iteration;
  }

  updateIteration(id: string, updates: Partial<Iteration>): void {
    this.patch(d => {
      const idx = d.iterations.findIndex(i => i.id === id);
      if (idx === -1) return;
      d.iterations[idx] = { ...d.iterations[idx], ...updates, id };
    });
  }

  updateIterationCapacity(id: string, capacity: Partial<CapacityDef>): void {
    this.patch(d => {
      const it = d.iterations.find(i => i.id === id);
      if (!it) return;
      it.capacity = { ...it.capacity, ...capacity };
    });
  }

  deleteIteration(id: string): void {
    this.patch(d => {
      d.iterations = d.iterations.filter(i => i.id !== id);
      // Les items de cette itération repartent au backlog
      d.items.forEach(item => {
        if (item.iterationId === id) item.iterationId = null;
      });
      // Réordonner
      d.iterations
        .sort((a, b) => a.order - b.order)
        .forEach((it, idx) => (it.order = idx));
    });
  }

  reorderIterations(orderedIds: string[]): void {
    this.patch(d => {
      orderedIds.forEach((id, idx) => {
        const it = d.iterations.find(i => i.id === id);
        if (it) it.order = idx;
      });
    });
  }

  // ==================== RÉSERVES ====================

  addReserve(iterationId: string, reserve?: Partial<Reserve>): Reserve {
    const newReserve: Reserve = {
      id: generateId(),
      label: reserve?.label ?? 'Réserve',
      color: reserve?.color ?? '#f59e0b',
      mode: reserve?.mode ?? 'percent',
      value: reserve?.value ?? 10
    };
    this.patch(d => {
      const it = d.iterations.find(i => i.id === iterationId);
      if (it) it.reserves.push(newReserve);
    });
    return newReserve;
  }

  updateReserve(iterationId: string, reserveId: string, updates: Partial<Reserve>): void {
    this.patch(d => {
      const it = d.iterations.find(i => i.id === iterationId);
      if (!it) return;
      const idx = it.reserves.findIndex(r => r.id === reserveId);
      if (idx === -1) return;
      it.reserves[idx] = { ...it.reserves[idx], ...updates, id: reserveId };
    });
  }

  deleteReserve(iterationId: string, reserveId: string): void {
    this.patch(d => {
      const it = d.iterations.find(i => i.id === iterationId);
      if (it) it.reserves = it.reserves.filter(r => r.id !== reserveId);
    });
  }

  // ==================== DÉPENDANCES ====================

  addDependency(sourceId: string, targetId: string, type: DependencyType, description = ''): Dependency {
    const dep: Dependency = {
      id: generateId(),
      sourceId,
      targetId,
      type,
      description,
      createdAt: new Date().toISOString()
    };
    this.patch(d => {
      d.dependencies.push(dep);
    });
    return dep;
  }

  updateDependency(id: string, updates: Partial<Dependency>): void {
    this.patch(d => {
      const idx = d.dependencies.findIndex(dep => dep.id === id);
      if (idx === -1) return;
      d.dependencies[idx] = { ...d.dependencies[idx], ...updates, id };
    });
  }

  deleteDependency(id: string): void {
    this.patch(d => {
      d.dependencies = d.dependencies.filter(dep => dep.id !== id);
    });
  }

  // ==================== BOARD (zoom/pan/grid) ====================

  setZoom(zoom: number): void {
    this.patch(d => {
      d.board.zoom = Math.max(0.25, Math.min(3, zoom));
    });
  }

  setPanOffset(offset: Position): void {
    this.patch(d => {
      d.board.panOffset = offset;
    });
  }

  toggleGrid(): void {
    this.patch(d => {
      d.board.gridEnabled = !d.board.gridEnabled;
    });
  }

  // ==================== STICKY NOTES ====================

  createStickyNote(position: Position): StickyNote {
    const now = new Date().toISOString();
    const note: StickyNote = {
      ...DEFAULT_STICKY_NOTE,
      id: generateId(),
      position,
      createdAt: now,
      updatedAt: now
    };
    this.patch(d => {
      d.stickyNotes.push(note);
    });
    return note;
  }

  updateStickyNote(id: string, updates: Partial<StickyNote>): void {
    this.patch(d => {
      const idx = d.stickyNotes.findIndex(n => n.id === id);
      if (idx === -1) return;
      d.stickyNotes[idx] = { ...d.stickyNotes[idx], ...updates, id, updatedAt: new Date().toISOString() };
    });
  }

  deleteStickyNote(id: string): void {
    this.patch(d => {
      d.stickyNotes = d.stickyNotes.filter(n => n.id !== id);
    });
  }

  // ==================== DRAWINGS ====================

  addDrawing(stroke: Omit<DrawingStroke, 'id' | 'createdAt'>): DrawingStroke {
    const newStroke: DrawingStroke = {
      ...stroke,
      id: generateId(),
      createdAt: new Date().toISOString()
    };
    this.patch(d => {
      d.drawings.push(newStroke);
    });
    return newStroke;
  }

  deleteDrawing(id: string): void {
    this.patch(d => {
      d.drawings = d.drawings.filter(s => s.id !== id);
    });
  }

  clearDrawings(): void {
    this.patch(d => {
      d.drawings = [];
    });
  }

  // ==================== IMPORT / EXPORT ====================

  exportJson(): string {
    return JSON.stringify(this._project(), null, 2);
  }

  downloadJson(): void {
    const json = this.exportJson();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const safeName = this._project().name.replace(/[^a-zA-Z0-9-_]/g, '-');
    a.href = url;
    a.download = `agile-radar-${safeName}-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  importJson(json: string): void {
    const parsed = JSON.parse(json);
    const project = this.normalize(parsed);
    this._project.set(project);
  }

  // ==================== PERSISTENCE ====================

  private loadOrCreate(): Project {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        return this.normalize(JSON.parse(stored));
      }
    } catch (err) {
      console.error('Erreur de chargement du projet:', err);
    }
    return createEmptyProject(generateId());
  }

  private persist(project: Project): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(project));
    } catch (err) {
      console.error('Erreur de sauvegarde du projet:', err);
    }
  }

  /**
   * Normalise un objet importé/chargé vers un Project valide (défensif).
   */
  private normalize(raw: unknown): Project {
    const base = createEmptyProject(generateId());
    if (!raw || typeof raw !== 'object') return base;
    const r = raw as Partial<Project>;
    return {
      schemaVersion: SCHEMA_VERSION,
      id: r.id ?? base.id,
      name: r.name ?? base.name,
      config: { ...getDefaultConfig(), ...(r.config ?? {}) },
      items: Array.isArray(r.items)
        ? (r.items as WorkItem[]).map(i => ({ ...i, jiraUrl: i.jiraUrl ?? null }))
        : [],
      iterations: Array.isArray(r.iterations) ? (r.iterations as Iteration[]) : [],
      dependencies: Array.isArray(r.dependencies) ? (r.dependencies as Dependency[]) : [],
      stickyNotes: Array.isArray(r.stickyNotes) ? (r.stickyNotes as StickyNote[]) : [],
      drawings: Array.isArray(r.drawings) ? (r.drawings as DrawingStroke[]) : [],
      board: { ...DEFAULT_BOARD_VIEW, ...(r.board ?? {}) },
      createdAt: r.createdAt ?? base.createdAt,
      updatedAt: new Date().toISOString()
    };
  }
}
