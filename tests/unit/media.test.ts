import { afterEach, describe, expect, it } from 'vitest'
import { heroFilmUrl, isPublicMediaKey, mediaUrl } from '@/lib/media'

const CDN = 'https://media.laqta.test'

afterEach(() => {
  delete process.env.NEXT_PUBLIC_MEDIA_CDN_URL
})

describe('mediaUrl — no CDN configured', () => {
  it('serves "/"-rooted dev files as-is', () => {
    expect(mediaUrl('/hero/vid/a.mp4')).toBe('/hero/vid/a.mp4')
  })

  it('answers null for a bucket key — the poster stays, never a broken <video>', () => {
    expect(mediaUrl('previews/alula-01.mp4')).toBeNull()
  })

  it('answers null for empty and protocol-relative input', () => {
    expect(mediaUrl(null)).toBeNull()
    expect(mediaUrl('')).toBeNull()
    expect(mediaUrl('//evil.test/x.mp4')).toBeNull()
  })

  it('falls back to the local hero film', () => {
    expect(heroFilmUrl(false)).toBe('/hero/vid/hero-web-v2.mp4')
    expect(heroFilmUrl(true)).toBe('/hero/vid/hero-web-m-v2.mp4')
  })
})

describe('mediaUrl — CDN configured', () => {
  it('resolves bucket keys against the CDN, trailing slash tolerated', () => {
    process.env.NEXT_PUBLIC_MEDIA_CDN_URL = `${CDN}/`
    expect(mediaUrl('previews/alula-01.mp4')).toBe(`${CDN}/previews/alula-01.mp4`)
    expect(heroFilmUrl(false)).toBe(`${CDN}/hero/hero-web-v2.mp4`)
  })

  it('refuses private prefixes — a master never gets a public URL', () => {
    process.env.NEXT_PUBLIC_MEDIA_CDN_URL = CDN
    for (const key of ['masters/a.mov', 'proxies/a.mp4', 'albums/x.zip', 'documents/c.pdf']) {
      expect(mediaUrl(key)).toBeNull()
    }
  })

  it('passes through its own CDN URLs and refuses anyone else’s', () => {
    process.env.NEXT_PUBLIC_MEDIA_CDN_URL = CDN
    expect(mediaUrl(`${CDN}/trailers/a.mp4`)).toBe(`${CDN}/trailers/a.mp4`)
    expect(mediaUrl('https://elsewhere.test/trailers/a.mp4')).toBeNull()
  })

  it('refuses traversal', () => {
    process.env.NEXT_PUBLIC_MEDIA_CDN_URL = CDN
    expect(mediaUrl('previews/../masters/a.mov')).toBeNull()
  })

  it('is idempotent — resolving a resolved URL changes nothing', () => {
    process.env.NEXT_PUBLIC_MEDIA_CDN_URL = CDN
    const once = mediaUrl('posters/a.jpg')
    expect(mediaUrl(once)).toBe(once)
  })
})

describe('isPublicMediaKey — what the trailer field accepts', () => {
  it('accepts bucket keys and dev paths', () => {
    expect(isPublicMediaKey('trailers/alula-dawn.mp4')).toBe(true)
    expect(isPublicMediaKey('/dev/trailer.mp4')).toBe(true)
  })

  it('refuses private keys, traversal, foreign URLs and junk', () => {
    expect(isPublicMediaKey('masters/a.mov')).toBe(false)
    expect(isPublicMediaKey('trailers/../masters/a.mov')).toBe(false)
    expect(isPublicMediaKey('https://elsewhere.test/a.mp4')).toBe(false)
    expect(isPublicMediaKey('a trailer please')).toBe(false)
  })
})
