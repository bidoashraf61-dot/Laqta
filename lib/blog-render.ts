/**
 * The blog's light markup (DEV-43/44) → blocks. Pure, shared by the public
 * article and the editor's live preview, so what the owner previews is what
 * readers get.
 *
 *   ## Heading            → h2        ### Heading → h3
 *   - item                → list      > text      → quote
 *   [[album:handle/slug]] → album embed (on its own line)
 *   blank line           → new paragraph
 *   **bold**, [text](https://… or /path) inline
 *
 * Never HTML. Anything else is text, escaped by React where it is rendered.
 */

export type Inline = { kind: 'text'; text: string } | { kind: 'bold'; text: string } | { kind: 'link'; text: string; href: string }

export type Block =
  | { kind: 'p'; inline: Inline[] }
  | { kind: 'h2'; text: string }
  | { kind: 'h3'; text: string }
  | { kind: 'list'; items: Inline[][] }
  | { kind: 'quote'; inline: Inline[] }
  | { kind: 'album'; handle: string; slug: string }

const ALBUM = /^\[\[album:([a-z0-9-]+)\/([a-z0-9-]+)\]\]$/i

/** Only our own paths and http(s) — never `javascript:` or `data:`. */
export function safeHref(href: string): string | null {
  const value = href.trim()
  if (value.startsWith('/') && !value.startsWith('//')) return value
  try {
    const url = new URL(value)
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.toString() : null
  } catch {
    return null
  }
}

export function parseInline(source: string): Inline[] {
  const out: Inline[] = []
  const pattern = /\*\*([^*]+)\*\*|\[([^\]]+)\]\(([^)\s]+)\)/g
  let last = 0
  for (let match = pattern.exec(source); match; match = pattern.exec(source)) {
    if (match.index > last) out.push({ kind: 'text', text: source.slice(last, match.index) })
    if (match[1] !== undefined) out.push({ kind: 'bold', text: match[1] })
    else {
      const href = safeHref(match[3])
      out.push(href ? { kind: 'link', text: match[2], href } : { kind: 'text', text: match[2] })
    }
    last = match.index + match[0].length
  }
  if (last < source.length) out.push({ kind: 'text', text: source.slice(last) })
  return out
}

export function parseBody(source: string): Block[] {
  const blocks: Block[] = []
  let paragraph: string[] = []
  let list: Inline[][] = []

  const flushParagraph = () => {
    if (paragraph.length) blocks.push({ kind: 'p', inline: parseInline(paragraph.join(' ')) })
    paragraph = []
  }
  const flushList = () => {
    if (list.length) blocks.push({ kind: 'list', items: list })
    list = []
  }

  for (const raw of source.replace(/\r\n?/g, '\n').split('\n')) {
    const line = raw.trim()
    if (!line) {
      flushParagraph()
      flushList()
      continue
    }
    const album = ALBUM.exec(line)
    if (album) {
      flushParagraph()
      flushList()
      blocks.push({ kind: 'album', handle: album[1].toLowerCase(), slug: album[2].toLowerCase() })
    } else if (line.startsWith('### ')) {
      flushParagraph()
      flushList()
      blocks.push({ kind: 'h3', text: line.slice(4).trim() })
    } else if (line.startsWith('## ')) {
      flushParagraph()
      flushList()
      blocks.push({ kind: 'h2', text: line.slice(3).trim() })
    } else if (line.startsWith('- ')) {
      flushParagraph()
      list.push(parseInline(line.slice(2).trim()))
    } else if (line.startsWith('> ')) {
      flushParagraph()
      flushList()
      blocks.push({ kind: 'quote', inline: parseInline(line.slice(2).trim()) })
    } else {
      flushList()
      paragraph.push(line)
    }
  }
  flushParagraph()
  flushList()
  return blocks
}

/** The album references in a body, for one query of the embeds. */
export function albumRefs(blocks: Block[]) {
  return blocks.filter((block): block is Extract<Block, { kind: 'album' }> => block.kind === 'album')
}

/** Plain text of a body — for reading time and a fallback description. */
export function plainText(blocks: Block[]): string {
  const inline = (parts: Inline[]) => parts.map((part) => part.text).join('')
  return blocks
    .map((block) =>
      block.kind === 'p' || block.kind === 'quote'
        ? inline(block.inline)
        : block.kind === 'list'
          ? block.items.map(inline).join(' ')
          : block.kind === 'album'
            ? ''
            : block.text,
    )
    .filter(Boolean)
    .join(' ')
}

/** Minutes to read at ~180 words a minute (Arabic reads slower than English), at least one. */
export function readingMinutes(blocks: Block[]) {
  const words = plainText(blocks).split(/\s+/).filter(Boolean).length
  return Math.max(1, Math.round(words / 180))
}
