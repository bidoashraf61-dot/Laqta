import { db } from '@/lib/db'
import { BUNDLE_ALBUM_SELECT, bundleLines } from '@/lib/bundles'
import type { EditorAlbum } from '@/components/admin/bundle-editor'

/**
 * Every album a bundle can hold — live and priced — with its price NOW and
 * the commission rate the Laqta-share ceiling is measured against, so the
 * editor previews exactly what checkout will charge (DEV-62).
 */
export async function editorAlbums(): Promise<EditorAlbum[]> {
  const albums = await db.album.findMany({
    where: { status: 'live', priceStandard: { gt: 0 } },
    orderBy: [{ publishedAt: 'desc' }],
    select: {
      ...BUNDLE_ALBUM_SELECT,
      titleAr: true,
      titleEn: true,
      currency: true,
      creator: { select: { tier: true, commissionRateOverride: true, displayNameAr: true, displayNameEn: true } },
    },
  })
  const lines = bundleLines(albums)
  return albums.map((album, index) => ({
    id: album.id,
    titleAr: album.titleAr,
    titleEn: album.titleEn,
    creatorAr: album.creator.displayNameAr,
    creatorEn: album.creator.displayNameEn,
    currency: album.currency,
    gross: lines[index].gross,
    rate: lines[index].rate,
  }))
}
