export enum AchievementType {
  SINGLE_ROUND = 'single_round',
  OVERALL = 'overall',
}

export enum AchievementMetric {
  DISTANCE = 'distance',
  BOX_JUMPS = 'box_jumps',
  COINS = 'coins',
  ROUNDS = 'rounds',
}

export interface Achievement {
  id: string;
  index: number; // Bit position (0-based)
  name: string;
  description: string;
  type: AchievementType;
  metric: AchievementMetric;
  threshold: number;
  icon?: string; // Optional path to an icon
}

export const ACHIEVEMENTS: Achievement[] = [
  // Distance (Single Round)
  { id: 'dist_100', index: 0, name: 'Sprinter', description: 'Run 100m in a single round', type: AchievementType.SINGLE_ROUND, metric: AchievementMetric.DISTANCE, threshold: 100 },
  { id: 'dist_500', index: 1, name: 'Marathoner', description: 'Run 500m in a single round', type: AchievementType.SINGLE_ROUND, metric: AchievementMetric.DISTANCE, threshold: 500 },
  { id: 'dist_1000', index: 2, name: 'Ultra Runner', description: 'Run 1000m in a single round', type: AchievementType.SINGLE_ROUND, metric: AchievementMetric.DISTANCE, threshold: 1000 },

  // Box Jumps (Single Round)
  { id: 'jump_10', index: 3, name: 'Hop', description: 'Jump 10 boxes in a single round', type: AchievementType.SINGLE_ROUND, metric: AchievementMetric.BOX_JUMPS, threshold: 10 },
  { id: 'jump_20', index: 4, name: 'Skip', description: 'Jump 20 boxes in a single round', type: AchievementType.SINGLE_ROUND, metric: AchievementMetric.BOX_JUMPS, threshold: 20 },
  { id: 'jump_30', index: 5, name: 'Jump', description: 'Jump 30 boxes in a single round', type: AchievementType.SINGLE_ROUND, metric: AchievementMetric.BOX_JUMPS, threshold: 30 },

  // Box Jumps (Overall)
  { id: 'jump_overall_100', index: 6, name: 'Box Enthusiast', description: 'Jump 100 boxes total', type: AchievementType.OVERALL, metric: AchievementMetric.BOX_JUMPS, threshold: 100 },
  { id: 'jump_overall_300', index: 7, name: 'Box Connoisseur', description: 'Jump 300 boxes total', type: AchievementType.OVERALL, metric: AchievementMetric.BOX_JUMPS, threshold: 300 },
  { id: 'jump_overall_500', index: 8, name: 'Box Master', description: 'Jump 500 boxes total', type: AchievementType.OVERALL, metric: AchievementMetric.BOX_JUMPS, threshold: 500 },

  // Coins (Single Round)
  { id: 'coins_10', index: 9, name: 'Pocket Change', description: 'Collect 10 coins in a single round', type: AchievementType.SINGLE_ROUND, metric: AchievementMetric.COINS, threshold: 10 },
  { id: 'coins_30', index: 10, name: 'Coin Collector', description: 'Collect 30 coins in a single round', type: AchievementType.SINGLE_ROUND, metric: AchievementMetric.COINS, threshold: 30 },
  { id: 'coins_50', index: 11, name: 'Treasure Hunter', description: 'Collect 50 coins in a single round', type: AchievementType.SINGLE_ROUND, metric: AchievementMetric.COINS, threshold: 50 },

  // Coins (Overall)
  { id: 'coins_overall_200', index: 12, name: 'Saving Up', description: 'Collect 200 coins total', type: AchievementType.OVERALL, metric: AchievementMetric.COINS, threshold: 200 },
  { id: 'coins_overall_300', index: 13, name: 'Getting Rich', description: 'Collect 300 coins total', type: AchievementType.OVERALL, metric: AchievementMetric.COINS, threshold: 300 },
  { id: 'coins_overall_500', index: 14, name: 'Coin Tycoon', description: 'Collect 500 coins total', type: AchievementType.OVERALL, metric: AchievementMetric.COINS, threshold: 500 },

  // Total Rounds Played
  { id: 'rounds_5', index: 15, name: 'Getting Started', description: 'Play 5 rounds', type: AchievementType.OVERALL, metric: AchievementMetric.ROUNDS, threshold: 5 },
  { id: 'rounds_10', index: 16, name: 'Regular Runner', description: 'Play 10 rounds', type: AchievementType.OVERALL, metric: AchievementMetric.ROUNDS, threshold: 10 },
  { id: 'rounds_30', index: 17, name: 'Seasoned Veteran', description: 'Play 30 rounds', type: AchievementType.OVERALL, metric: AchievementMetric.ROUNDS, threshold: 30 },
  { id: 'rounds_50', index: 18, name: 'True Dedication', description: 'Play 50 rounds', type: AchievementType.OVERALL, metric: AchievementMetric.ROUNDS, threshold: 50 },
];

// --- Bitmap Helper Functions ---

/**
 * Checks if a specific achievement is unlocked in the bitmap.
 * @param bitmap The player's achievement bitmap (as bigint).
 * @param index The zero-based index of the achievement to check.
 * @returns True if the achievement is unlocked, false otherwise.
 */
export function isAchievementUnlocked(bitmap: bigint, index: number): boolean {
  const mask = 1n << BigInt(index);
  return (bitmap & mask) !== 0n;
}

/**
 * Unlocks an achievement by setting the corresponding bit in the bitmap.
 * @param bitmap The player's current achievement bitmap (as bigint).
 * @param index The zero-based index of the achievement to unlock.
 * @returns The new bitmap with the achievement bit set.
 */
export function unlockAchievement(bitmap: bigint, index: number): bigint {
  const mask = 1n << BigInt(index);
  return bitmap | mask;
} 