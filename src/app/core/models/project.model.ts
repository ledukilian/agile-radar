import { WorkItem, Position } from './work-item.model';
import { Iteration } from './iteration.model';
import { Dependency } from './dependency.model';
import { ProjectConfig, getDefaultConfig } from './config.model';
import { StickyNote, DrawingStroke } from './board-extras.model';

export interface BoardView {
  zoom: number;
  panOffset: Position;
  gridEnabled: boolean;
  gridSize: number;
}

export interface Project {
  schemaVersion: number;
  id: string;
  name: string;
  config: ProjectConfig;
  items: WorkItem[];
  iterations: Iteration[];
  dependencies: Dependency[];
  stickyNotes: StickyNote[];
  drawings: DrawingStroke[];
  board: BoardView;
  createdAt: string;
  updatedAt: string;
}

export const SCHEMA_VERSION = 1;

export const DEFAULT_BOARD_VIEW: BoardView = {
  zoom: 1,
  panOffset: { x: 0, y: 0 },
  gridEnabled: true,
  gridSize: 20
};

export function createEmptyProject(id: string, name = 'Nouveau projet'): Project {
  const now = new Date().toISOString();
  return {
    schemaVersion: SCHEMA_VERSION,
    id,
    name,
    config: getDefaultConfig(),
    items: [],
    iterations: [],
    dependencies: [],
    stickyNotes: [],
    drawings: [],
    board: { ...DEFAULT_BOARD_VIEW, panOffset: { ...DEFAULT_BOARD_VIEW.panOffset } },
    createdAt: now,
    updatedAt: now
  };
}
