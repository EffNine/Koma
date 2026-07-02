import { fetchText } from '../net';
import { fingerprint } from './fingerprint';
import { presetByHost, presetById } from './presets';
import type { SourceCheck } from './sources';

export async function checkSourceUrl(rawUrl: string): Promise<SourceCheck> {
  const base = normalizeBase(rawUrl);
  const host = new URL(base).host.replace(/^www\./, '');
  const knownPreset = presetByHost(host)?.id;
  try {
    const html = await fetchText(base, { referer: base });
    const preset = fingerprint(html) || knownPreset;
    if (preset) {
      const presetName = presetById(preset)?.name ?? preset;
      return {
        base,
        preset,
        status: 'ready',
        statusNote: `Detected ${presetName}. Source looks ready.`,
        checkedAt: Date.now(),
      };
    }
    return {
      base,
      status: 'needs-config',
      statusNote: 'Saved, but no supported preset was detected yet.',
      checkedAt: Date.now(),
    };
  } catch (e) {
    if (knownPreset) {
      const presetName = presetById(knownPreset)?.name ?? knownPreset;
      return {
        base,
        preset: knownPreset,
        status: 'ready',
        statusNote: `Recognized ${presetName}. Live site check failed, but this source is supported.`,
        checkedAt: Date.now(),
      };
    }
    return {
      base,
      status: 'unreachable',
      statusNote: `Saved, but the site could not be checked: ${String(e)}`,
      checkedAt: Date.now(),
    };
  }
}

export function normalizeBase(u: string): string {
  let url = u.trim();
  if (!/^https?:\/\//.test(url)) url = 'https://' + url;
  // strip trailing path beyond the origin for a base
  try {
    const p = new URL(url);
    return p.origin + '/';
  } catch {
    return url.replace(/\/+$/, '') + '/';
  }
}
