export type PrivacyLevel = 'low' | 'medium' | 'high';

export interface PrivacyScore {
  level: PrivacyLevel;
  label: string;
  color: string;
}

// Time in pool and note count drive the score.
// More time + more diverse notes = better privacy (larger anonymity set window).
export function computePrivacyScore(notes: { spent: boolean; createdAt: number }[]): PrivacyScore {
  const unspent = notes.filter(n => !n.spent);
  if (unspent.length === 0) return { level: 'low', label: 'No deposits', color: '#ef4444' };

  const now = Date.now();
  const oldestAge = Math.max(...unspent.map(n => now - n.createdAt));
  const hoursSinceOldest = oldestAge / (1000 * 60 * 60);

  let score = 0;

  // Time factor (0-50 points): longer residence = more mixing with other deposits
  if (hoursSinceOldest >= 24) score += 50;
  else if (hoursSinceOldest >= 6) score += 35;
  else if (hoursSinceOldest >= 1) score += 20;
  else score += 5;

  // Note count factor (0-50 points): more notes = larger anonymity set contribution
  if (unspent.length >= 5) score += 50;
  else if (unspent.length >= 3) score += 35;
  else if (unspent.length >= 2) score += 20;
  else score += 10;

  if (score >= 70) return { level: 'high', label: 'Strong privacy', color: '#00FF41' };
  if (score >= 40) return { level: 'medium', label: 'Moderate privacy', color: '#FFB000' };
  return { level: 'low', label: 'Low privacy', color: '#ef4444' };
}
