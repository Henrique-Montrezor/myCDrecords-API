export type RatingSummary = {
  average: number | null;
  count: number;
  distribution: Record<1 | 2 | 3 | 4 | 5, number>;
};

export function buildRatingSummary(rows: Array<{ rating: number; count: number }>): RatingSummary {
  const distribution: RatingSummary["distribution"] = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  let count = 0;
  let total = 0;

  for (const row of rows) {
    const rating = Number(row.rating) as keyof RatingSummary["distribution"];
    const amount = Number(row.count);
    if (!(rating in distribution)) continue;
    distribution[rating] = amount;
    count += amount;
    total += rating * amount;
  }

  return { average: count > 0 ? Math.round((total / count) * 10) / 10 : null, count, distribution };
}
