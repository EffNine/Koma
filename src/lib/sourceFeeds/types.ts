export interface SourceFeedTitle {
  sourceFeedId: string;
  sourceTitleId: string;
  slug: string;
  title: string;
  cover?: string;
  country?: string;
  status?: string;
  lastChapter?: number | null;
  genres?: string[];
  rating?: string;
  followCount?: number;
  year?: number;
}

export interface SourceFeedSearchParams {
  q?: string;
  genres?: string[];
  excludeGenres?: string[];
  country?: string;
  sort?: string;
  time?: string;
  status?: string;
  page?: number;
  limit?: number;
}

export interface SourceFeed {
  id: string;
  label: string;
  genres: readonly string[];
  search(params?: SourceFeedSearchParams): Promise<SourceFeedTitle[]>;
}
