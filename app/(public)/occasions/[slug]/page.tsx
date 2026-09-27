import { TaxonomyHub, hubMetadata } from '@/components/catalogue/hub'
import { requestLocale } from '@/lib/locale-request'

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  return hubMetadata('theme', slug)
}

export default async function OccasionHub({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ page?: string }>
}) {
  // Resolve the locale before rendering anything.
  //
  // Not inherited from the root layout: a route segment sits inside a Suspense
  // boundary, so React can begin rendering this page while the layout above it
  // is still awaiting. Whichever finishes first wins, which made the language of
  // a page depend on whether it happened to hit the database — the header came
  // out English and the body Arabic. Each segment resolves it itself, and the
  // call is a cached header read plus an idempotent write.
  await requestLocale()

  const { slug } = await params
  const { page } = await searchParams
  return <TaxonomyHub kind="theme" slug={slug} page={page ? Number(page) : 1} />
}
