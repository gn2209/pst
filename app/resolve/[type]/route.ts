import { NextRequest, NextResponse } from 'next/server';
import { normalizeErdbId } from '@/lib/addonProxy';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ALLOWED_IMAGE_TYPES = new Set(['poster', 'backdrop', 'logo']);
const TMDB_BASE_URL = 'https://api.themoviedb.org/3';
const tmdbFindCache = new Map<string, Promise<any>>();

const getPublicRequestUrl = (request: NextRequest) => {
  const forwardedHost = request.headers.get('x-forwarded-host') || request.headers.get('host');
  if (!forwardedHost) return request.nextUrl;
  const protoHeader = request.headers.get('x-forwarded-proto');
  const forwardedPort = request.headers.get('x-forwarded-port')?.split(',')[0].trim();
  const proto = (protoHeader?.split(',')[0].trim() || request.nextUrl.protocol.replace(':', '')).toLowerCase();
  const hostValue = forwardedHost.split(',')[0].trim();
  const url = new URL(request.nextUrl.toString());
  url.protocol = `${proto}:`;
  if (forwardedPort) {
    const hostname = hostValue.replace(/:\d+$/, '');
    const isDefaultPort =
      (proto === 'https' && forwardedPort === '443') ||
      (proto === 'http' && forwardedPort === '80');
    url.host = isDefaultPort ? hostname : `${hostname}:${forwardedPort}`;
  } else {
    const shouldStripPort =
      (proto === 'https' && /:443$/.test(hostValue)) ||
      (proto === 'http' && /:80$/.test(hostValue)) ||
      (proto === 'https' && /:7860$/.test(hostValue));
    url.host = shouldStripPort ? hostValue.replace(/:\d+$/, '') : hostValue;
  }
  return url;
};

const resolveTypeHint = (value: string | null): 'movie' | 'tv' | null => {
  if (!value) return null;
  const normalized = value.trim().toLowerCase();
  if (!normalized) return null;
  if (normalized === 'movie' || normalized === 'film') return 'movie';
  if (normalized === 'tv' || normalized === 'series' || normalized === 'show') return 'tv';
  return null;
};

const pickFirst = (...values: Array<string | null>) => {
  for (const value of values) {
    const trimmed = value?.trim();
    if (!trimmed) continue;
    if (/^\{[^}]+\}$/.test(trimmed)) continue;
    return trimmed;
  }
  return null;
};

const fetchTmdbJson = async (url: string) => {
  const cached = tmdbFindCache.get(url);
  if (cached) return cached;
  const promise = fetch(url, { cache: 'no-store' })
    .then(async (response) => {
      if (!response.ok) return null;
      try {
        return await response.json();
      } catch {
        return null;
      }
    })
    .catch(() => null);
  tmdbFindCache.set(url, promise);
  return promise;
};

const resolveTvdbToErdbId = async (
  tvdbId: string,
  typeHint: 'movie' | 'tv' | null,
  tmdbKey: string | null,
) => {
  if (!tvdbId || !tmdbKey) return null;

  const findUrl = new URL(`${TMDB_BASE_URL}/find/${encodeURIComponent(tvdbId)}`);
  findUrl.searchParams.set('api_key', tmdbKey);
  findUrl.searchParams.set('external_source', 'tvdb_id');
  const data = await fetchTmdbJson(findUrl.toString());
  if (!data || typeof data !== 'object') return null;

  const movieResults = Array.isArray(data.movie_results) ? data.movie_results : [];
  const tvResults = Array.isArray(data.tv_results) ? data.tv_results : [];

  if (typeHint === 'movie' && movieResults[0]?.id) {
    return normalizeErdbId(`tmdb:movie:${movieResults[0].id}`, 'movie');
  }
  if (typeHint === 'tv' && tvResults[0]?.id) {
    return normalizeErdbId(`tmdb:tv:${tvResults[0].id}`, 'tv');
  }
  if (movieResults[0]?.id) {
    return normalizeErdbId(`tmdb:movie:${movieResults[0].id}`, 'movie');
  }
  if (tvResults[0]?.id) {
    return normalizeErdbId(`tmdb:tv:${tvResults[0].id}`, 'tv');
  }

  return null;
};

const buildResolvedErdbId = async (searchParams: URLSearchParams) => {
  const imdbId = pickFirst(searchParams.get('imdb'), searchParams.get('imdb_id'));
  if (imdbId) {
    const normalized = normalizeErdbId(imdbId, null);
    if (normalized) return normalized;
  }

  const tmdbId = pickFirst(searchParams.get('tmdb'), searchParams.get('tmdb_id'));
  const typeHint = resolveTypeHint(pickFirst(searchParams.get('type'), searchParams.get('mediaType')));
  if (tmdbId) {
    const normalized = normalizeErdbId(
      typeHint ? `tmdb:${typeHint}:${tmdbId}` : `tmdb:${tmdbId}`,
      typeHint,
    );
    if (normalized) return normalized;
  }

  const tvdbId = pickFirst(searchParams.get('tvdb'), searchParams.get('tvdb_id'));
  if (tvdbId) {
    const resolved = await resolveTvdbToErdbId(
      tvdbId,
      typeHint,
      pickFirst(searchParams.get('tmdbKey'), searchParams.get('tmdb_key')),
    );
    if (resolved) return resolved;
  }

  const malId = pickFirst(searchParams.get('mal'), searchParams.get('mal_id'), searchParams.get('myanimelist'));
  if (malId) {
    const normalized = normalizeErdbId(`mal:${malId}`, null);
    if (normalized) return normalized;
  }

  const kitsuId = pickFirst(searchParams.get('kitsu'), searchParams.get('kitsu_id'));
  if (kitsuId) {
    const normalized = normalizeErdbId(`kitsu:${kitsuId}`, null);
    if (normalized) return normalized;
  }

  const anilistId = pickFirst(searchParams.get('anilist'), searchParams.get('anilist_id'));
  if (anilistId) {
    const normalized = normalizeErdbId(`anilist:${anilistId}`, null);
    if (normalized) return normalized;
  }

  const anidbId = pickFirst(searchParams.get('anidb'), searchParams.get('anidb_id'));
  if (anidbId) {
    const normalized = normalizeErdbId(`anidb:${anidbId}`, null);
    if (normalized) return normalized;
  }

  return null;
};

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ type: string }> }
) {
  const { type } = await params;
  if (!ALLOWED_IMAGE_TYPES.has(type)) {
    return NextResponse.json({ error: 'Unsupported image type.' }, { status: 400 });
  }

  const resolvedId = await buildResolvedErdbId(request.nextUrl.searchParams);
  if (!resolvedId) {
    return NextResponse.json({ error: 'No supported ID found in query string.' }, { status: 400 });
  }

  const publicRequestUrl = getPublicRequestUrl(request);
  const targetUrl = new URL(`/${type}/${encodeURIComponent(resolvedId)}.jpg`, publicRequestUrl.origin);
  for (const [key, value] of request.nextUrl.searchParams.entries()) {
    if (
      key === 'imdb' ||
      key === 'imdb_id' ||
      key === 'tmdb' ||
      key === 'tmdb_id' ||
      key === 'tvdb' ||
      key === 'tvdb_id' ||
      key === 'mal' ||
      key === 'mal_id' ||
      key === 'myanimelist' ||
      key === 'kitsu' ||
      key === 'kitsu_id' ||
      key === 'anilist' ||
      key === 'anilist_id' ||
      key === 'anidb' ||
      key === 'anidb_id' ||
      key === 'type' ||
      key === 'mediaType'
    ) {
      continue;
    }
    targetUrl.searchParams.append(key, value);
  }

  return NextResponse.redirect(targetUrl, { status: 307 });
}
