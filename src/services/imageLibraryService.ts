import { translateText } from "./translationService";

export interface SpaceImage {
  id: string;
  title: string;
  description: string;
  thumbUrl: string;
  mediumUrl: string;
  center?: string;
  photographer?: string;
  date?: string;
}

interface RawItem {
  data: {
    nasa_id: string;
    title: string;
    description?: string;
    center?: string;
    photographer?: string;
    date_created?: string;
  }[];
  links?: { href: string; rel?: string }[];
}

const cache = new Map<string, { at: number; value: SpaceImage[] }>();
const TTL_MS = 60 * 60 * 1000;

export async function searchImages(
  query: string,
  page = 1,
  pageSize = 20,
): Promise<SpaceImage[]> {
  const key = `${query.toLowerCase()}|${page}|${pageSize}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.value;

  const url = new URL("https://images-api.nasa.gov/search");
  url.searchParams.set("q", query);
  url.searchParams.set("media_type", "image");
  url.searchParams.set("page", String(page));
  url.searchParams.set("page_size", String(pageSize));

  const res = await fetch(url);

  if (res.status === 400 || res.status === 404) return [];
  if (!res.ok) throw new Error(`NASA Image Library xatosi: ${res.status}`);

  const json = (await res.json()) as { collection: { items: RawItem[] } };

  const items: SpaceImage[] = [];
  for (const raw of json.collection.items) {
    const d = raw.data?.[0];
    const thumb =
      raw.links?.find((l) => l.rel === "preview")?.href ?? raw.links?.[0]?.href;
    if (!d || !thumb) continue;

    items.push({
      id: d.nasa_id,
      title: d.title,
      description: (d.description ?? "").replace(/<[^>]+>/g, "").slice(0, 400),
      thumbUrl: thumb,
      // Odatda ~thumb.jpg bilan bir qatorda ~medium.jpg ham bo'ladi
      mediumUrl: thumb.replace("~thumb.", "~medium."),
      center: d.center,
      photographer: d.photographer,
      date: d.date_created,
    });
  }

  if (cache.size > 500) cache.clear();
  cache.set(key, { at: Date.now(), value: items });
  return items;
}

export async function searchByUzbekQuery(query: string, page = 1, pageSize = 20) {
  const translated = await translateText(query, "en");
  console.log("Tarjima (en):", translated);
  const en = (translated ?? query).split("\n")[0].trim();
  const items = await searchImages(en, page, pageSize);
  return { en, items };
}