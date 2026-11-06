/** What the user seems to be doing, judged only by which app is in front. */
export type Context = 'code' | 'muziek' | 'video' | 'game';

export interface FrontApp {
  bundleId: string;
  name: string;
}

// Matched against "<bundle id> <app name>", so either one can identify the app.
const RULES: [RegExp, Context][] = [
  [/vscode|vscodium|antigravity|xcode|com\.apple\.terminal|iterm|tabby|\bzed\b|cursor|jetbrains|sublime|nova|warp|ghostty|kitty|alacritty|wezterm/i, 'code'],
  [/spotify|com\.apple\.music|tidal|deezer|soundcloud/i, 'muziek'],
  [/com\.apple\.tv|quicktime|stremio|nuvio|videolan|vlc|iina|infuse|netflix|plex|\bmpv\b/i, 'video'],
  [/steam|valvesoftware|epicgames|\bgog\b|minecraft|com\.apple\.games|battle\.net/i, 'game'],
];

export function contextFor(app: FrontApp | null): Context | null {
  if (!app) return null;
  const text = `${app.bundleId} ${app.name}`;
  return RULES.find(([pattern]) => pattern.test(text))?.[1] ?? null;
}

/** The item the buddy picks up for each context (see sprites/items.ts). */
export const ITEM_FOR: Record<Context, string> = {
  code: 'laptop',
  muziek: 'koptelefoon',
  video: 'popcorn',
  game: 'controller',
};
