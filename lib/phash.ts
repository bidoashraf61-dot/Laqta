/**
 * Perceptual hashing for duplicate detection (DEV-18).
 *
 * A dHash: the frame is shrunk to 9×8 greys and each bit records whether a
 * pixel is darker than its right-hand neighbour. A re-encode, a resize or a
 * light grade changes every byte of the file but barely moves these 64 bits,
 * so two hashes a few bits apart are the same picture. Pure — the frame is
 * pulled by `lib/media-pipeline.ts#perceptualHashOf`.
 */

export const DHASH_WIDTH = 9
export const DHASH_HEIGHT = 8

/** How many differing bits still count as "the same shot". */
export const DUPLICATE_DISTANCE = 6

/** 72 grey bytes (9×8, row-major) → 16 hex characters. */
export function dHashFromPixels(pixels: Uint8Array): string {
  if (pixels.length < DHASH_WIDTH * DHASH_HEIGHT) throw new Error('dHash needs a 9×8 grey frame')
  let bits = 0n
  for (let y = 0; y < DHASH_HEIGHT; y++) {
    for (let x = 0; x < DHASH_WIDTH - 1; x++) {
      const left = pixels[y * DHASH_WIDTH + x]
      const right = pixels[y * DHASH_WIDTH + x + 1]
      bits = (bits << 1n) | (left < right ? 1n : 0n)
    }
  }
  return bits.toString(16).padStart(16, '0')
}

/** Differing bits between two hex hashes; Infinity when either is malformed. */
export function hammingDistance(a: string, b: string): number {
  if (!/^[0-9a-f]{1,16}$/i.test(a) || !/^[0-9a-f]{1,16}$/i.test(b)) return Infinity
  let diff = BigInt(`0x${a}`) ^ BigInt(`0x${b}`)
  let count = 0
  while (diff) {
    count += Number(diff & 1n)
    diff >>= 1n
  }
  return count
}

export const isSameShot = (a: string, b: string) => hammingDistance(a, b) <= DUPLICATE_DISTANCE
