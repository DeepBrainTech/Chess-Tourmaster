import { prisma } from '@/lib/prisma';

export async function ensureUserHint(portalUserId: number, username: string) {
  return prisma.userHint.upsert({
    where: { portal_user_id: portalUserId },
    update: { username },
    create: {
      portal_user_id: portalUserId,
      username,
      hint_count: 0,
    },
    select: { hint_count: true },
  });
}

export async function addHintCount(portalUserId: number, username: string, amount: number) {
  const safeAmount = Math.max(0, Math.floor(amount));
  if (safeAmount === 0) {
    return ensureUserHint(portalUserId, username);
  }

  await ensureUserHint(portalUserId, username);
  return prisma.userHint.update({
    where: { portal_user_id: portalUserId },
    data: {
      username,
      hint_count: { increment: safeAmount },
    },
    select: { hint_count: true },
  });
}

export async function consumeHintCount(portalUserId: number, username: string) {
  await ensureUserHint(portalUserId, username);
  const result = await prisma.userHint.updateMany({
    where: {
      portal_user_id: portalUserId,
      hint_count: { gt: 0 },
    },
    data: {
      username,
      hint_count: { decrement: 1 },
    },
  });

  if (result.count === 0) {
    const current = await prisma.userHint.findUnique({
      where: { portal_user_id: portalUserId },
      select: { hint_count: true },
    });
    return {
      success: false,
      hint_count: current?.hint_count ?? 0,
    };
  }

  const updated = await prisma.userHint.findUnique({
    where: { portal_user_id: portalUserId },
    select: { hint_count: true },
  });
  return {
    success: true,
    hint_count: updated?.hint_count ?? 0,
  };
}
