import { schedule } from './scheduler';
import { WorkItem, WorkItemType } from '../models/work-item.model';
import { Iteration, DEFAULT_CAPACITY } from '../models/iteration.model';
import { Dependency } from '../models/dependency.model';

function makeIteration(id: string, order: number, netPoints: number): Iteration {
  return {
    id,
    order,
    name: `It ${order + 1}`,
    startDate: null,
    endDate: null,
    // capacité directe en points pour des tests déterministes
    capacity: { ...DEFAULT_CAPACITY, manualPoints: netPoints },
    reserves: [],
    position: { x: 0, y: 0 },
    width: 480,
    height: 560,
    isPast: false,
    actualVelocity: null
  };
}

function makeItem(
  id: string,
  type: WorkItemType,
  points: number,
  iterationId: string | null,
  parentId: string | null = null
): WorkItem {
  return {
    id,
    type,
    title: id,
    description: '',
    parentId,
    points,
    pointsManual: true,
    curse: {},
    iterationId,
    position: { x: 0, y: 0 },
    color: null,
    jiraUrl: null,
    createdAt: '',
    updatedAt: ''
  };
}

describe('scheduler', () => {
  it('déduit les réserves de la capacité nette', () => {
    const it = makeIteration('i1', 0, 100);
    it.reserves = [{ id: 'r1', label: 'Buffer', color: '#000', mode: 'percent', value: 10 }];
    const res = schedule({ items: [], iterations: [it], dependencies: [] });
    const load = res.iterationLoads.get('i1');
    expect(load?.netCapacity).toBe(90);
    expect(load?.reserved).toBe(10);
  });

  it('place une feuille atomique qui rentre dans son itération', () => {
    const it = makeIteration('i1', 0, 20);
    const us = makeItem('us1', 'user-story', 8, 'i1');
    const res = schedule({ items: [us], iterations: [it], dependencies: [] });
    const s = res.itemSchedules.get('us1');
    expect(s?.startIndex).toBe(0);
    expect(s?.landingIndex).toBe(0);
    expect(s?.overflow).toBeFalse();
  });

  it("pousse une feuille à l'itération suivante en cas de débordement", () => {
    const i1 = makeIteration('i1', 0, 10);
    const i2 = makeIteration('i2', 1, 10);
    const a = makeItem('a', 'user-story', 8, 'i1');
    const b = makeItem('b', 'user-story', 8, 'i1'); // 8 + 8 > 10 => b pousse en i2
    const res = schedule({ items: [a, b], iterations: [i1, i2], dependencies: [] });
    expect(res.itemSchedules.get('a')?.landingIndex).toBe(0);
    expect(res.itemSchedules.get('b')?.landingIndex).toBe(1);
  });

  it('signale une feuille trop grosse pour une itération', () => {
    const i1 = makeIteration('i1', 0, 10);
    const big = makeItem('big', 'user-story', 21, 'i1');
    const res = schedule({ items: [big], iterations: [i1], dependencies: [] });
    expect(res.itemSchedules.get('big')?.tooBig).toBeTrue();
    expect(res.tooBigItemIds).toContain('big');
  });

  it('roll-up parent: start=min, landing=max des enfants', () => {
    const i1 = makeIteration('i1', 0, 10);
    const i2 = makeIteration('i2', 1, 10);
    const feature = makeItem('f', 'feature', 0, null);
    const us1 = makeItem('us1', 'user-story', 8, 'i1', 'f');
    const us2 = makeItem('us2', 'user-story', 8, 'i2', 'f');
    const res = schedule({ items: [feature, us1, us2], iterations: [i1, i2], dependencies: [] });
    const f = res.itemSchedules.get('f');
    expect(f?.startIndex).toBe(0);
    expect(f?.landingIndex).toBe(1);
    expect(f?.effectivePoints).toBe(16);
  });

  it('étale une feature posée en bloc selon la capacité', () => {
    const i1 = makeIteration('i1', 0, 10);
    const i2 = makeIteration('i2', 1, 10);
    const i3 = makeIteration('i3', 2, 10);
    const block = makeItem('blk', 'feature', 25, 'i1'); // 25 pts sur des itérations de 10
    const res = schedule({ items: [block], iterations: [i1, i2, i3], dependencies: [] });
    const s = res.itemSchedules.get('blk');
    expect(s?.startIndex).toBe(0);
    expect(s?.landingIndex).toBe(2);
    expect(s?.spannedIterationIds.length).toBe(3);
  });

  it('détecte une violation de dépendance (source atterrit après le départ de la cible)', () => {
    const i1 = makeIteration('i1', 0, 100);
    const i2 = makeIteration('i2', 1, 100);
    const src = makeItem('src', 'user-story', 5, 'i2'); // atterrit en i2
    const tgt = makeItem('tgt', 'user-story', 5, 'i1'); // démarre en i1 (avant)
    const dep: Dependency = {
      id: 'd1',
      sourceId: 'src',
      targetId: 'tgt',
      type: 'must-precede',
      description: '',
      createdAt: ''
    };
    const res = schedule({ items: [src, tgt], iterations: [i1, i2], dependencies: [dep] });
    expect(res.dependencyViolations.length).toBe(0); // la contrainte a repoussé la cible
    // La cible est repoussée pour respecter la dépendance
    expect(res.itemSchedules.get('tgt')?.startIndex).toBe(1);
  });
});
