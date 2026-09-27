import { describe, it, expect } from 'vitest'
import { dHashFromPixels, hammingDistance, isSameShot } from '@/lib/phash'

const frame = (fn: (x: number, y: number) => number) =>
  Uint8Array.from({ length: 72 }, (_, i) => fn(i % 9, Math.floor(i / 9)))

describe('dHash (DEV-18)', () => {
  it('is 16 hex characters', () => {
    expect(dHashFromPixels(frame((x) => x * 20))).toMatch(/^[0-9a-f]{16}$/)
  })

  it('a left-to-right ramp is all ones; the reverse is all zeros', () => {
    expect(dHashFromPixels(frame((x) => x * 20))).toBe('ffffffffffffffff')
    expect(dHashFromPixels(frame((x) => 200 - x * 20))).toBe('0000000000000000')
  })

  it('ignores a uniform brightness shift — a light grade is the same shot', () => {
    const base = frame((x, y) => (x * 37 + y * 11) % 200)
    const brighter = base.map((v) => v + 40)
    expect(dHashFromPixels(brighter)).toBe(dHashFromPixels(base))
  })

  it('refuses a frame that is too small', () => {
    expect(() => dHashFromPixels(new Uint8Array(10))).toThrow()
  })
})

describe('hammingDistance / isSameShot', () => {
  it('counts differing bits', () => {
    expect(hammingDistance('0000000000000000', '0000000000000000')).toBe(0)
    expect(hammingDistance('0000000000000000', '000000000000000f')).toBe(4)
    expect(hammingDistance('ffffffffffffffff', '0000000000000000')).toBe(64)
  })

  it('a few bits apart is the same shot; far apart is not', () => {
    expect(isSameShot('0000000000000000', '000000000000003f')).toBe(true)
    expect(isSameShot('0000000000000000', '00000000000000ff')).toBe(false)
  })

  it('a malformed hash never matches', () => {
    expect(hammingDistance('zz', '00')).toBe(Infinity)
    expect(isSameShot('not-a-hash', 'not-a-hash')).toBe(false)
  })
})
