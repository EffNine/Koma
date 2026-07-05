export {
  COMICK_SOURCE_FEED_GENRES as CK_GENRES,
  COMICK_SOURCE_FEED_SORTS as CK_SORTS,
  browseComickGenre as browseByGenre,
  comickSourceFeed,
  fetchComickOngoingPopular as fetchOngoingPopular,
  fetchComickPopularManga as fetchPopularManga,
  fetchComickPopularWebtoon as fetchPopularWebtoon,
  sourceFeedGenreSlug,
} from '../sourceFeeds/comick';
export type { ComickSourceFeedGenre as CKGenre, ComickSourceFeedSort as CKSort } from '../sourceFeeds/comick';
export type { SourceFeedSearchParams as CKSearchParams, SourceFeedTitle as CKTitle } from '../sourceFeeds/types';

import { comickSourceFeed } from '../sourceFeeds/comick';
import type { SourceFeedSearchParams, SourceFeedTitle } from '../sourceFeeds/types';

export function searchCK(params: SourceFeedSearchParams = {}): Promise<SourceFeedTitle[]> {
  return comickSourceFeed.search(params);
}
