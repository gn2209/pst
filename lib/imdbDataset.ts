import { ensureDbInitialized, getDb } from './db';

type TableAvailability = {
  checkedAt: number;
  hasRatings: boolean;
  hasEpisodes: boolean;
};

type ImdbDatasetRating = {
  rating: number;
  votes: number;
};

const TABLE_CHECK_TTL_MS = 60 * 1000;
let tableAvailability: TableAvailability = {
  checkedAt: 0,
  hasRatings: false,
  hasEpisodes: false,
};

type ImdbDatasetEpisode = {
  imdbId: string;
  seriesImdbId: string;
  seasonNumber: number | null;
  episodeNumber: number | null;
};

const isImdbId = (value?: string | null) => {
  if (!value) return false;
  return /^tt\d+$/.test(value.trim());
};

const refreshTableAvailability = () => {
  const now = Date.now();
  if (now - tableAvailability.checkedAt < TABLE_CHECK_TTL_MS) return;
  ensureDbInitialized();
  const db = getDb();
  const hasRatings = Boolean(
    db
      .prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='imdb_ratings'")
      .get()
  );
  const hasEpisodes = Boolean(
    db
      .prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='imdb_episodes'")
      .get()
  );
  tableAvailability = {
    checkedAt: now,
    hasRatings,
    hasEpisodes,
  };
};

export const getImdbRatingFromDataset = (imdbId: string): ImdbDatasetRating | null => {
  const normalized = String(imdbId || '').trim();
  if (!isImdbId(normalized)) return null;

  refreshTableAvailability();
  if (!tableAvailability.hasRatings) return null;

  ensureDbInitialized();
  const db = getDb();
  try {
    const row = db
      .prepare('SELECT average_rating as averageRating, num_votes as numVotes FROM imdb_ratings WHERE tconst = ?')
      .get(normalized) as { averageRating?: number; numVotes?: number } | undefined;
    if (!row) return null;
    const rating = Number(row.averageRating);
    const votes = Number(row.numVotes);
    if (!Number.isFinite(rating) || !Number.isFinite(votes)) return null;
    return { rating, votes };
  } catch {
    return null;
  }
};

export const getImdbEpisodeFromDataset = (imdbId: string): ImdbDatasetEpisode | null => {
  const normalized = String(imdbId || '').trim();
  if (!isImdbId(normalized)) return null;

  refreshTableAvailability();
  if (!tableAvailability.hasEpisodes) return null;

  ensureDbInitialized();
  const db = getDb();
  try {
    const row = db
      .prepare(
        `SELECT tconst, parent_tconst as parentTconst, season_number as seasonNumber, episode_number as episodeNumber
         FROM imdb_episodes
         WHERE tconst = ?`
      )
      .get(normalized) as
      | { tconst?: string; parentTconst?: string; seasonNumber?: number | null; episodeNumber?: number | null }
      | undefined;
    if (!row?.tconst || !row.parentTconst) return null;
    return {
      imdbId: row.tconst,
      seriesImdbId: row.parentTconst,
      seasonNumber: typeof row.seasonNumber === 'number' && Number.isFinite(row.seasonNumber) ? row.seasonNumber : null,
      episodeNumber:
        typeof row.episodeNumber === 'number' && Number.isFinite(row.episodeNumber) ? row.episodeNumber : null,
    };
  } catch {
    return null;
  }
};

export const findImdbEpisodeBySeriesSeasonEpisode = (
  seriesImdbId: string,
  seasonNumber: number,
  episodeNumber: number
): ImdbDatasetEpisode | null => {
  const normalizedSeriesId = String(seriesImdbId || '').trim();
  if (!isImdbId(normalizedSeriesId)) return null;
  if (!Number.isFinite(seasonNumber) || !Number.isFinite(episodeNumber)) return null;

  refreshTableAvailability();
  if (!tableAvailability.hasEpisodes) return null;

  ensureDbInitialized();
  const db = getDb();
  try {
    const row = db
      .prepare(
        `SELECT tconst, parent_tconst as parentTconst, season_number as seasonNumber, episode_number as episodeNumber
         FROM imdb_episodes
         WHERE parent_tconst = ? AND season_number = ? AND episode_number = ?
         LIMIT 1`
      )
      .get(normalizedSeriesId, seasonNumber, episodeNumber) as
      | { tconst?: string; parentTconst?: string; seasonNumber?: number | null; episodeNumber?: number | null }
      | undefined;
    if (!row?.tconst || !row.parentTconst) return null;
    return {
      imdbId: row.tconst,
      seriesImdbId: row.parentTconst,
      seasonNumber: typeof row.seasonNumber === 'number' && Number.isFinite(row.seasonNumber) ? row.seasonNumber : null,
      episodeNumber:
        typeof row.episodeNumber === 'number' && Number.isFinite(row.episodeNumber) ? row.episodeNumber : null,
    };
  } catch {
    return null;
  }
};
