'use client';

import { HomePageView, type HomePageViewProps } from '@/components/home-page-view';
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type ChangeEvent,
} from 'react';
import {
  RATING_PROVIDER_OPTIONS,
  parseRatingPreferencesAllowEmpty,
  stringifyRatingPreferencesAllowEmpty,
  type RatingPreference,
} from '@/lib/ratingPreferences';
import {
  buildDefaultRatingRows,
  enabledOrderedToRows,
  rowsToEnabledOrdered,
  type RatingProviderRow,
} from '@/lib/ratingRows';
import {
  BACKDROP_RATING_LAYOUT_OPTIONS,
  DEFAULT_BACKDROP_RATING_LAYOUT,
  type BackdropRatingLayout,
} from '@/lib/backdropRatingLayout';
import {
  THUMBNAIL_RATING_LAYOUT_OPTIONS,
  DEFAULT_THUMBNAIL_RATING_LAYOUT,
  type ThumbnailRatingLayout,
} from '@/lib/thumbnailRatingLayout';
import {
  THUMBNAIL_SIZE_OPTIONS,
  DEFAULT_THUMBNAIL_SIZE,
  type ThumbnailSize,
} from '@/lib/thumbnailSize';
import {
  DEFAULT_POSTER_RATINGS_MAX_PER_SIDE,
  DEFAULT_POSTER_RATING_LAYOUT,
  POSTER_RATING_LAYOUT_OPTIONS,
  isVerticalPosterRatingLayout,
  type PosterRatingLayout,
} from '@/lib/posterRatingLayout';
import {
  DEFAULT_RATING_STYLE,
  RATING_STYLE_OPTIONS,
  type RatingStyle,
} from '@/lib/ratingStyle';

const SUPPORTED_LANGUAGES = [
  { code: 'en', label: 'English', flag: '\uD83C\uDDFA\uD83C\uDDF8' },
  { code: 'it', label: 'Italiano', flag: '\uD83C\uDDEE\uD83C\uDDF9' },
  { code: 'es', label: 'Espa\u00f1ol', flag: '\uD83C\uDDEA\uD83C\uDDF8' },
  { code: 'fr', label: 'Fran\u00e7ais', flag: '\uD83C\uDDEB\uD83C\uDDF7' },
  { code: 'de', label: 'Deutsch', flag: '\uD83C\uDDE9\uD83C\uDDEA' },
  { code: 'pt', label: 'Portugu\u00eas', flag: '\uD83C\uDDF5\uD83C\uDDF9' },
  { code: 'ru', label: '\u0420\u0443\u0441\u0441\u043a\u0438\u0439', flag: '\uD83C\uDDF7\uD83C\uDDFA' },
  { code: 'ja', label: '\u65e5\u672c\u8a9e', flag: '\uD83C\uDDEF\uD83C\uDDF5' },
  { code: 'zh', label: '\u4e2d\u6587', flag: '\uD83C\uDDE8\uD83C\uDDF3' },
  { code: 'tr', label: 'T\u00fcrk\u00e7e', flag: '\uD83C\uDDF9\uD83C\uDDF7' },
];
const VISIBLE_RATING_PROVIDER_OPTIONS = RATING_PROVIDER_OPTIONS;
const THUMBNAIL_SUPPORTED_RATINGS: RatingPreference[] = ['tmdb', 'imdb'];
const EPISODE_ID_PATTERN = /^.+:\d+:\d+$/;
const PROXY_TYPES = ['poster', 'backdrop', 'logo', 'thumbnail'] as const;
const PREVIEW_TYPES = ['poster', 'backdrop', 'logo', 'thumbnail'] as const;
type ProxyType = (typeof PROXY_TYPES)[number];
type PreviewType = (typeof PREVIEW_TYPES)[number];
type ProxyEnabledTypes = Record<ProxyType, boolean>;
type AiometadataPatternType = 'poster' | 'background' | 'logo' | 'episodeThumbnail';
type StreamBadgesSetting = 'auto' | 'on' | 'off';
type QualityBadgesSide = 'left' | 'right';
type PosterQualityBadgesPosition = 'auto' | QualityBadgesSide;
const DEFAULT_QUALITY_BADGES_STYLE: RatingStyle = 'glass';
const STREAM_BADGE_OPTIONS: Array<{ id: StreamBadgesSetting; label: string }> = [
  { id: 'auto', label: 'Auto' },
  { id: 'on', label: 'On' },
  { id: 'off', label: 'Off' },
];
const QUALITY_BADGE_SIDE_OPTIONS: Array<{ id: QualityBadgesSide; label: string }> = [
  { id: 'left', label: 'Left' },
  { id: 'right', label: 'Right' },
];
const POSTER_QUALITY_BADGE_POSITION_OPTIONS: Array<{
  id: PosterQualityBadgesPosition;
  label: string;
}> = [
  { id: 'auto', label: 'Auto' },
  { id: 'left', label: 'Left' },
  { id: 'right', label: 'Right' },
];
const TMDB_KEY_STORAGE_KEY = 'erdb_tmdb_key';
const MDBLIST_KEY_STORAGE_KEY = 'erdb_mdblist_key';
const SIMKL_CLIENT_ID_STORAGE_KEY = 'erdb_simkl_client_id';
const EXPORT_CONFIG_VERSION = 1;
const RATING_PROVIDER_IDS = new Set(RATING_PROVIDER_OPTIONS.map((option) => option.id));
const isRatingProviderId = (value: string): value is RatingPreference =>
  RATING_PROVIDER_IDS.has(value as RatingPreference);

const isPreviewType = (value: unknown): value is PreviewType =>
  PREVIEW_TYPES.includes(value as PreviewType);
const isProxyType = (value: unknown): value is ProxyType =>
  PROXY_TYPES.includes(value as ProxyType);
const isStreamBadgesSetting = (value: unknown): value is StreamBadgesSetting =>
  value === 'auto' || value === 'on' || value === 'off';
const isQualityBadgesSide = (value: unknown): value is QualityBadgesSide =>
  value === 'left' || value === 'right';
const isPosterQualityBadgesPosition = (value: unknown): value is PosterQualityBadgesPosition =>
  value === 'auto' || value === 'left' || value === 'right';
const isImageText = (value: unknown): value is 'original' | 'clean' | 'alternative' =>
  value === 'original' || value === 'clean' || value === 'alternative';
const isRatingStyle = (value: unknown): value is RatingStyle =>
  RATING_STYLE_OPTIONS.some((option) => option.id === value);
const isPosterRatingLayout = (value: unknown): value is PosterRatingLayout =>
  POSTER_RATING_LAYOUT_OPTIONS.some((option) => option.id === value);
const isBackdropRatingLayout = (value: unknown): value is BackdropRatingLayout =>
  BACKDROP_RATING_LAYOUT_OPTIONS.some((option) => option.id === value);
const isThumbnailRatingLayout = (value: unknown): value is ThumbnailRatingLayout =>
  THUMBNAIL_RATING_LAYOUT_OPTIONS.some((option) => option.id === value);

const normalizeBaseUrl = (value: string) => value.trim().replace(/\/+$/, '');

const normalizeManifestUrl = (value: string, allowBareScheme = false) => {
  const trimmed = value.trim();
  if (!trimmed) return '';
  const lower = trimmed.toLowerCase();
  if (!lower.startsWith('stremio://')) {
    return trimmed;
  }

  const withoutScheme = trimmed.slice('stremio://'.length);
  if (!withoutScheme) return allowBareScheme ? 'https://' : '';
  if (/^https?:\/\//i.test(withoutScheme)) {
    return withoutScheme;
  }
  return `https://${withoutScheme}`;
};

const isBareHttpUrl = (value: string) => value === 'http://' || value === 'https://';

const safeLocalStorageGet = (key: string) => {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
};

const safeLocalStorageSet = (key: string, value: string) => {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // ignore storage failures (private mode, quota, etc.)
  }
};

const safeLocalStorageRemove = (key: string) => {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(key);
  } catch {
    // ignore storage failures
  }
};

const subscribeToNothing = () => () => {};

const useClientOrigin = () =>
  useSyncExternalStore(
    subscribeToNothing,
    () => window.location.origin,
    () => ''
  );

const encodeBase64Url = (value: string) => {
  const bytes = new TextEncoder().encode(value);
  let binary = '';
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};

const decodeBase64Url = (value: string) => {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized.padEnd(normalized.length + ((4 - (normalized.length % 4)) % 4), '=');
  const binary = atob(padded);
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  return new TextDecoder().decode(bytes);
};

const buildAiometadataPattern = (options: {
  baseUrl: string;
  imageType: 'poster' | 'backdrop' | 'logo' | 'thumbnail';
  idPlaceholder: string;
  tmdbKey: string;
  mdblistKey: string;
  simklClientId: string;
  lang: string;
  posterRatings: string;
  backdropRatings: string;
  thumbnailRatings: string;
  logoRatings: string;
  posterStreamBadges: StreamBadgesSetting;
  backdropStreamBadges: StreamBadgesSetting;
  shouldShowPosterQualityBadgesSide: boolean;
  shouldShowPosterQualityBadgesPosition: boolean;
  qualityBadgesSide: QualityBadgesSide;
  posterQualityBadgesPosition: PosterQualityBadgesPosition;
  posterQualityBadgesStyle: RatingStyle;
  backdropQualityBadgesStyle: RatingStyle;
  posterRatingStyle: RatingStyle;
  backdropRatingStyle: RatingStyle;
  logoRatingStyle: RatingStyle;
  posterImageText: 'original' | 'clean' | 'alternative';
  backdropImageText: 'original' | 'clean' | 'alternative';
  posterRatingsLayout: PosterRatingLayout;
  posterRatingsMaxPerSide: number | null;
  backdropRatingsLayout: BackdropRatingLayout;
  thumbnailRatingsLayout: ThumbnailRatingLayout;
  thumbnailSize: ThumbnailSize;
}) => {
  const {
    baseUrl,
    imageType,
    idPlaceholder,
    tmdbKey,
    mdblistKey,
    simklClientId,
    lang,
    posterRatings,
    backdropRatings,
    thumbnailRatings,
    logoRatings,
    posterStreamBadges,
    backdropStreamBadges,
    shouldShowPosterQualityBadgesSide,
    shouldShowPosterQualityBadgesPosition,
    qualityBadgesSide,
    posterQualityBadgesPosition,
    posterQualityBadgesStyle,
    backdropQualityBadgesStyle,
    posterRatingStyle,
    backdropRatingStyle,
    logoRatingStyle,
    posterImageText,
    backdropImageText,
    posterRatingsLayout,
    posterRatingsMaxPerSide,
    backdropRatingsLayout,
    thumbnailRatingsLayout,
    thumbnailSize,
  } = options;

  if (!baseUrl || !tmdbKey || !mdblistKey) {
    return '';
  }

  const params: Array<[string, string]> = [
    ['tmdbKey', tmdbKey || '{tmdb_key}'],
    ['mdblistKey', mdblistKey || '{mdblist_key}'],
    ['lang', '{language_short}'],
  ];

  if (simklClientId) {
    params.push(['simklClientId', simklClientId]);
  }

  if (imageType === 'poster') {
    params.push(['posterRatings', posterRatings]);
    if (posterStreamBadges !== 'auto') {
      params.push(['posterStreamBadges', posterStreamBadges]);
    }
    if (shouldShowPosterQualityBadgesSide && qualityBadgesSide !== 'left') {
      params.push(['qualityBadgesSide', qualityBadgesSide]);
    }
    if (shouldShowPosterQualityBadgesPosition && posterQualityBadgesPosition !== 'auto') {
      params.push(['posterQualityBadgesPosition', posterQualityBadgesPosition]);
    }
    if (posterQualityBadgesStyle !== DEFAULT_QUALITY_BADGES_STYLE) {
      params.push(['posterQualityBadgesStyle', posterQualityBadgesStyle]);
    }
    params.push(['ratingStyle', posterRatingStyle]);
    params.push(['imageText', posterImageText]);
    params.push(['posterRatingsLayout', posterRatingsLayout]);
    if (isVerticalPosterRatingLayout(posterRatingsLayout) && posterRatingsMaxPerSide !== null) {
      params.push(['posterRatingsMaxPerSide', String(posterRatingsMaxPerSide)]);
    }
  } else if (imageType === 'backdrop') {
    params.push(['backdropRatings', backdropRatings]);
    if (backdropStreamBadges !== 'auto') {
      params.push(['backdropStreamBadges', backdropStreamBadges]);
    }
    if (backdropQualityBadgesStyle !== DEFAULT_QUALITY_BADGES_STYLE) {
      params.push(['backdropQualityBadgesStyle', backdropQualityBadgesStyle]);
    }
    params.push(['ratingStyle', backdropRatingStyle]);
    params.push(['imageText', backdropImageText]);
    params.push(['backdropRatingsLayout', backdropRatingsLayout]);
  } else if (imageType === 'thumbnail') {
    params.push(['thumbnailRatings', thumbnailRatings]);
    params.push(['ratingStyle', backdropRatingStyle]);
    params.push(['thumbnailRatingsLayout', thumbnailRatingsLayout]);
    params.push(['thumbnailSize', thumbnailSize]);
  } else {
    params.push(['logoRatings', logoRatings]);
    params.push(['ratingStyle', logoRatingStyle]);
  }

  const query = params
    .filter(([, value]) => value !== '')
    .map(([key, value]) => `${key}=${value}`)
    .join('&');

  return `${baseUrl}/${imageType}/${idPlaceholder}.jpg?${query}`;
};

const buildAiometadataPatternBlock = (options: {
  baseUrl: string;
  imageType: 'poster' | 'backdrop' | 'logo' | 'thumbnail';
  configString: string;
}) => {
  if (!options.baseUrl || !options.configString) {
    return '';
  }

  let config: Record<string, unknown>;
  try {
    config = JSON.parse(decodeBase64Url(options.configString)) as Record<string, unknown>;
  } catch {
    return '';
  }

  const params: Array<[string, string]> = [];
  const THUMBNAIL_SUPPORTED_RATINGS = new Set(['tmdb', 'imdb']);

  const pushIfString = (key: string) => {
    const value = config[key];
    if (typeof value === 'string' && value !== '') {
      params.push([key, value]);
    }
  };

  const filterThumbnailRatings = (value: unknown) => {
    if (typeof value !== 'string' || value === '') return '';
    return value
      .split(',')
      .map((provider) => provider.trim().toLowerCase())
      .filter((provider, index, providers) => {
        return THUMBNAIL_SUPPORTED_RATINGS.has(provider) && providers.indexOf(provider) === index;
      })
      .join(',');
  };

  pushIfString('tmdbKey');
  pushIfString('lang');

  if (options.imageType !== 'thumbnail') {
    pushIfString('mdblistKey');
    pushIfString('simklClientId');
    pushIfString('ratings');
    pushIfString('qualityBadgesSide');
    pushIfString('posterQualityBadgesPosition');
    pushIfString('qualityBadgesStyle');
    pushIfString('posterQualityBadgesStyle');
    pushIfString('backdropQualityBadgesStyle');
    pushIfString('streamBadges');
    pushIfString('posterStreamBadges');
    pushIfString('backdropStreamBadges');
    pushIfString('thumbnailRatings');
  }

  if (options.imageType === 'poster') {
    pushIfString('posterRatings');
    if (typeof config.posterRatingStyle === 'string' && config.posterRatingStyle !== '') {
      params.push(['ratingStyle', config.posterRatingStyle]);
    }
    if (typeof config.posterImageText === 'string' && config.posterImageText !== '') {
      params.push(['imageText', config.posterImageText]);
    }
    pushIfString('posterRatingsLayout');
    if (
      typeof config.posterRatingsMaxPerSide === 'string' ||
      typeof config.posterRatingsMaxPerSide === 'number'
    ) {
      params.push(['posterRatingsMaxPerSide', String(config.posterRatingsMaxPerSide)]);
    }
  } else if (options.imageType === 'backdrop' || options.imageType === 'thumbnail') {
    if (typeof config.backdropRatingStyle === 'string' && config.backdropRatingStyle !== '') {
      params.push(['ratingStyle', config.backdropRatingStyle]);
    }
    if (options.imageType !== 'thumbnail' && typeof config.backdropImageText === 'string' && config.backdropImageText !== '') {
      params.push(['imageText', config.backdropImageText]);
    }
    pushIfString(options.imageType === 'thumbnail' ? 'thumbnailRatingsLayout' : 'backdropRatingsLayout');
    if (options.imageType === 'thumbnail') {
      const thumbnailRatings = filterThumbnailRatings(config.thumbnailRatings ?? config.ratings);
      if (thumbnailRatings) {
        params.push(['ratings', thumbnailRatings]);
      }
      pushIfString('thumbnailSize');
    } else {
      pushIfString('backdropRatings');
    }
  } else {
    pushIfString('logoRatings');
    if (typeof config.logoRatingStyle === 'string' && config.logoRatingStyle !== '') {
      params.push(['ratingStyle', config.logoRatingStyle]);
    }
  }

  const query = params
    .filter(([, value]) => value !== '')
    .map(([key, value]) => `${key}=${value}`)
    .join('&');

  const idPattern =
    options.imageType === 'thumbnail'
      ? 'tmdb:{type}:{tmdb_id}:{season}:{episode}'
      : 'tmdb:{type}:{tmdb_id}';
  const basePattern = `${options.baseUrl}/${options.imageType}/${idPattern}.jpg`;
  return query ? `${basePattern}?${query}` : basePattern;
};

const downloadJsonFile = (payload: Record<string, unknown>, filename: string) => {
  if (typeof window === 'undefined') return;
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
};

const maskSensitiveText = (value: string) => value.replace(/[^\s]/g, '*');

export default function Home() {
  const [previewType, setPreviewType] = useState<PreviewType>('poster');
  const [mediaId, setMediaId] = useState('tt0133093');
  const [lang, setLang] = useState('en');
  const [posterImageText, setPosterImageText] = useState<'original' | 'clean' | 'alternative'>('clean');
  const [backdropImageText, setBackdropImageText] = useState<'original' | 'clean' | 'alternative'>('clean');
  const [posterRatingRows, setPosterRatingRows] = useState<RatingProviderRow[]>(buildDefaultRatingRows);
  const [backdropRatingRows, setBackdropRatingRows] = useState<RatingProviderRow[]>(buildDefaultRatingRows);
  const [thumbnailRatingRows, setThumbnailRatingRows] = useState<RatingProviderRow[]>(
    enabledOrderedToRows(THUMBNAIL_SUPPORTED_RATINGS)
  );
  const [logoRatingRows, setLogoRatingRows] = useState<RatingProviderRow[]>(buildDefaultRatingRows);

  const posterRatingPreferences = useMemo(() => rowsToEnabledOrdered(posterRatingRows), [posterRatingRows]);
  const backdropRatingPreferences = useMemo(() => rowsToEnabledOrdered(backdropRatingRows), [backdropRatingRows]);
  const thumbnailRatingPreferences = useMemo(
    () =>
      rowsToEnabledOrdered(thumbnailRatingRows).filter((rating): rating is RatingPreference =>
        THUMBNAIL_SUPPORTED_RATINGS.includes(rating)
      ),
    [thumbnailRatingRows]
  );
  const logoRatingPreferences = useMemo(() => rowsToEnabledOrdered(logoRatingRows), [logoRatingRows]);
  const [posterStreamBadges, setPosterStreamBadges] = useState<StreamBadgesSetting>('auto');
  const [backdropStreamBadges, setBackdropStreamBadges] = useState<StreamBadgesSetting>('auto');
  const [qualityBadgesSide, setQualityBadgesSide] = useState<QualityBadgesSide>('left');
  const [posterQualityBadgesPosition, setPosterQualityBadgesPosition] =
    useState<PosterQualityBadgesPosition>('auto');
  const [posterQualityBadgesStyle, setPosterQualityBadgesStyle] = useState<RatingStyle>(DEFAULT_QUALITY_BADGES_STYLE);
  const [backdropQualityBadgesStyle, setBackdropQualityBadgesStyle] = useState<RatingStyle>(DEFAULT_QUALITY_BADGES_STYLE);
  const [posterRatingsLayout, setPosterRatingsLayout] = useState<PosterRatingLayout>('bottom');
  const [backdropRatingsLayout, setBackdropRatingsLayout] = useState<BackdropRatingLayout>(DEFAULT_BACKDROP_RATING_LAYOUT);
  const [thumbnailRatingsLayout, setThumbnailRatingsLayout] = useState<ThumbnailRatingLayout>(DEFAULT_THUMBNAIL_RATING_LAYOUT);
  const [thumbnailSize, setThumbnailSize] = useState<ThumbnailSize>(DEFAULT_THUMBNAIL_SIZE);
  const [posterRatingStyle, setPosterRatingStyle] = useState<RatingStyle>(DEFAULT_RATING_STYLE);
  const [backdropRatingStyle, setBackdropRatingStyle] = useState<RatingStyle>(DEFAULT_RATING_STYLE);
  const [logoRatingStyle, setLogoRatingStyle] = useState<RatingStyle>('plain');
  const [posterRatingsMaxPerSide, setPosterRatingsMaxPerSide] = useState<number | null>(DEFAULT_POSTER_RATINGS_MAX_PER_SIDE);
  const [supportedLanguages, setSupportedLanguages] = useState(SUPPORTED_LANGUAGES);
  const [mdblistKey, setMdblistKey] = useState('');
  const [tmdbKey, setTmdbKey] = useState('');
  const [simklClientId, setSimklClientId] = useState('');
  const [proxyManifestUrl, setProxyManifestUrl] = useState('');
  const [proxyEnabledTypes, setProxyEnabledTypes] = useState<ProxyEnabledTypes>({
    poster: true,
    backdrop: true,
    logo: true,
    thumbnail: true,
  });
  const [proxyTranslateMeta, setProxyTranslateMeta] = useState(false);
  const [proxyCopied, setProxyCopied] = useState(false);
  const [configCopied, setConfigCopied] = useState(false);
  const [showConfigString, setShowConfigString] = useState(false);
  const [showProxyUrl, setShowProxyUrl] = useState(false);
  const [aiometadataCopiedType, setAiometadataCopiedType] = useState<AiometadataPatternType | null>(null);
  const [exportStatus, setExportStatus] = useState<'idle' | 'with' | 'without'>('idle');
  const [importStatus, setImportStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [importMessage, setImportMessage] = useState('');
  const navRef = useRef<HTMLElement | null>(null);
  const baseUrl = normalizeBaseUrl(useClientOrigin());

  const [copied, setCopied] = useState(false);
  const shouldShowPosterQualityBadgesSide = posterRatingsLayout === 'top-bottom';
  const shouldShowPosterQualityBadgesPosition =
    posterRatingsLayout === 'top' || posterRatingsLayout === 'bottom';
  const shouldShowQualityBadgesSide = previewType === 'poster' && shouldShowPosterQualityBadgesSide;
  const shouldShowQualityBadgesPosition =
    previewType === 'poster' && shouldShowPosterQualityBadgesPosition;
  const qualityBadgeTypeLabel = previewType === 'backdrop' || previewType === 'thumbnail' ? 'Backdrop' : 'Poster';
  const activeStreamBadges =
    previewType === 'backdrop' || previewType === 'thumbnail' ? backdropStreamBadges : posterStreamBadges;
  const setActiveStreamBadges =
    previewType === 'backdrop' || previewType === 'thumbnail'
      ? setBackdropStreamBadges
      : setPosterStreamBadges;
  const activeQualityBadgesStyle =
    previewType === 'backdrop' || previewType === 'thumbnail'
      ? backdropQualityBadgesStyle
      : posterQualityBadgesStyle;
  const setActiveQualityBadgesStyle =
    previewType === 'backdrop' || previewType === 'thumbnail'
      ? setBackdropQualityBadgesStyle
      : setPosterQualityBadgesStyle;

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const storedTmdbKey = safeLocalStorageGet(TMDB_KEY_STORAGE_KEY);
    const storedMdblistKey = safeLocalStorageGet(MDBLIST_KEY_STORAGE_KEY);
    const storedSimklClientId = safeLocalStorageGet(SIMKL_CLIENT_ID_STORAGE_KEY);
    if (!storedTmdbKey && !storedMdblistKey && !storedSimklClientId) {
      return;
    }
    const frameId = window.requestAnimationFrame(() => {
      if (storedTmdbKey) {
        setTmdbKey(storedTmdbKey);
      }
      if (storedMdblistKey) {
        setMdblistKey(storedMdblistKey);
      }
      if (storedSimklClientId) {
        setSimklClientId(storedSimklClientId);
      }
    });
    return () => window.cancelAnimationFrame(frameId);
  }, []);

  useEffect(() => {
    if (tmdbKey) {
      safeLocalStorageSet(TMDB_KEY_STORAGE_KEY, tmdbKey);
    } else {
      safeLocalStorageRemove(TMDB_KEY_STORAGE_KEY);
    }
  }, [tmdbKey]);

  useEffect(() => {
    if (mdblistKey) {
      safeLocalStorageSet(MDBLIST_KEY_STORAGE_KEY, mdblistKey);
    } else {
      safeLocalStorageRemove(MDBLIST_KEY_STORAGE_KEY);
    }
  }, [mdblistKey]);

  useEffect(() => {
    if (simklClientId) {
      safeLocalStorageSet(SIMKL_CLIENT_ID_STORAGE_KEY, simklClientId);
    } else {
      safeLocalStorageRemove(SIMKL_CLIENT_ID_STORAGE_KEY);
    }
  }, [simklClientId]);

  const scrollToHash = useCallback((hash: string, behavior: ScrollBehavior = 'smooth') => {
    if (typeof window === 'undefined') return;
    if (!hash || !hash.startsWith('#')) return;
    const target = document.querySelector(hash);
    if (!target) return;
    const navHeight = navRef.current?.getBoundingClientRect().height ?? 0;
    const offset = navHeight + 12;
    const top = Math.max(0, target.getBoundingClientRect().top + window.scrollY - offset);
    window.scrollTo({ top, behavior });
  }, []);

  const handleAnchorClick = useCallback(
    (event: React.MouseEvent<HTMLAnchorElement>) => {
      const href = event.currentTarget.getAttribute('href');
      if (!href || !href.startsWith('#')) return;
      event.preventDefault();
      if (typeof window !== 'undefined') {
        window.history.pushState(null, '', href);
      }
      scrollToHash(href);
    },
    [scrollToHash]
  );

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handleHashChange = () => scrollToHash(window.location.hash);
    if (window.location.hash) {
      requestAnimationFrame(() => scrollToHash(window.location.hash, 'auto'));
    }
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, [scrollToHash]);

  useEffect(() => {
    if (tmdbKey && tmdbKey.length > 10) {
      fetch(`https://api.themoviedb.org/3/configuration/languages?api_key=${tmdbKey}`)
        .then(res => res.json())
        .then(data => {
          if (Array.isArray(data)) {
            const formatted = data.map((l: any) => ({
              code: l.iso_639_1,
              label: l.english_name || l.name,
              flag: '\uD83C\uDF10'
            })).sort((a, b) => a.label.localeCompare(b.label));
            setSupportedLanguages(formatted);
          }
        })
        .catch(() => { });
    }
  }, [tmdbKey]);

  const handleCopyPrompt = useCallback(() => {
    const prompt = `Act as an expert addon developer. I want to implement the ERDB Stateless API into my media center addon.

--- CONFIG INPUT ---
Add a single text field called \"erdbConfig\" (base64url). The user will paste it from the ERDB site after configuring there.
Do NOT hardcode API keys or base URL. Always use cfg.baseUrl from erdbConfig.

--- DECODE ---
Node/JS: const cfg = JSON.parse(Buffer.from(erdbConfig, 'base64url').toString('utf8'));

--- FULL API REFERENCE ---
Endpoint: GET /{type}/{id}.jpg?...queryParams

Parameter               | Values                                                              | Default
type (path)             | poster, backdrop, logo, thumbnail                                    | -
id (path)               | IMDb (tt...), TMDB (tmdb:id / tmdb:movie:id / tmdb:tv:id), Kitsu (kitsu:id), AniList, MAL          | -
ratings                 | tmdb, mdblist, imdb, tomatoes, tomatoesaudience, letterboxd,         | all
                        | metacritic, metacriticuser, trakt, simkl, rogerebert,               |
                        | myanimelist, anilist, kitsu (global fallback)                       |
posterRatings           | tmdb, mdblist, imdb, tomatoes, tomatoesaudience, letterboxd,         | all
                        | metacritic, metacriticuser, trakt, simkl, rogerebert,               |
                        | myanimelist, anilist, kitsu (poster only)                           |
backdropRatings         | tmdb, mdblist, imdb, tomatoes, tomatoesaudience, letterboxd,         | all
                        | metacritic, metacriticuser, trakt, simkl, rogerebert,               |
                        | myanimelist, anilist, kitsu (backdrop only)                         |
logoRatings             | tmdb, mdblist, imdb, tomatoes, tomatoesaudience, letterboxd,         | all
                        | metacritic, metacriticuser, trakt, simkl, rogerebert,               |
                        | myanimelist, anilist, kitsu (logo only)                             |
lang                    | Any TMDB ISO 639-1 code (en, it, fr, es, de, ja, ko, etc.)            | en
streamBadges            | auto, on, off (global fallback)                                      | auto
posterStreamBadges      | auto, on, off (poster only)                                          | auto
backdropStreamBadges    | auto, on, off (backdrop only)                                        | auto
qualityBadgesSide       | left, right (poster top-bottom only)                                 | left
posterQualityBadgesPosition | auto, left, right (poster top/bottom only)                       | auto
qualityBadgesStyle      | glass, square, plain (global fallback)                               | glass
posterQualityBadgesStyle| glass, square, plain (poster only)                                   | glass
backdropQualityBadgesStyle| glass, square, plain (backdrop only)                               | glass
ratingStyle             | glass, square, plain                                                 | glass
imageText               | original, clean, alternative                                         | original
posterRatingsLayout     | top, bottom, left, right, top-bottom, left-right                     | top-bottom
posterRatingsMaxPerSide | Number (1-20)                                                        | auto
backdropRatingsLayout   | center, right, right-vertical                                        | center
thumbnailRatingsLayout  | center, center-top, center-bottom, center-vertical, center-top-vertical, center-bottom-vertical, left, left-top, left-bottom, left-vertical, left-top-vertical, left-bottom-vertical, right, right-top, right-bottom, right-vertical, right-top-vertical, right-bottom-vertical | center
thumbnailSize           | small, medium, large                                                 | medium
tmdbKey (REQUIRED)      | Your TMDB v3 API Key                                                 | -
mdblistKey (REQUIRED)   | Your MDBList.com API Key                                             | -
simklClientId (OPTIONAL)| Your SIMKL client_id for direct SIMKL ratings                        | -

--- INTEGRATION REQUIREMENTS ---
1. Use ONLY the \"erdbConfig\" field (no modal and no extra settings panels).
2. Add toggles to enable/disable: poster, backdrop, logo, thumbnail.
3. If a type is disabled, keep the original artwork (do not call ERDB for that type).
4. Build ERDB URLs using the decoded config and inject them into both catalog and meta responses.

--- PER-TYPE SETTINGS ---
poster   -> ratingStyle = cfg.posterRatingStyle, imageText = cfg.posterImageText
backdrop -> ratingStyle = cfg.backdropRatingStyle, imageText = cfg.backdropImageText
thumbnail -> ratingStyle = cfg.backdropRatingStyle, thumbnailRatingsLayout = cfg.thumbnailRatingsLayout, thumbnailSize = cfg.thumbnailSize, ratings = cfg.thumbnailRatings ?? cfg.ratings filtered to TMDB/IMDb
logo     -> ratingStyle = cfg.logoRatingStyle (omit imageText)
Ratings providers can be set per-type via cfg.posterRatings / cfg.backdropRatings / cfg.thumbnailRatings / cfg.logoRatings (fallback to cfg.ratings). Thumbnail ratings are episode-level and currently support TMDB + IMDb only.
Quality badges style can be set per-type via cfg.posterQualityBadgesStyle / cfg.backdropQualityBadgesStyle (fallback to cfg.qualityBadgesStyle).

--- URL BUILD ---
const typeRatingStyle = type === 'poster' ? cfg.posterRatingStyle : type === 'backdrop' ? cfg.backdropRatingStyle : cfg.logoRatingStyle;
const typeImageText = type === 'backdrop' ? cfg.backdropImageText : cfg.posterImageText;
\${cfg.baseUrl}/\${type}/\${id}.jpg?tmdbKey=\${cfg.tmdbKey}&mdblistKey=\${cfg.mdblistKey}&simklClientId=\${cfg.simklClientId}&ratings=\${cfg.ratings}&posterRatings=\${cfg.posterRatings}&backdropRatings=\${cfg.backdropRatings}&thumbnailRatings=\${cfg.thumbnailRatings}&logoRatings=\${cfg.logoRatings}&lang=\${cfg.lang}&streamBadges=\${cfg.streamBadges}&posterStreamBadges=\${cfg.posterStreamBadges}&backdropStreamBadges=\${cfg.backdropStreamBadges}&qualityBadgesSide=\${cfg.qualityBadgesSide}&posterQualityBadgesPosition=\${cfg.posterQualityBadgesPosition}&qualityBadgesStyle=\${cfg.qualityBadgesStyle}&posterQualityBadgesStyle=\${cfg.posterQualityBadgesStyle}&backdropQualityBadgesStyle=\${cfg.backdropQualityBadgesStyle}&ratingStyle=\${typeRatingStyle}&imageText=\${typeImageText}&posterRatingsLayout=\${cfg.posterRatingsLayout}&posterRatingsMaxPerSide=\${cfg.posterRatingsMaxPerSide}&backdropRatingsLayout=\${cfg.backdropRatingsLayout}

For thumbnails use thumbnailRatingsLayout and thumbnailSize instead of imageText.
Omit imageText when type=logo or type=thumbnail.

Skip any params that are undefined. Keep empty ratings/posterRatings/backdropRatings/thumbnailRatings/logoRatings to disable providers.`;

    navigator.clipboard.writeText(prompt);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, []);

  const previewUrl = useMemo(() => {
    const ratingPreferencesForType =
      previewType === 'poster'
        ? posterRatingPreferences
        : previewType === 'backdrop'
          ? backdropRatingPreferences
          : previewType === 'thumbnail'
            ? thumbnailRatingPreferences
          : logoRatingPreferences;
    const ratingsQuery = stringifyRatingPreferencesAllowEmpty(ratingPreferencesForType);
    const ratingStyleForType =
      previewType === 'poster'
        ? posterRatingStyle
        : previewType === 'backdrop' || previewType === 'thumbnail'
          ? backdropRatingStyle
          : logoRatingStyle;
    const imageTextForType =
      previewType === 'backdrop' || previewType === 'thumbnail' ? backdropImageText : posterImageText;
    const streamBadgesForType =
      previewType === 'backdrop' || previewType === 'thumbnail' ? backdropStreamBadges : posterStreamBadges;
    const qualityBadgesStyleForType =
      previewType === 'backdrop' || previewType === 'thumbnail'
        ? backdropQualityBadgesStyle
        : posterQualityBadgesStyle;
    const query = new URLSearchParams({
      ratingStyle: ratingStyleForType,
      lang,
    });
    if (previewType === 'poster') {
      query.set('posterRatings', ratingsQuery);
    } else if (previewType === 'backdrop') {
      query.set('backdropRatings', ratingsQuery);
    } else if (previewType === 'thumbnail') {
      query.set('thumbnailRatings', ratingsQuery);
    } else {
      query.set('logoRatings', ratingsQuery);
    }
    if (previewType !== 'logo' && previewType !== 'thumbnail' && streamBadgesForType !== 'auto') {
      query.set(
        previewType === 'backdrop'
          ? 'backdropStreamBadges'
          : 'posterStreamBadges',
        streamBadgesForType
      );
    }
    if (shouldShowQualityBadgesSide && qualityBadgesSide !== 'left') {
      query.set('qualityBadgesSide', qualityBadgesSide);
    }
    if (shouldShowQualityBadgesPosition && posterQualityBadgesPosition !== 'auto') {
      query.set('posterQualityBadgesPosition', posterQualityBadgesPosition);
    }
    if (previewType !== 'logo' && previewType !== 'thumbnail' && qualityBadgesStyleForType !== DEFAULT_QUALITY_BADGES_STYLE) {
      query.set(
        previewType === 'backdrop'
          ? 'backdropQualityBadgesStyle'
          : 'posterQualityBadgesStyle',
        qualityBadgesStyleForType
      );
    }

    if (mdblistKey) {
      query.set('mdblistKey', mdblistKey);
    }
    if (simklClientId) {
      query.set('simklClientId', simklClientId);
    }
    if (tmdbKey) {
      query.set('tmdbKey', tmdbKey);
    }

    if (previewType === 'poster' || previewType === 'backdrop') {
      query.set('imageText', imageTextForType);
    }
    if (previewType === 'poster') {
      query.set('posterRatingsLayout', posterRatingsLayout);
      if (isVerticalPosterRatingLayout(posterRatingsLayout) && posterRatingsMaxPerSide !== null) {
        query.set('posterRatingsMaxPerSide', String(posterRatingsMaxPerSide));
      }
    } else if (previewType === 'backdrop' || previewType === 'thumbnail') {
      query.set(
        previewType === 'thumbnail' ? 'thumbnailRatingsLayout' : 'backdropRatingsLayout',
        previewType === 'thumbnail' ? thumbnailRatingsLayout : backdropRatingsLayout
      );
      if (previewType === 'thumbnail') {
        query.set('thumbnailSize', thumbnailSize);
        query.set('previewVariant', `${thumbnailSize}-${thumbnailRatingsLayout}`);
      }
    }

    if (!baseUrl) {
      return '';
    }
    return `${baseUrl}/${previewType}/${mediaId}.jpg?${query.toString()}`;
  }, [
    previewType,
    mediaId,
    lang,
    posterImageText,
    backdropImageText,
    posterRatingPreferences,
    backdropRatingPreferences,
    thumbnailRatingPreferences,
    logoRatingPreferences,
    posterStreamBadges,
    backdropStreamBadges,
    shouldShowQualityBadgesSide,
    shouldShowQualityBadgesPosition,
    posterRatingsLayout,
    posterRatingsMaxPerSide,
    backdropRatingsLayout,
    thumbnailRatingsLayout,
    thumbnailSize,
    qualityBadgesSide,
    posterQualityBadgesPosition,
    posterQualityBadgesStyle,
    backdropQualityBadgesStyle,
    posterRatingStyle,
    backdropRatingStyle,
    logoRatingStyle,
    baseUrl,
    mdblistKey,
    simklClientId,
    tmdbKey,
  ]);

  const configString = useMemo(() => {
    const tmdb = tmdbKey.trim();
    const mdb = mdblistKey.trim();
    const simkl = simklClientId.trim();
    if (!baseUrl || !tmdb || !mdb) {
      return '';
    }

    const config: Record<string, string | number> = {
      baseUrl,
      tmdbKey: tmdb,
      mdblistKey: mdb,
    };
    if (simkl) {
      config.simklClientId = simkl;
    }

    const posterRatingsQuery = stringifyRatingPreferencesAllowEmpty(posterRatingPreferences);
    const backdropRatingsQuery = stringifyRatingPreferencesAllowEmpty(backdropRatingPreferences);
    const thumbnailRatingsQuery = stringifyRatingPreferencesAllowEmpty(thumbnailRatingPreferences);
    const logoRatingsQuery = stringifyRatingPreferencesAllowEmpty(logoRatingPreferences);
    const ratingsMatch =
      posterRatingsQuery === backdropRatingsQuery &&
      posterRatingsQuery === thumbnailRatingsQuery &&
      posterRatingsQuery === logoRatingsQuery;
    if (ratingsMatch) {
      config.ratings = posterRatingsQuery;
    } else {
      config.posterRatings = posterRatingsQuery;
      config.backdropRatings = backdropRatingsQuery;
      config.thumbnailRatings = thumbnailRatingsQuery;
      config.logoRatings = logoRatingsQuery;
    }
    if (lang) {
      config.lang = lang;
    }
    if (posterStreamBadges !== 'auto') {
      config.posterStreamBadges = posterStreamBadges;
    }
    if (backdropStreamBadges !== 'auto') {
      config.backdropStreamBadges = backdropStreamBadges;
    }
    if (shouldShowPosterQualityBadgesSide && qualityBadgesSide !== 'left') {
      config.qualityBadgesSide = qualityBadgesSide;
    }
    if (shouldShowPosterQualityBadgesPosition && posterQualityBadgesPosition !== 'auto') {
      config.posterQualityBadgesPosition = posterQualityBadgesPosition;
    }
    if (posterQualityBadgesStyle !== DEFAULT_QUALITY_BADGES_STYLE) {
      config.posterQualityBadgesStyle = posterQualityBadgesStyle;
    }
    if (backdropQualityBadgesStyle !== DEFAULT_QUALITY_BADGES_STYLE) {
      config.backdropQualityBadgesStyle = backdropQualityBadgesStyle;
    }
    if (posterRatingStyle) {
      config.posterRatingStyle = posterRatingStyle;
    }
    if (backdropRatingStyle) {
      config.backdropRatingStyle = backdropRatingStyle;
    }
    if (logoRatingStyle) {
      config.logoRatingStyle = logoRatingStyle;
    }
    if (posterImageText) {
      config.posterImageText = posterImageText;
    }
    if (backdropImageText) {
      config.backdropImageText = backdropImageText;
    }
    if (posterRatingsLayout) {
      config.posterRatingsLayout = posterRatingsLayout;
    }
    if (isVerticalPosterRatingLayout(posterRatingsLayout) && posterRatingsMaxPerSide !== null) {
      config.posterRatingsMaxPerSide = posterRatingsMaxPerSide;
    }
    if (backdropRatingsLayout) {
      config.backdropRatingsLayout = backdropRatingsLayout;
    }
    if (thumbnailRatingsLayout) {
      config.thumbnailRatingsLayout = thumbnailRatingsLayout;
    }
    if (thumbnailSize) {
      config.thumbnailSize = thumbnailSize;
    }

    return encodeBase64Url(JSON.stringify(config));
  }, [
    baseUrl,
    tmdbKey,
    mdblistKey,
    simklClientId,
    posterRatingPreferences,
    backdropRatingPreferences,
    thumbnailRatingPreferences,
    logoRatingPreferences,
    posterStreamBadges,
    backdropStreamBadges,
    shouldShowPosterQualityBadgesSide,
    shouldShowPosterQualityBadgesPosition,
    qualityBadgesSide,
    posterQualityBadgesPosition,
    posterQualityBadgesStyle,
    backdropQualityBadgesStyle,
    lang,
    posterRatingStyle,
    backdropRatingStyle,
    logoRatingStyle,
    posterImageText,
    backdropImageText,
    posterRatingsLayout,
    posterRatingsMaxPerSide,
    backdropRatingsLayout,
    thumbnailRatingsLayout,
    thumbnailSize,
  ]);

  const proxyUrl = useMemo(() => {
    if (!baseUrl) {
      return '';
    }
    const manifestUrl = normalizeManifestUrl(proxyManifestUrl);
    const tmdb = tmdbKey.trim();
    const mdb = mdblistKey.trim();
    const simkl = simklClientId.trim();
    if (!manifestUrl || isBareHttpUrl(manifestUrl) || !tmdb || !mdb) {
      return '';
    }

    const config: Record<string, string | boolean> = {
      url: manifestUrl,
      tmdbKey: tmdb,
      mdblistKey: mdb,
    };
    if (simkl) {
      config.simklClientId = simkl;
    }

    const proxyPosterRatingsQuery = stringifyRatingPreferencesAllowEmpty(posterRatingPreferences);
    const proxyBackdropRatingsQuery = stringifyRatingPreferencesAllowEmpty(backdropRatingPreferences);
    const proxyThumbnailRatingsQuery = stringifyRatingPreferencesAllowEmpty(thumbnailRatingPreferences);
    const proxyLogoRatingsQuery = stringifyRatingPreferencesAllowEmpty(logoRatingPreferences);
    const proxyRatingsMatch =
      proxyPosterRatingsQuery === proxyBackdropRatingsQuery &&
      proxyPosterRatingsQuery === proxyThumbnailRatingsQuery &&
      proxyPosterRatingsQuery === proxyLogoRatingsQuery;
    if (proxyRatingsMatch) {
      config.ratings = proxyPosterRatingsQuery;
    } else {
      config.posterRatings = proxyPosterRatingsQuery;
      config.backdropRatings = proxyBackdropRatingsQuery;
      config.thumbnailRatings = proxyThumbnailRatingsQuery;
      config.logoRatings = proxyLogoRatingsQuery;
    }
    if (lang) {
      config.lang = lang;
    }
    if (posterStreamBadges !== 'auto') {
      config.posterStreamBadges = posterStreamBadges;
    }
    if (backdropStreamBadges !== 'auto') {
      config.backdropStreamBadges = backdropStreamBadges;
    }
    if (shouldShowPosterQualityBadgesSide && qualityBadgesSide !== 'left') {
      config.qualityBadgesSide = qualityBadgesSide;
    }
    if (shouldShowPosterQualityBadgesPosition && posterQualityBadgesPosition !== 'auto') {
      config.posterQualityBadgesPosition = posterQualityBadgesPosition;
    }
    if (posterQualityBadgesStyle !== DEFAULT_QUALITY_BADGES_STYLE) {
      config.posterQualityBadgesStyle = posterQualityBadgesStyle;
    }
    if (backdropQualityBadgesStyle !== DEFAULT_QUALITY_BADGES_STYLE) {
      config.backdropQualityBadgesStyle = backdropQualityBadgesStyle;
    }

    config.posterRatingStyle = posterRatingStyle;
    config.backdropRatingStyle = backdropRatingStyle;
    config.logoRatingStyle = logoRatingStyle;
    config.posterImageText = posterImageText;
    config.backdropImageText = backdropImageText;
    config.posterEnabled = proxyEnabledTypes.poster;
    config.backdropEnabled = proxyEnabledTypes.backdrop;
    config.logoEnabled = proxyEnabledTypes.logo;
    config.thumbnailEnabled = proxyEnabledTypes.thumbnail;
    if (proxyTranslateMeta) {
      config.translateMeta = true;
    }

    if (posterRatingsLayout) {
      config.posterRatingsLayout = posterRatingsLayout;
    }
    if (isVerticalPosterRatingLayout(posterRatingsLayout) && posterRatingsMaxPerSide !== null) {
      config.posterRatingsMaxPerSide = String(posterRatingsMaxPerSide);
    }
    if (backdropRatingsLayout) {
      config.backdropRatingsLayout = backdropRatingsLayout;
    }
    if (thumbnailRatingsLayout) {
      config.thumbnailRatingsLayout = thumbnailRatingsLayout;
    }
    if (thumbnailSize) {
      config.thumbnailSize = thumbnailSize;
    }

    config.erdbBase = baseUrl;
    const encoded = encodeBase64Url(JSON.stringify(config));
    return `${baseUrl}/proxy/${encoded}/manifest.json`;
  }, [
    proxyManifestUrl,
    tmdbKey,
    mdblistKey,
    simklClientId,
    posterRatingPreferences,
    backdropRatingPreferences,
    thumbnailRatingPreferences,
    logoRatingPreferences,
    lang,
    posterStreamBadges,
    backdropStreamBadges,
    shouldShowPosterQualityBadgesSide,
    shouldShowPosterQualityBadgesPosition,
    qualityBadgesSide,
    posterQualityBadgesPosition,
    posterQualityBadgesStyle,
    backdropQualityBadgesStyle,
    posterRatingStyle,
    backdropRatingStyle,
    logoRatingStyle,
    posterImageText,
    backdropImageText,
    posterRatingsLayout,
    posterRatingsMaxPerSide,
    backdropRatingsLayout,
    thumbnailRatingsLayout,
    thumbnailSize,
    proxyEnabledTypes,
    proxyTranslateMeta,
    baseUrl,
  ]);

  const aiometadataPatterns = useMemo(() => {
    return {
      poster: buildAiometadataPatternBlock({
        baseUrl,
        imageType: 'poster',
        configString,
      }),
      background: buildAiometadataPatternBlock({
        baseUrl,
        imageType: 'backdrop',
        configString,
      }),
      logo: buildAiometadataPatternBlock({
        baseUrl,
        imageType: 'logo',
        configString,
      }),
      episodeThumbnail: buildAiometadataPatternBlock({
        baseUrl,
        imageType: 'thumbnail',
        configString,
      }),
    };
  }, [
    baseUrl,
    configString,
  ]);

  const updateRatingRowsForType = (
    type: PreviewType,
    updater: (current: RatingProviderRow[]) => RatingProviderRow[]
  ) => {
    if (type === 'poster') {
      setPosterRatingRows(updater);
      return;
    }
    if (type === 'backdrop') {
      setBackdropRatingRows(updater);
      return;
    }
    if (type === 'thumbnail') {
      setThumbnailRatingRows((current) => {
        const next = updater(current);
        const supportedSet = new Set<RatingPreference>(THUMBNAIL_SUPPORTED_RATINGS);
        return next.map((row) => ({
          ...row,
          enabled: supportedSet.has(row.id) ? row.enabled : false,
        }));
      });
      return;
    }
    setLogoRatingRows(updater);
  };

  const toggleRatingPreference = (rating: RatingPreference) => {
    updateRatingRowsForType(previewType, (rows) =>
      rows.map((r) => (r.id === rating ? { ...r, enabled: !r.enabled } : r))
    );
  };

  const reorderRatingPreference = (fromIndex: number, toIndex: number) => {
    updateRatingRowsForType(previewType, (rows) => {
      if (
        fromIndex === toIndex ||
        fromIndex < 0 ||
        toIndex < 0 ||
        fromIndex >= rows.length ||
        toIndex >= rows.length
      ) {
        return rows;
      }
      if (previewType === 'thumbnail') {
        const supportedSet = new Set<RatingPreference>(THUMBNAIL_SUPPORTED_RATINGS);
        const thumbnailRows = rows.filter((row) => supportedSet.has(row.id));
        if (fromIndex >= thumbnailRows.length || toIndex >= thumbnailRows.length) {
          return rows;
        }

        const reorderedThumbnailRows = [...thumbnailRows];
        const [item] = reorderedThumbnailRows.splice(fromIndex, 1);
        reorderedThumbnailRows.splice(toIndex, 0, item);

        let thumbnailCursor = 0;
        return rows.map((row) => {
          if (!supportedSet.has(row.id)) {
            return row;
          }
          const nextRow = reorderedThumbnailRows[thumbnailCursor];
          thumbnailCursor += 1;
          return nextRow;
        });
      }

      const copy = [...rows];
      const [item] = copy.splice(fromIndex, 1);
      copy.splice(toIndex, 0, item);
      return copy;
    });
  };

  const toggleProxyEnabledType = (type: ProxyType) => {
    setProxyEnabledTypes((current) => ({
      ...current,
      [type]: !current[type],
    }));
  };

  const handleCopyConfig = useCallback(() => {
    if (!configString) return;
    navigator.clipboard.writeText(configString);
    setConfigCopied(true);
    setTimeout(() => setConfigCopied(false), 2000);
  }, [configString]);

  const handleCopyProxy = useCallback(() => {
    if (!proxyUrl) return;
    navigator.clipboard.writeText(proxyUrl);
    setProxyCopied(true);
    setTimeout(() => setProxyCopied(false), 2000);
  }, [proxyUrl]);

  const handleCopyAiometadataPattern = useCallback((type: AiometadataPatternType) => {
    const value = aiometadataPatterns[type];
    if (!value) return;
    navigator.clipboard.writeText(value);
    setAiometadataCopiedType(type);
    setTimeout(() => setAiometadataCopiedType((current) => (current === type ? null : current)), 2000);
  }, [aiometadataPatterns]);

  const handleExportConfig = (includeKeys: boolean) => {
    const payload: Record<string, unknown> = {
      version: EXPORT_CONFIG_VERSION,
      createdAt: new Date().toISOString(),
      previewType,
      mediaId,
      lang,
      posterImageText,
      backdropImageText,
      posterRatingPreferences,
      backdropRatingPreferences,
      thumbnailRatingPreferences,
      logoRatingPreferences,
      posterStreamBadges,
      backdropStreamBadges,
      qualityBadgesSide,
      posterQualityBadgesPosition,
      posterQualityBadgesStyle,
      backdropQualityBadgesStyle,
      posterRatingStyle,
      backdropRatingStyle,
      logoRatingStyle,
      posterRatingsLayout,
      posterRatingsMaxPerSide,
      backdropRatingsLayout,
      thumbnailRatingsLayout,
      proxyManifestUrl,
      proxyEnabledTypes,
      translateMeta: proxyTranslateMeta,
    };

    if (includeKeys) {
      payload.tmdbKey = tmdbKey;
      payload.mdblistKey = mdblistKey;
      payload.simklClientId = simklClientId;
    }

    const filename = includeKeys ? 'erdb-config-with-keys.json' : 'erdb-config.json';
    downloadJsonFile(payload, filename);
    setExportStatus(includeKeys ? 'with' : 'without');
    setTimeout(() => setExportStatus('idle'), 2000);
  };

  const applyImportedConfig = (payload: Record<string, unknown>) => {
    if (typeof payload.tmdbKey === 'string') {
      setTmdbKey(payload.tmdbKey);
    }
    if (typeof payload.mdblistKey === 'string') {
      setMdblistKey(payload.mdblistKey);
    }
    if (typeof payload.simklClientId === 'string') {
      setSimklClientId(payload.simklClientId);
    }
    if (typeof payload.mediaId === 'string') {
      setMediaId(payload.mediaId);
    }
    if (typeof payload.lang === 'string') {
      setLang(payload.lang);
    }
    if (typeof payload.previewType === 'string' && isPreviewType(payload.previewType)) {
      setPreviewType(payload.previewType);
    }
    if (typeof payload.posterImageText === 'string' && isImageText(payload.posterImageText)) {
      setPosterImageText(payload.posterImageText);
    }
    if (typeof payload.backdropImageText === 'string' && isImageText(payload.backdropImageText)) {
      setBackdropImageText(payload.backdropImageText);
    }
    if (typeof payload.posterStreamBadges === 'string' && isStreamBadgesSetting(payload.posterStreamBadges)) {
      setPosterStreamBadges(payload.posterStreamBadges);
    }
    if (typeof payload.backdropStreamBadges === 'string' && isStreamBadgesSetting(payload.backdropStreamBadges)) {
      setBackdropStreamBadges(payload.backdropStreamBadges);
    }
    if (typeof payload.qualityBadgesSide === 'string' && isQualityBadgesSide(payload.qualityBadgesSide)) {
      setQualityBadgesSide(payload.qualityBadgesSide);
    }
    if (
      typeof payload.posterQualityBadgesPosition === 'string' &&
      isPosterQualityBadgesPosition(payload.posterQualityBadgesPosition)
    ) {
      setPosterQualityBadgesPosition(payload.posterQualityBadgesPosition);
    }
    if (typeof payload.posterQualityBadgesStyle === 'string' && isRatingStyle(payload.posterQualityBadgesStyle)) {
      setPosterQualityBadgesStyle(payload.posterQualityBadgesStyle);
    }
    if (typeof payload.backdropQualityBadgesStyle === 'string' && isRatingStyle(payload.backdropQualityBadgesStyle)) {
      setBackdropQualityBadgesStyle(payload.backdropQualityBadgesStyle);
    }
    if (typeof payload.posterRatingStyle === 'string' && isRatingStyle(payload.posterRatingStyle)) {
      setPosterRatingStyle(payload.posterRatingStyle);
    }
    if (typeof payload.backdropRatingStyle === 'string' && isRatingStyle(payload.backdropRatingStyle)) {
      setBackdropRatingStyle(payload.backdropRatingStyle);
    }
    if (typeof payload.logoRatingStyle === 'string' && isRatingStyle(payload.logoRatingStyle)) {
      setLogoRatingStyle(payload.logoRatingStyle);
    }
    if (typeof payload.posterRatingsLayout === 'string' && isPosterRatingLayout(payload.posterRatingsLayout)) {
      setPosterRatingsLayout(payload.posterRatingsLayout);
    }
    if (typeof payload.backdropRatingsLayout === 'string' && isBackdropRatingLayout(payload.backdropRatingsLayout)) {
      setBackdropRatingsLayout(payload.backdropRatingsLayout);
    }
    if (typeof payload.thumbnailRatingsLayout === 'string' && isThumbnailRatingLayout(payload.thumbnailRatingsLayout)) {
      setThumbnailRatingsLayout(payload.thumbnailRatingsLayout);
    }
    if (typeof payload.thumbnailSize === 'string' && THUMBNAIL_SIZE_OPTIONS.some((option) => option.id === payload.thumbnailSize)) {
      setThumbnailSize(payload.thumbnailSize as ThumbnailSize);
    }

    if (payload.posterRatingsMaxPerSide === null) {
      setPosterRatingsMaxPerSide(null);
    } else if (typeof payload.posterRatingsMaxPerSide === 'number' || typeof payload.posterRatingsMaxPerSide === 'string') {
      const parsed = typeof payload.posterRatingsMaxPerSide === 'number'
        ? payload.posterRatingsMaxPerSide
        : parseInt(payload.posterRatingsMaxPerSide, 10);
      if (Number.isFinite(parsed) && parsed >= 1 && parsed <= 20) {
        setPosterRatingsMaxPerSide(parsed);
      }
    }

    const normalizeRatingArray = (value: unknown) => {
      if (!Array.isArray(value)) return null;
      const normalized = value
        .map((item) => (typeof item === 'string' ? item : null))
        .filter((item): item is RatingPreference => item !== null && isRatingProviderId(item));
      return [...new Set(normalized)];
    };

    const resolveRatingPreferences = (arrayValue: unknown, stringValue?: unknown) => {
      const fromArray = normalizeRatingArray(arrayValue);
      if (fromArray !== null) return fromArray;
      if (typeof stringValue === 'string') {
        return parseRatingPreferencesAllowEmpty(stringValue);
      }
      return null;
    };

    const posterRatings =
      resolveRatingPreferences(payload.posterRatingPreferences, payload.posterRatings) ??
      resolveRatingPreferences(null, payload.ratings);
    if (posterRatings !== null) {
      setPosterRatingRows(enabledOrderedToRows(posterRatings));
    }

    const backdropRatings =
      resolveRatingPreferences(payload.backdropRatingPreferences, payload.backdropRatings) ??
      resolveRatingPreferences(null, payload.ratings);
    if (backdropRatings !== null) {
      setBackdropRatingRows(enabledOrderedToRows(backdropRatings));
    }

    const thumbnailRatingsRaw =
      resolveRatingPreferences((payload as Record<string, unknown>).thumbnailRatingPreferences, payload.thumbnailRatings) ??
      resolveRatingPreferences(null, payload.ratings);
    if (thumbnailRatingsRaw !== null) {
      const thumbnailRatings = thumbnailRatingsRaw.filter((rating) => THUMBNAIL_SUPPORTED_RATINGS.includes(rating));
      setThumbnailRatingRows(enabledOrderedToRows(thumbnailRatings));
    }

    const logoRatings =
      resolveRatingPreferences(payload.logoRatingPreferences, payload.logoRatings) ??
      resolveRatingPreferences(null, payload.ratings);
    if (logoRatings !== null) {
      setLogoRatingRows(enabledOrderedToRows(logoRatings));
    }

    if (typeof payload.proxyManifestUrl === 'string') {
      setProxyManifestUrl(normalizeManifestUrl(payload.proxyManifestUrl, true));
    }
    if (payload.proxyEnabledTypes && typeof payload.proxyEnabledTypes === 'object') {
      const enabled = payload.proxyEnabledTypes as Record<string, unknown>;
      setProxyEnabledTypes((current) => ({
        poster: typeof enabled.poster === 'boolean' ? enabled.poster : current.poster,
        backdrop: typeof enabled.backdrop === 'boolean' ? enabled.backdrop : current.backdrop,
        logo: typeof enabled.logo === 'boolean' ? enabled.logo : current.logo,
        thumbnail: typeof enabled.thumbnail === 'boolean' ? enabled.thumbnail : current.thumbnail,
      }));
    }
    if (typeof payload.translateMeta === 'boolean') {
      setProxyTranslateMeta(payload.translateMeta);
    }

    setImportStatus('success');
    setImportMessage('Config loaded.');
  };

  const handleImportFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    event.target.value = '';
    setImportStatus('idle');
    setImportMessage('');

    let payload: Record<string, unknown> | null = null;
    try {
      const raw = (await file.text()).trim();
      if (raw.startsWith('{')) {
        payload = JSON.parse(raw);
      } else if (raw) {
        const decoded = decodeBase64Url(raw);
        payload = JSON.parse(decoded);
      }
    } catch {
      payload = null;
    }

    if (!payload || typeof payload !== 'object') {
      setImportStatus('error');
      setImportMessage('Invalid config file.');
      return;
    }

    applyImportedConfig(payload);
  };

  const canGenerateConfig = Boolean(configString);
  const normalizedProxyManifestUrl = normalizeManifestUrl(proxyManifestUrl);
  const canGenerateProxy = Boolean(
    normalizedProxyManifestUrl &&
    !isBareHttpUrl(normalizedProxyManifestUrl) &&
    tmdbKey.trim() &&
    mdblistKey.trim()
  );
  const isConfigStringVisible = canGenerateConfig && showConfigString;
  const isProxyUrlVisible = Boolean(proxyUrl) && showProxyUrl;
  const proxyDisplayValue = proxyUrl || `${baseUrl || 'https://erdb.example.com'}/proxy/{config}/manifest.json`;
  const displayedConfigString =
    canGenerateConfig && !isConfigStringVisible ? maskSensitiveText(configString) : configString;
  const displayedProxyUrl = isProxyUrlVisible ? proxyDisplayValue : maskSensitiveText(proxyDisplayValue);
  const activeRatingStyle =
    previewType === 'poster'
      ? posterRatingStyle
      : previewType === 'backdrop' || previewType === 'thumbnail'
        ? backdropRatingStyle
        : logoRatingStyle;
  const activeImageText =
    previewType === 'backdrop' || previewType === 'thumbnail' ? backdropImageText : posterImageText;
  const styleLabel =
    previewType === 'poster'
      ? 'Poster Ratings Style'
      : previewType === 'backdrop'
        ? 'Backdrop Ratings Style'
        : previewType === 'thumbnail'
          ? 'Thumbnail Ratings Style'
        : 'Logo Ratings Style';
  const textLabel =
    previewType === 'backdrop' ? 'Backdrop Text' : previewType === 'thumbnail' ? 'Thumbnail Text' : 'Poster Text';
  const providersLabel =
    previewType === 'poster'
      ? 'Poster Providers'
      : previewType === 'backdrop'
      ? 'Backdrop Providers'
      : previewType === 'thumbnail'
          ? 'Thumbnail Providers'
        : 'Logo Providers';
  const ratingProviderRows =
    previewType === 'poster'
      ? posterRatingRows
      : previewType === 'backdrop'
        ? backdropRatingRows
        : previewType === 'thumbnail'
          ? thumbnailRatingRows
        : logoRatingRows;
  const visibleRatingProviderRows =
    previewType === 'thumbnail'
      ? ratingProviderRows.filter((row) => THUMBNAIL_SUPPORTED_RATINGS.includes(row.id))
      : ratingProviderRows;
  const previewNotice =
    previewType === 'thumbnail' && !EPISODE_ID_PATTERN.test(mediaId.trim())
      ? 'Movies are not supported for thumbnails.'
      : null;

  const setRatingStyleForType = (value: RatingStyle) => {
    if (previewType === 'poster') {
      setPosterRatingStyle(value);
      return;
    }
    if (previewType === 'backdrop' || previewType === 'thumbnail') {
      setBackdropRatingStyle(value);
      return;
    }
    setLogoRatingStyle(value);
  };

  const setImageTextForType = (value: 'original' | 'clean' | 'alternative') => {
    if (previewType === 'backdrop' || previewType === 'thumbnail') {
      setBackdropImageText(value);
      return;
    }
    setPosterImageText(value);
  };
  const viewProps: HomePageViewProps = {
    refs: {
      navRef,
    },
      state: {
      previewType,
      mediaId,
      lang,
      supportedLanguages,
        tmdbKey,
        mdblistKey,
        simklClientId,
      proxyManifestUrl,
      proxyEnabledTypes,
      proxyTranslateMeta,
      exportStatus,
      importStatus,
      importMessage,
      posterRatingsLayout,
      posterRatingsMaxPerSide,
      backdropRatingsLayout,
      thumbnailRatingsLayout,
      thumbnailSize,
      qualityBadgesSide,
      posterQualityBadgesPosition,
      configCopied,
      proxyCopied,
      copied,
      aiometadataCopiedType,
    },
    derived: {
      baseUrl,
    previewUrl,
    proxyUrl,
      previewNotice,
    canGenerateConfig,
      canGenerateProxy,
      isConfigStringVisible,
      isProxyUrlVisible,
      displayedConfigString,
      displayedProxyUrl,
      styleLabel,
      textLabel,
      providersLabel,
      activeRatingStyle,
      activeImageText,
      ratingProviderRows: visibleRatingProviderRows,
      shouldShowQualityBadgesPosition,
      shouldShowQualityBadgesSide,
      qualityBadgeTypeLabel,
      activeStreamBadges,
      activeQualityBadgesStyle,
      aiometadataPatterns,
    },
    actions: {
      handleAnchorClick,
      handleExportConfig,
      handleImportFile,
      handleCopyConfig,
      handleCopyProxy,
      handleCopyPrompt,
      handleCopyAiometadataPattern,
      setPreviewType,
      setMediaId,
      setLang,
        setTmdbKey,
        setMdblistKey,
        setSimklClientId,
      setPosterRatingsLayout,
      setPosterRatingsMaxPerSide,
      setBackdropRatingsLayout,
      setThumbnailRatingsLayout,
      setThumbnailSize,
      setPosterQualityBadgesPosition,
      setQualityBadgesSide,
      setRatingStyleForType,
      setImageTextForType,
      setActiveStreamBadges,
      setActiveQualityBadgesStyle,
      toggleRatingPreference,
      reorderRatingPreference,
      updateProxyManifestUrl: (value) => setProxyManifestUrl(normalizeManifestUrl(value, true)),
      toggleProxyEnabledType,
      toggleProxyTranslateMeta: () => setProxyTranslateMeta((value) => !value),
      toggleConfigStringVisibility: () => {
        if (!canGenerateConfig) return;
        setShowConfigString((value) => !value);
      },
      toggleProxyUrlVisibility: () => setShowProxyUrl((value) => !value),
    },
  };

  return <HomePageView {...viewProps} />;
}
