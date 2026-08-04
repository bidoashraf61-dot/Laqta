import { TaxonomyHub, hubMetadata } from '@/components/catalogue/hub'

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  return hubMetadata('category', slug)
}

export default async function CategoryHub({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ page?: string }>
}) {
  const { slug } = await params
  const { page } = await searchParams
  return <TaxonomyHub kind="category" slug={slug} page={page ? Number(page) : 1} />
}
