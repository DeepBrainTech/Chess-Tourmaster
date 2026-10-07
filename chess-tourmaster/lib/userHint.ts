import { prisma } from '@/lib/prisma';

export async function ensureUserHint(portalUserId: number, username: string) {
  return prisma.userHint.upsert({
    where: { portal_user_id: portalUserId },
    update: { username },
    create: {
      portal_user_id: portalUserId,
      username,
      hint_count: 1,
      undo_count: 1,
    },
    select: { hint_count: true, undo_count: true },
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

export async function consumeUndoCount(portalUserId: number, username: string) {
  await ensureUserHint(portalUserId, username);
  const result = await prisma.userHint.updateMany({
    where: {
      portal_user_id: portalUserId,
      undo_count: { gt: 0 },
    },
    data: {
      username,
      undo_count: { decrement: 1 },
    },
  });

  if (result.count === 0) {
    const current = await prisma.userHint.findUnique({
      where: { portal_user_id: portalUserId },
      select: { undo_count: true },
    });
    return {
      success: false,
      undo_count: current?.undo_count ?? 0,
    };
  }

  const updated = await prisma.userHint.findUnique({
    where: { portal_user_id: portalUserId },
    select: { undo_count: true },
  });
  return {
    success: true,
    undo_count: updated?.undo_count ?? 0,
  };
}
