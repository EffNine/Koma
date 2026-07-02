// Community-maintained mapping of ComicK scanlation group names to their actual websites.
// Source: https://github.com/GooglyBlox/comick-group-mapping
// The mapping is a JSON array of { title, slug, url } objects.

const MAPPING_URL = 'https://raw.githubusercontent.com/GooglyBlox/comick-group-mapping/master/groups.json';

let mapping: Map<string, string> | null = null;
let loading: Promise<void> | null = null;

async function loadMapping(): Promise<Map<string, string>> {
  if (mapping) return mapping;
  if (loading) { await loading; return mapping!; }
  loading = (async () => {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);
      const r = await fetch(MAPPING_URL, { signal: controller.signal });
      clearTimeout(timeout);
      if (!r.ok) { mapping = new Map(); return; }
      const text = await r.text();
      if (!text.startsWith('[')) { mapping = new Map(); return; }
      const data = JSON.parse(text) as Array<{ title: string; url: string }>;
      const map = new Map<string, string>();
      for (const entry of data) {
        const key = entry.title.toLowerCase().trim();
        if (entry.url && !map.has(key)) map.set(key, entry.url);
      }
      mapping = map;
    } catch {
      mapping = new Map();
    }
  })();
  await loading;
  return mapping!;
}

/** Look up a scanlation group's website URL by its name. Returns null if unknown. */
export async function groupUrl(name: string): Promise<string | null> {
  const map = await loadMapping();
  return map.get(name.toLowerCase().trim()) ?? null;
}
