import { describe, expect, it } from 'vitest'
import { albumRefs, parseBody, parseInline, readingMinutes, safeHref } from '@/lib/blog-render'

describe('blog markup (DEV-43)', () => {
  it('parses headings, paragraphs, lists, quotes and album embeds', () => {
    const blocks = parseBody('## عنوان\n\nسطر أول\nيكمل هنا\n\n- أ\n- ب\n\n> اقتباس\n[[album:yousef-shami/alula-golden-hour-aerials]]\n### فرعي')
    expect(blocks.map((b) => b.kind)).toEqual(['h2', 'p', 'list', 'quote', 'album', 'h3'])
    expect(blocks[1]).toEqual({ kind: 'p', inline: [{ kind: 'text', text: 'سطر أول يكمل هنا' }] })
    expect(albumRefs(blocks)).toEqual([{ kind: 'album', handle: 'yousef-shami', slug: 'alula-golden-hour-aerials' }])
  })

  it('reads bold and safe links inline, and drops unsafe ones to text', () => {
    expect(parseInline('a **b** [c](/albums) [d](javascript:void0)')).toEqual([
      { kind: 'text', text: 'a ' },
      { kind: 'bold', text: 'b' },
      { kind: 'text', text: ' ' },
      { kind: 'link', text: 'c', href: '/albums' },
      { kind: 'text', text: ' ' },
      { kind: 'text', text: 'd' },
    ])
  })

  it('never lets an unsafe href through', () => {
    expect(safeHref('javascript:alert(1)')).toBeNull()
    expect(safeHref('data:text/html,x')).toBeNull()
    expect(safeHref('//evil.example')).toBeNull()
    expect(safeHref('https://laqta.sa/x')).toBe('https://laqta.sa/x')
  })

  it('treats markup-looking HTML as text', () => {
    const [block] = parseBody('<script>alert(1)</script>')
    expect(block).toEqual({ kind: 'p', inline: [{ kind: 'text', text: '<script>alert(1)</script>' }] })
  })

  it('reading time is at least a minute', () => {
    expect(readingMinutes(parseBody('كلمة'))).toBe(1)
    expect(readingMinutes(parseBody(Array.from({ length: 540 }, () => 'كلمة').join(' ')))).toBe(3)
  })
})
