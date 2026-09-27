import { Fragment } from 'react'
import { Link } from '@/components/ui/link'
import { AlbumCard, type AlbumCardData } from '@/components/catalogue/album-card'
import type { Block, Inline } from '@/lib/blog-render'

/**
 * A blog post's body (DEV-43), from the parsed blocks of lib/blog-render.ts.
 * Read mode: a 68ch serif measure, generous space above headings, and album
 * embeds breaking out as a real album card — the thing the article is for.
 * Nothing here takes HTML: every string is a React text node.
 */
export function ArticleBody({ blocks, albums }: { blocks: Block[]; albums: Map<string, AlbumCardData> }) {
  return (
    <div className="space-y-6 font-serif text-lg leading-[1.95] text-foreground/85">
      {blocks.map((block, i) => {
        switch (block.kind) {
          case 'h2':
            return (
              <h2 key={i} className="pt-6 font-display text-2xl font-bold leading-snug text-foreground">
                {block.text}
              </h2>
            )
          case 'h3':
            return (
              <h3 key={i} className="pt-3 font-sans text-lg font-bold text-foreground">
                {block.text}
              </h3>
            )
          case 'list':
            return (
              <ul key={i} className="list-disc space-y-2 ps-6 marker:text-muted-foreground">
                {block.items.map((item, j) => (
                  <li key={j}>
                    <InlineText parts={item} />
                  </li>
                ))}
              </ul>
            )
          case 'quote':
            return (
              <blockquote key={i} className="border-s-2 border-foreground/20 ps-5 text-foreground/70">
                <InlineText parts={block.inline} />
              </blockquote>
            )
          case 'album': {
            const card = albums.get(`${block.handle}/${block.slug}`)
            // A paused or unknown album is simply not embedded.
            return card ? (
              <div key={i} className="not-prose mx-auto max-w-sm py-4 font-sans">
                <AlbumCard album={card} />
              </div>
            ) : null
          }
          default:
            return (
              <p key={i}>
                <InlineText parts={block.inline} />
              </p>
            )
        }
      })}
    </div>
  )
}

export function InlineText({ parts }: { parts: Inline[] }) {
  return (
    <>
      {parts.map((part, i) =>
        part.kind === 'bold' ? (
          <strong key={i} className="font-bold text-foreground">
            {part.text}
          </strong>
        ) : part.kind === 'link' ? (
          part.href.startsWith('/') ? (
            <Link key={i} href={part.href} className="underline decoration-foreground/30 underline-offset-4 hover:decoration-foreground">
              {part.text}
            </Link>
          ) : (
            <a key={i} href={part.href} rel="noopener nofollow" className="underline decoration-foreground/30 underline-offset-4 hover:decoration-foreground">
              {part.text}
            </a>
          )
        ) : (
          <Fragment key={i}>{part.text}</Fragment>
        ),
      )}
    </>
  )
}
