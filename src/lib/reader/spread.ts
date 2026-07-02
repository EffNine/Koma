export type SpreadMode = 'single' | 'double';

export interface PagePair {
  left: number;  // page index for the left side
  right: number; // page index for the right side
}

/**
 * Pair pages for double-page spread mode.
 *
 * RTL: page N on the right, N+1 on the left (manga-style).
 * LTR: page N on the left, N+1 on the right (comic-style).
 *
 * Returns an array of pairs. The last pair may have only one page
 * if the total page count is odd.
 */
export function pairPages(
  totalPages: number,
  direction: 'rtl' | 'ltr',
): PagePair[] {
  const pairs: PagePair[] = [];

  if (direction === 'rtl') {
    // RTL: first page (cover) is alone on the right, then pair (2,3), (4,5)...
    // Page 0 is the cover, shown alone on the right
    if (totalPages === 0) return [];
    pairs.push({ left: -1, right: 0 }); // cover alone

    for (let i = 1; i < totalPages; i += 2) {
      if (i + 1 < totalPages) {
        // RTL: right = i, left = i+1
        pairs.push({ left: i + 1, right: i });
      } else {
        // Odd page left alone on the right
        pairs.push({ left: -1, right: i });
      }
    }
  } else {
    // LTR: standard left-to-right pairing
    for (let i = 0; i < totalPages; i += 2) {
      if (i + 1 < totalPages) {
        pairs.push({ left: i, right: i + 1 });
      } else {
        pairs.push({ left: i, right: -1 });
      }
    }
  }

  return pairs;
}

/**
 * Get the spread index for a given page number.
 */
export function pageToSpreadIndex(
  page: number,
  pairs: PagePair[],
): number {
  return pairs.findIndex(
    (p) => p.left === page || p.right === page,
  );
}
