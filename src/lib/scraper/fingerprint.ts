import { PRESETS } from './presets';

// ponytail: detect CMS by HTML markers. First match wins.
export function fingerprint(html: string): string | null {
  for (const p of PRESETS) if (p.detect.test(html)) return p.id;
  return null;
}
