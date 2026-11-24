import { Component, type ReactNode } from 'react';
import { Button, Result } from 'antd';

/**
 * After a new deploy the old page chunks are gone, so an open tab that navigates
 * fails to load the next screen. Without a boundary React unmounted the whole
 * app and left a white page until a manual refresh. Now: a chunk failure reloads
 * the page once (picking up the new build); any other render error shows a
 * message inside the layout, and changing page clears it.
 */
const RELOAD_KEY = 'svv-chunk-reload-at';

export function isChunkLoadError(error: unknown): boolean {
  const msg = error instanceof Error ? `${error.name} ${error.message}` : String(error);
  return /Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module|ChunkLoadError|Loading chunk .* failed|Unable to preload CSS/i.test(msg);
}

/** Reload at most once a minute, so a genuinely missing file cannot loop. */
export function reloadForNewBuild(): boolean {
  try {
    const last = Number(sessionStorage.getItem(RELOAD_KEY) ?? 0);
    if (Date.now() - last < 60_000) return false;
    sessionStorage.setItem(RELOAD_KEY, String(Date.now()));
  } catch {
    /* storage blocked - reload anyway */
  }
  window.location.reload();
  return true;
}

interface Props {
  /** Changing this (the route path) clears a shown error. */
  resetKey: string;
  children: ReactNode;
}

export class PageErrorBoundary extends Component<Props, { error: unknown }> {
  state: { error: unknown } = { error: null };

  static getDerivedStateFromError(error: unknown) {
    return { error };
  }

  componentDidCatch(error: unknown) {
    if (isChunkLoadError(error)) reloadForNewBuild();
    else console.error(error);
  }

  componentDidUpdate(prev: Props) {
    if (prev.resetKey !== this.props.resetKey && this.state.error) this.setState({ error: null });
  }

  render() {
    if (!this.state.error) return this.props.children;
    const chunk = isChunkLoadError(this.state.error);
    return (
      <Result
        status={chunk ? 'info' : 'warning'}
        title={chunk ? 'A new version is available' : 'This page could not be shown'}
        subTitle={chunk ? 'Reloading to get the latest version…' : 'Something went wrong on this screen. Other pages still work.'}
        extra={
          <Button type="primary" onClick={() => window.location.reload()}>
            Reload
          </Button>
        }
      />
    );
  }
}
