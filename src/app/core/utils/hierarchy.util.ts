import { ItemVM } from '../../features/workspace/workspace.types';

export interface HierarchicalItemVM extends ItemVM {
  depth: number;
  /** Parent hors de ce conteneur (backlog / autre itération) */
  orphanParentTitle: string | null;
}

/**
 * Aplatit une liste d'items en ordre arborescent (parents puis enfants),
 * avec indentation par profondeur dans le conteneur courant.
 */
export function flattenItemHierarchy(vms: ItemVM[]): HierarchicalItemVM[] {
  if (vms.length === 0) return [];

  const idSet = new Set(vms.map(v => v.item.id));
  const order = new Map(vms.map((v, i) => [v.item.id, i]));

  const roots = vms
    .filter(vm => !vm.item.parentId || !idSet.has(vm.item.parentId))
    .sort((a, b) => order.get(a.item.id)! - order.get(b.item.id)!);

  const result: HierarchicalItemVM[] = [];

  const walk = (vm: ItemVM, depth: number): void => {
    const orphanParentTitle =
      vm.item.parentId && !idSet.has(vm.item.parentId) ? vm.parentTitle : null;

    result.push({ ...vm, depth, orphanParentTitle });

    const children = vms
      .filter(c => c.item.parentId === vm.item.id)
      .sort((a, b) => order.get(a.item.id)! - order.get(b.item.id)!);

    for (const child of children) {
      walk(child, depth + 1);
    }
  };

  for (const root of roots) {
    walk(root, 0);
  }

  // Filets de sécurité (cycles ou données incohérentes)
  const visited = new Set(result.map(r => r.item.id));
  for (const vm of vms) {
    if (!visited.has(vm.item.id)) {
      result.push({
        ...vm,
        depth: 0,
        orphanParentTitle: vm.item.parentId ? vm.parentTitle : null
      });
    }
  }

  return result;
}
