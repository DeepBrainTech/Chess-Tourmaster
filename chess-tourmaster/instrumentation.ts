export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { startAchievementNotificationRetry } = await import('./lib/game/achievementNotifications');
    startAchievementNotificationRetry();
  }
}
