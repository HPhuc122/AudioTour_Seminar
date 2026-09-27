import type { PublicPoiList, PublicPoiSummary } from "./api"

export function hasMorePois(page: Pick<PublicPoiList, "page" | "pageSize" | "total"> | null): boolean {
  return page !== null && page.page * page.pageSize < page.total
}

export function appendPois(current: PublicPoiSummary[], incoming: PublicPoiSummary[]): PublicPoiSummary[] {
  const unique = new Map(current.map((poi) => [poi.id, poi]))
  for (const poi of incoming) unique.set(poi.id, poi)
  return [...unique.values()]
}
