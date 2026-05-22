type Row = {
  id: string;
  visitId: string;
  questionId: string;
  viewedAt: Date;
  startedAt: Date | null;
  completedAt: Date | null;
};

const rankNullsLast = (d: Date | null): number => (d ? d.getTime() : Number.NEGATIVE_INFINITY);

const isBetter = (candidate: Row, current: Row): boolean => {
  const c1 = rankNullsLast(candidate.completedAt);
  const c2 = rankNullsLast(current.completedAt);
  if (c1 !== c2) return c1 > c2;
  const s1 = rankNullsLast(candidate.startedAt);
  const s2 = rankNullsLast(current.startedAt);
  if (s1 !== s2) return s1 > s2;
  return candidate.viewedAt.getTime() > current.viewedAt.getTime();
};

export const dedupeQuestionProgressRows = <R extends Row>(
  rows: readonly R[],
): { keep: R[]; drop: R[] } => {
  const winner = new Map<string, R>();
  for (const row of rows) {
    const key = `${row.visitId}::${row.questionId}`;
    const current = winner.get(key);
    if (!current || isBetter(row, current)) {
      winner.set(key, row);
    }
  }
  const keepSet = new Set([...winner.values()].map((r) => r.id));
  const keep: R[] = [];
  const drop: R[] = [];
  for (const row of rows) {
    if (keepSet.has(row.id)) keep.push(row);
    else drop.push(row);
  }
  return { keep, drop };
};
