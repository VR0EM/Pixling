/** What the user seems to be doing, judged only by which app is in front. */
export type Context = 'code' | 'music' | 'video' | 'game';

export interface FrontApp {
  bundleId: string;
  name: string;
}

// Matched against "<bundle id> <app name>", so either one can identify the app. On Windows the "bundle
// id" is the program's file name, like code.exe.
const RULES: [RegExp, Context][] = [
  [
    /vscode|vscodium|antigravity|xcode|com\.apple\.terminal|iterm|tabby|\bzed\b|cursor|jetbrains|sublime|nova|warp|ghostty|kitty|alacritty|wezterm|\bcode\.exe|code - insiders|devenv\.exe|idea64|pycharm|webstorm|clion|rider|goland|rustrover|windowsterminal|\bwt\.exe|powershell|pwsh|\bcmd\.exe|notepad\+\+/i,
    'code',
  ],
  [/spotify|com\.apple\.music|tidal|deezer|soundcloud|itunes|applemusic|foobar2000|musicbee/i, 'music'],
  [/com\.apple\.tv|quicktime|stremio|nuvio|videolan|vlc|iina|infuse|netflix|plex|\bmpv\b|mpc-hc|potplayer|wmplayer|microsoft\.media\.player|video\.ui/i, 'video'],
  [/steam|valvesoftware|epicgames|\bgog\b|galaxyclient|minecraft|com\.apple\.games|battle\.net|xboxpcapp/i, 'game'],
];

export function contextFor(app: FrontApp | null): Context | null {
  if (!app) return null;
  const text = `${app.bundleId} ${app.name}`;
  return RULES.find(([pattern]) => pattern.test(text))?.[1] ?? null;
}

/** The item the buddy picks up for each context (see sprites/items.ts). */
export const ITEM_FOR: Record<Context, string> = {
  code: 'laptop',
  music: 'headphones',
  video: 'popcorn',
  game: 'controller',
};
