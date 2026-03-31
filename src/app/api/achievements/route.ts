import { NextResponse } from "next/server";
import { getAchievementsWithProgress, getUserStreak } from "@/features/achievements/queries";
import { requireApiAuth } from "@/features/auth/api-auth";

export async function GET() {
  const auth = await requireApiAuth();
  if (!auth.authenticated) return auth.response;

  try {
    const userId = auth.session.user.id;
    const [achievements, streak] = await Promise.all([
      getAchievementsWithProgress(userId),
      getUserStreak(userId),
    ]);

    const totalPoints = achievements
      .filter((a) => a.unlockedAt)
      .reduce((sum, a) => sum + a.points, 0);

    const unlockedCount = achievements.filter((a) => a.unlockedAt).length;

    return NextResponse.json({
      achievements,
      stats: {
        totalPoints,
        unlockedCount,
        totalCount: achievements.length,
        currentStreak: streak?.currentStreak ?? 0,
      },
    });
  } catch {
    return NextResponse.json(
      { error: "Failed to fetch achievements", code: "FETCH_ERROR", status: 500 },
      { status: 500 },
    );
  }
}
