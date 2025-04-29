import {
  ACHIEVEMENTS,
  Achievement,
  AchievementMetric,
  AchievementType,
  isAchievementUnlocked,
  unlockAchievement,
} from '../constants/achievements';

// Interfaces to define the structure of stats needed for checking
interface OverallStats {
  high_score: number;
  box_jumps: number;
  coins: number;
  rounds: number;
  level: number;
  xp: number;
  // Add any other overall stats needed for future achievements
}

interface RoundStats {
  score: number; // Assuming score is distance for now
  boxJumps: number;
  coins: number;
  // Add other single-round stats if needed
}

interface CheckAchievementsResult {
  newBitmap: bigint;
  unlockedAchievements: Achievement[];
}

/**
 * Checks all defined achievements against the player's current and round stats.
 * @param currentBitmap The player's achievement bitmap BEFORE this round.
 * @param overallStats The player's OVERALL stats AFTER this round's updates.
 * @param roundStats The stats specifically from the round just completed.
 * @returns An object containing the potentially updated bitmap and a list of newly unlocked achievements.
 */
export function checkAchievements(
  currentBitmap: bigint,
  overallStats: OverallStats,
  roundStats: RoundStats
): CheckAchievementsResult {
  let newBitmap = currentBitmap;
  const unlockedAchievements: Achievement[] = [];

  for (const achievement of ACHIEVEMENTS) {
    // Skip if already unlocked
    if (isAchievementUnlocked(currentBitmap, achievement.index)) {
      continue;
    }

    let criteriaMet = false;
    let currentValue: number | undefined;

    // Determine the value to check based on achievement type and metric
    if (achievement.type === AchievementType.SINGLE_ROUND) {
      switch (achievement.metric) {
        case AchievementMetric.DISTANCE:
          currentValue = roundStats.score; // Using score as distance
          break;
        case AchievementMetric.BOX_JUMPS:
          currentValue = roundStats.boxJumps;
          break;
        case AchievementMetric.COINS:
          currentValue = roundStats.coins;
          break;
      }
    } else if (achievement.type === AchievementType.OVERALL) {
      switch (achievement.metric) {
        case AchievementMetric.DISTANCE: // Currently using high_score for overall distance
           currentValue = overallStats.high_score;
           break;
        case AchievementMetric.BOX_JUMPS:
          currentValue = overallStats.box_jumps;
          break;
        case AchievementMetric.COINS:
          currentValue = overallStats.coins;
          break;
        case AchievementMetric.ROUNDS:
          currentValue = overallStats.rounds;
          break;
      }
    }

    // Check if the threshold is met
    if (currentValue !== undefined && currentValue >= achievement.threshold) {
      criteriaMet = true;
    }

    // If criteria met for a locked achievement, unlock it
    if (criteriaMet) {
      newBitmap = unlockAchievement(newBitmap, achievement.index);
      unlockedAchievements.push(achievement);
      console.log(`Achievement Unlocked: ${achievement.name}`); // Optional server log
    }
  }

  return { newBitmap, unlockedAchievements };
} 