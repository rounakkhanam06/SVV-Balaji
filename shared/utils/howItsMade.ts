/**
 * "How this is made" links on products and recipes. Any http(s) page is
 * allowed; YouTube is the one host played in place, everything else opens in a
 * new tab with a label naming where it goes.
 */

const YOUTUBE_ID = /^[A-Za-z0-9_-]{11}$/;

/** True for a link the API would accept: absolute http(s). */
export function isWebLink(url: string | null | undefined): boolean {
  if (!url) return false;
  try {
    const { protocol } = new URL(url);
    return protocol === 'https:' || protocol === 'http:';
  } catch {
    return false;
  }
}

/** The 11-character video id from any common YouTube link shape, or null. */
export function youtubeVideoId(url: string | null | undefined): string | null {
  if (!isWebLink(url)) return null;
  const u = new URL(url as string);
  const host = u.hostname.replace(/^(www|m|music)\./, '');
  let id: string | null = null;
  if (host === 'youtu.be') id = u.pathname.split('/')[1] ?? null;
  else if (host === 'youtube.com' || host === 'youtube-nocookie.com') {
    if (u.pathname === '/watch') id = u.searchParams.get('v');
    else {
      const [, kind, value] = u.pathname.split('/');
      if (['embed', 'shorts', 'live', 'v'].includes(kind)) id = value ?? null;
    }
  }
  return id && YOUTUBE_ID.test(id) ? id : null;
}

/** Privacy-enhanced embed address for a YouTube link, or null for anything else. */
export function youtubeEmbedUrl(url: string | null | undefined): string | null {
  const id = youtubeVideoId(url);
  return id ? `https://www.youtube-nocookie.com/embed/${id}?rel=0` : null;
}

/** "YouTube", "Instagram", ... or the bare host name, for the button label. */
export function linkSourceLabel(url: string | null | undefined): string {
  if (!isWebLink(url)) return '';
  const host = new URL(url as string).hostname.replace(/^(www|m)\./, '');
  const known: Record<string, string> = {
    'youtube.com': 'YouTube',
    'youtu.be': 'YouTube',
    'instagram.com': 'Instagram',
    'facebook.com': 'Facebook',
    'fb.watch': 'Facebook',
    'x.com': 'X',
    'twitter.com': 'X',
    'vimeo.com': 'Vimeo',
  };
  return known[host] ?? host;
}
