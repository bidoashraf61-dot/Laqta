import { crc32 } from 'node:zlib'

/**
 * A streaming ZIP writer — STORE only, no compression, no dependency.
 *
 * ── Why write one ───────────────────────────────────────────────────────────
 * The whole-album comp download is up to seventy preview MP4s. Buffering them
 * to build an archive would hold hundreds of megabytes per request; this
 * writes each file straight through as it is read, so memory is one chunk.
 *
 * No library is in `package.json` for it, and a video is already compressed:
 * DEFLATE over H.264 costs CPU and saves nothing. STORE with a data descriptor
 * is the whole of what is needed, and it is small enough to read in one go.
 *
 * ── The format, as written here ─────────────────────────────────────────────
 * Per entry: local header (general-purpose flag bit 3 = sizes and CRC follow
 * the data; bit 11 = UTF-8 name), the bytes, then a data descriptor carrying
 * the CRC-32 computed while streaming. Sizes are declared up front as well —
 * the caller knows them — so a streaming reader can find the end of a stored
 * entry. Then the central directory and the end record.
 *
 * Because every size is known before the first byte, so is the archive's
 * total length (`zipSize`), and the response can carry a real
 * `Content-Length` — the browser shows progress instead of a spinner.
 *
 * Limits: no ZIP64, so under 4 GiB in total and under 65,535 entries. Seventy
 * 720p previews of at most thirty seconds are a few hundred MB; `zipSize`
 * refuses anything larger rather than writing a corrupt archive.
 */

export type ZipEntry = {
  /** Path inside the archive. Forward slashes, no leading slash. */
  name: string
  /** Exact byte length. A source that yields a different count fails the stream. */
  size: number
  /** Opened lazily, one entry at a time, so only one source is open at once. */
  open: () => Promise<AsyncIterable<Uint8Array> | ReadableStream<Uint8Array>>
  modified?: Date
}

const LOCAL_HEADER = 30
const DESCRIPTOR = 16
const CENTRAL_HEADER = 46
const END_RECORD = 22
const MAX_32 = 0xffffffff

const FLAGS = (1 << 3) | (1 << 11)

export class ZipTooLargeError extends Error {}

/** Total archive length for these entries, or a throw if it needs ZIP64. */
export function zipSize(entries: Pick<ZipEntry, 'name' | 'size'>[]): number {
  if (entries.length > 0xffff) throw new ZipTooLargeError('too many entries for a non-ZIP64 archive')
  let total = END_RECORD
  for (const entry of entries) {
    const name = Buffer.byteLength(entry.name, 'utf8')
    total += LOCAL_HEADER + name + entry.size + DESCRIPTOR + CENTRAL_HEADER + name
  }
  if (total > MAX_32) throw new ZipTooLargeError('archive exceeds 4 GiB without ZIP64')
  return total
}

function dosDateTime(date: Date) {
  const time =
    (date.getHours() << 11) | (date.getMinutes() << 5) | Math.floor(date.getSeconds() / 2)
  const day =
    ((Math.max(date.getFullYear(), 1980) - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate()
  return { time, day }
}

async function* chunks(
  source: AsyncIterable<Uint8Array> | ReadableStream<Uint8Array>,
): AsyncGenerator<Uint8Array> {
  if (source instanceof ReadableStream) {
    const reader = source.getReader()
    try {
      while (true) {
        const { done, value } = await reader.read()
        if (done) return
        if (value) yield value
      }
    } finally {
      reader.releaseLock()
    }
  } else {
    for await (const chunk of source) yield chunk
  }
}

/**
 * The archive as a web stream, pulled by the response — nothing is read
 * from a source until the client is ready for it.
 */
export function zipStream(entries: ZipEntry[]): ReadableStream<Uint8Array> {
  zipSize(entries)
  const generator = writeZip(entries)
  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      try {
        const { done, value } = await generator.next()
        if (done) controller.close()
        else controller.enqueue(value)
      } catch (error) {
        controller.error(error)
      }
    },
    async cancel() {
      await generator.return(undefined)
    },
  })
}

async function* writeZip(entries: ZipEntry[]): AsyncGenerator<Uint8Array> {
  const central: Buffer[] = []
  let offset = 0

  for (const entry of entries) {
    const name = Buffer.from(entry.name, 'utf8')
    const { time, day } = dosDateTime(entry.modified ?? new Date())

    const local = Buffer.alloc(LOCAL_HEADER)
    local.writeUInt32LE(0x04034b50, 0)
    local.writeUInt16LE(20, 4) // version needed
    local.writeUInt16LE(FLAGS, 6)
    local.writeUInt16LE(0, 8) // STORE
    local.writeUInt16LE(time, 10)
    local.writeUInt16LE(day, 12)
    local.writeUInt32LE(0, 14) // CRC follows in the descriptor
    local.writeUInt32LE(entry.size, 18)
    local.writeUInt32LE(entry.size, 22)
    local.writeUInt16LE(name.length, 26)
    local.writeUInt16LE(0, 28)
    yield local
    yield name

    let crc = 0
    let written = 0
    for await (const chunk of chunks(await entry.open())) {
      crc = crc32(chunk, crc)
      written += chunk.byteLength
      if (written > entry.size) break
      yield chunk
    }
    if (written !== entry.size) {
      throw new Error(`zip entry ${entry.name}: expected ${entry.size} bytes, read ${written}`)
    }

    const descriptor = Buffer.alloc(DESCRIPTOR)
    descriptor.writeUInt32LE(0x08074b50, 0)
    descriptor.writeUInt32LE(crc >>> 0, 4)
    descriptor.writeUInt32LE(entry.size, 8)
    descriptor.writeUInt32LE(entry.size, 12)
    yield descriptor

    const header = Buffer.alloc(CENTRAL_HEADER)
    header.writeUInt32LE(0x02014b50, 0)
    header.writeUInt16LE(20, 4) // version made by
    header.writeUInt16LE(20, 6) // version needed
    header.writeUInt16LE(FLAGS, 8)
    header.writeUInt16LE(0, 10)
    header.writeUInt16LE(time, 12)
    header.writeUInt16LE(day, 14)
    header.writeUInt32LE(crc >>> 0, 16)
    header.writeUInt32LE(entry.size, 20)
    header.writeUInt32LE(entry.size, 24)
    header.writeUInt16LE(name.length, 28)
    // extra, comment, disk start, internal attrs = 0
    header.writeUInt32LE(0, 38) // external attrs
    header.writeUInt32LE(offset, 42)
    central.push(header, name)

    offset += LOCAL_HEADER + name.length + entry.size + DESCRIPTOR
  }

  const directory = Buffer.concat(central)
  yield directory

  const end = Buffer.alloc(END_RECORD)
  end.writeUInt32LE(0x06054b50, 0)
  end.writeUInt16LE(entries.length, 8)
  end.writeUInt16LE(entries.length, 10)
  end.writeUInt32LE(directory.length, 12)
  end.writeUInt32LE(offset, 16)
  yield end
}

/**
 * Read an archive's central directory back. Used by the gate and the unit
 * test to prove the archive holds exactly what was meant — kept next to the
 * writer so the two cannot drift apart.
 */
export function readZipDirectory(buffer: Buffer) {
  const endAt = buffer.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]))
  if (endAt < 0) throw new Error('no end-of-central-directory record')
  const count = buffer.readUInt16LE(endAt + 10)
  let at = buffer.readUInt32LE(endAt + 16)
  const entries: { name: string; size: number; crc: number; data: Buffer }[] = []
  for (let i = 0; i < count; i++) {
    if (buffer.readUInt32LE(at) !== 0x02014b50) throw new Error('bad central header')
    const crc = buffer.readUInt32LE(at + 16)
    const size = buffer.readUInt32LE(at + 24)
    const nameLength = buffer.readUInt16LE(at + 28)
    const extra = buffer.readUInt16LE(at + 30)
    const comment = buffer.readUInt16LE(at + 32)
    const localAt = buffer.readUInt32LE(at + 42)
    const name = buffer.subarray(at + 46, at + 46 + nameLength).toString('utf8')
    const localName = buffer.readUInt16LE(localAt + 26)
    const localExtra = buffer.readUInt16LE(localAt + 28)
    const dataAt = localAt + LOCAL_HEADER + localName + localExtra
    entries.push({ name, size, crc, data: buffer.subarray(dataAt, dataAt + size) })
    at += CENTRAL_HEADER + nameLength + extra + comment
  }
  return entries
}
