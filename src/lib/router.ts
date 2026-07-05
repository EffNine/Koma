// ponytail: tiny hash router. ~25 lines. No router lib.
import { writable } from 'svelte/store';

export interface Route {
  path: string; // e.g. "/library", "/media/123", "/reader/456"
  params: Record<string, string>;
}

function parse(hash: string): Route {
  const raw = hash.replace(/^#/, '') || '/';
  const [path] = raw.split('?');
  const segments = path.split('/').filter(Boolean);
  return { path: '/' + segments.join('/'), params: {} };
}

export const route = writable<Route>(parse(location.hash));

window.addEventListener('hashchange', () => route.set(parse(location.hash)));

export function go(path: string) {
  if (location.hash !== '#' + path) location.hash = path;
}

// match a pattern like "/media/:id" against the current path
export function match(pattern: string, path: string): Record<string, string> | null {
  const pp = pattern.split('/').filter(Boolean);
  const ap = path.split('/').filter(Boolean);
  if (pp.length !== ap.length) return null;
  const params: Record<string, string> = {};
  for (let i = 0; i < pp.length; i++) {
    if (pp[i].startsWith(':')) params[pp[i].slice(1)] = decodeURIComponent(ap[i]);
    else if (pp[i] !== ap[i]) return null;
  }
  return params;
}
