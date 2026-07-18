/** 1-based page numbers as stored in failedPages arrays. */
export function isFailedPage(pageIndex0: number, failedPages: number[]): boolean {
  return failedPages.includes(pageIndex0 + 1);
}

export function pagesStillLoading(
  totalPages: number,
  loadCount: number,
  failedPages: number[],
): boolean {
  return totalPages > 0 && loadCount + failedPages.length < totalPages;
}

export function fallbackSwitchMessage(sourceName: string): string {
  const name = sourceName.trim();
  return name ? `Opened on ${name} instead` : 'Opened on another reading site instead';
}

export function failedPageLabel(pageIndex0: number): string {
  return `Page ${pageIndex0 + 1} failed to load`;
}
