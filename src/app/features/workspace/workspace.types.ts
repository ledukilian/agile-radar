import { WorkItem } from '../../core/models/work-item.model';
import { ItemSchedule } from '../../core/scheduling/scheduling.types';

/** View-model d'un item préparé par le WorkspaceComponent pour l'affichage. */
export interface ItemVM {
  item: WorkItem;
  schedule?: ItemSchedule;
  hasChildren: boolean;
  childCount: number;
  depViolation: boolean;
  depCount: number;
  parentTitle: string | null;
}
