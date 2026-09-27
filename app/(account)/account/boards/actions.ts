'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { requireUser } from '@/lib/auth'
import { db } from '@/lib/db'
import { actionT, requestLocale } from '@/lib/locale-request'
import { localePath } from '@/lib/locale'
import type { ActionResult } from '@/components/dashboard/form'

/**
 * Boards — a buyer's shortlists of clips (DEV-49).
 *
 * The clip page's «أضف للوح» linked here for months while nothing could create
 * a board or put a clip on one. Every action re-reads ownership from the
 * session: a board id or clip id in the payload is guessable. A clip can only
 * be added while its album is live — a board is a shortlist of things you can
 * buy, and it confers no entitlement.
 */

const NAME_MAX = 80
const BOARDS_MAX = 50

async function ownBoard(userId: string, boardId: string) {
  return db.board.findFirst({ where: { id: boardId, userId }, select: { id: true, shareToken: true } })
}

async function liveClip(clipId: string) {
  return db.clip.findFirst({ where: { id: clipId, album: { status: 'live' } }, select: { id: true } })
}

/** Create a board — and, when opened from a clip page, put that clip on it. */
export async function createBoard(_state: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const tr = await actionT()
  const user = await requireUser()
  const name = String(formData.get('name') ?? '').trim().slice(0, NAME_MAX)
  if (!name) return { ok: false, message: tr('boards.nameRequired') }
  if ((await db.board.count({ where: { userId: user.id } })) >= BOARDS_MAX) {
    return { ok: false, message: tr('boards.tooMany', { max: BOARDS_MAX }) }
  }

  const addId = String(formData.get('addClipId') ?? '')
  const clip = addId ? await liveClip(addId) : null
  const board = await db.board.create({
    data: { userId: user.id, name, ...(clip ? { clips: { create: { clipId: clip.id } } } : {}) },
  })
  revalidatePath('/account/boards')
  // Straight to the new board: that is where the creator of a shortlist goes
  // next, and it clears `?add=` so a refresh cannot add the clip twice.
  redirect(localePath(await requestLocale(), `/account/boards/${board.id}`))
}

export async function addClipToBoard(boardId: string, clipId: string): Promise<ActionResult> {
  const tr = await actionT()
  const user = await requireUser()
  const board = await ownBoard(user.id, boardId)
  const clip = await liveClip(clipId)
  if (!board || !clip) return { ok: false, message: tr('state.notFound') }

  await db.boardClip.upsert({
    where: { boardId_clipId: { boardId: board.id, clipId: clip.id } },
    create: { boardId: board.id, clipId: clip.id },
    update: {},
  })
  await db.board.update({ where: { id: board.id }, data: { updatedAt: new Date() } })
  revalidatePath('/account/boards', 'layout')
  return { ok: true, message: tr('boards.added') }
}

export async function removeClipFromBoard(boardId: string, clipId: string): Promise<ActionResult> {
  const tr = await actionT()
  const user = await requireUser()
  const board = await ownBoard(user.id, boardId)
  if (!board) return { ok: false, message: tr('state.notFound') }

  await db.boardClip.deleteMany({ where: { boardId: board.id, clipId } })
  revalidatePath('/account/boards', 'layout')
  revalidatePath(`/boards/${board.shareToken}`)
  return { ok: true, message: tr('boards.removed') }
}

/** Share by link, or stop sharing. Stopping keeps the token: re-sharing restores the same link. */
export async function setBoardPublic(boardId: string, isPublic: boolean): Promise<ActionResult> {
  const tr = await actionT()
  const user = await requireUser()
  const board = await ownBoard(user.id, boardId)
  if (!board) return { ok: false, message: tr('state.notFound') }

  await db.board.update({ where: { id: board.id }, data: { isPublic: Boolean(isPublic) } })
  revalidatePath('/account/boards', 'layout')
  revalidatePath(`/boards/${board.shareToken}`)
  return { ok: true, message: tr(isPublic ? 'boards.nowPublic' : 'boards.nowPrivate') }
}

export async function renameBoard(boardId: string, _state: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const tr = await actionT()
  const user = await requireUser()
  const board = await ownBoard(user.id, boardId)
  if (!board) return { ok: false, message: tr('state.notFound') }
  const name = String(formData.get('name') ?? '').trim().slice(0, NAME_MAX)
  if (!name) return { ok: false, message: tr('boards.nameRequired') }

  await db.board.update({ where: { id: board.id }, data: { name } })
  revalidatePath('/account/boards', 'layout')
  return { ok: true, message: tr('dash.saved') }
}

export async function deleteBoard(boardId: string): Promise<ActionResult> {
  const tr = await actionT()
  const user = await requireUser()
  const board = await ownBoard(user.id, boardId)
  if (!board) return { ok: false, message: tr('state.notFound') }

  await db.board.delete({ where: { id: board.id } })
  revalidatePath('/account/boards')
  redirect(localePath(await requestLocale(), '/account/boards'))
}
