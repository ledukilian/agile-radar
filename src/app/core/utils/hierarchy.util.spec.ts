import { flattenItemHierarchy } from './hierarchy.util';
import { ItemVM } from '../../features/workspace/workspace.types';
import { WorkItem } from '../models/work-item.model';

function vm(id: string, parentId: string | null, title: string, parentTitle: string | null = null): ItemVM {
  const item = {
    id,
    parentId,
    title,
    type: 'user-story',
    description: '',
    points: 3,
    pointsManual: true,
    curse: {},
    iterationId: 'i1',
    position: { x: 0, y: 0 },
    color: null,
    jiraUrl: null,
    createdAt: '',
    updatedAt: ''
  } as WorkItem;

  return {
    item,
    hasChildren: false,
    childCount: 0,
    depViolation: false,
    depCount: 0,
    parentTitle
  };
}

describe('flattenItemHierarchy', () => {
  it('ordonne parent puis enfants avec profondeur', () => {
    const items = [
      vm('us', 'feat', 'US 1', 'Feature A'),
      vm('feat', 'epic', 'Feature A', 'Epic 1'),
      vm('epic', null, 'Epic 1', null)
    ];

    const flat = flattenItemHierarchy(items);

    expect(flat.map(f => f.item.id)).toEqual(['epic', 'feat', 'us']);
    expect(flat.map(f => f.depth)).toEqual([0, 1, 2]);
  });

  it('signale un parent hors conteneur', () => {
    const items = [vm('us', 'epic', 'US seule', 'Epic ailleurs')];

    const flat = flattenItemHierarchy(items);

    expect(flat.length).toBe(1);
    expect(flat[0].depth).toBe(0);
    expect(flat[0].orphanParentTitle).toBe('Epic ailleurs');
  });
});
