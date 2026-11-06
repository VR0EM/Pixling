import { invoke, isTauri } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';

/** The saved look; mirrors `Config` in src-tauri/src/config.rs. */
export interface Config {
  species: string;
  palette: string;
  accessory: string;
  scale: number;
  watchApps: boolean;
  climbWindows: boolean;
  water: boolean;
  breaks: boolean;
  focusMinutes: number;
  breakMinutes: number;
}

/** The app in front; mirrors `FrontApp` in src-tauri/src/lib.rs. */
export interface FrontApp {
  bundleId: string;
  name: string;
  pid: number;
}

/** Another app's window in overlay pixels; mirrors `WindowRect`. */
export interface WindowRect {
  id: number;
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Catalog {
  species: { id: string; name: string }[];
  palettes: { id: string; name: string }[];
  accessories: { id: string; name: string }[];
}

export const DEFAULT_CONFIG: Config = {
  species: 'robotje',
  palette: 'hemel',
  accessory: 'geen',
  scale: 3,
  watchApps: true,
  climbWindows: true,
  water: true,
  breaks: true,
  focusMinutes: 25,
  breakMinutes: 5,
};

/** False when the page runs in a normal browser (`npm run dev`), which is handy while working on the art. */
export const inApp = isTauri();

let browserCursor: { x: number; y: number } | null = null;
if (!inApp) {
  window.addEventListener('mousemove', (e) => {
    browserCursor = { x: e.clientX, y: e.clientY };
  });
}

/** Outside the app the settings only live in memory. */
let browserConfig: Config = { ...DEFAULT_CONFIG };

export async function getConfig(): Promise<Config> {
  return inApp ? invoke<Config>('get_config') : { ...browserConfig };
}

export async function setCatalog(catalog: Catalog): Promise<void> {
  if (inApp) await invoke('set_catalog', { catalog });
}

/** Where the cursor is, in overlay pixels. Works even while the overlay lets clicks through. */
export async function cursor(): Promise<{ x: number; y: number } | null> {
  if (!inApp) return browserCursor;
  const position = await invoke<[number, number] | null>('cursor');
  return position ? { x: position[0], y: position[1] } : null;
}

export async function setClickThrough(on: boolean): Promise<void> {
  if (inApp) await invoke('set_click_through', { on });
}

export function onConfigChanged(callback: (config: Config) => void): void {
  if (inApp) void listen<Config>('config-changed', (event) => callback(event.payload));
}

/** Other apps' windows, front to back (empty outside macOS for now). */
export async function windows(): Promise<WindowRect[]> {
  return inApp ? invoke<WindowRect[]>('windows') : [];
}

export async function activeApp(): Promise<FrontApp | null> {
  return inApp ? invoke<FrontApp | null>('active_app') : null;
}

export function onActiveApp(callback: (app: FrontApp) => void): void {
  if (inApp) void listen<FrontApp>('active-app', (event) => callback(event.payload));
}

/** Clicking the buddy makes Pixling active; this hands focus back to the app the user was in. */
export async function giveBackFocus(): Promise<void> {
  if (inApp) await invoke('give_back_focus');
}

/** "start" or "stop" for the focus timer, chosen in the menu's backpack. */
export function onBackpack(callback: (command: string) => void): void {
  if (inApp) void listen<string>('backpack', (event) => callback(event.payload));
}

/** Text next to the menu bar icon, or null to clear it. */
export async function setTrayTitle(title: string | null): Promise<void> {
  if (inApp) await invoke('set_tray_title', { title });
}

/** Changes some settings at once; returns the full new config. */
export async function updateConfig(patch: Partial<Config>): Promise<Config> {
  if (inApp) return invoke<Config>('update_config', { patch });
  browserConfig = { ...browserConfig, ...patch };
  return { ...browserConfig };
}

export async function openWardrobe(): Promise<void> {
  if (inApp) await invoke('open_wardrobe');
}

export async function getAutostart(): Promise<boolean> {
  return inApp ? invoke<boolean>('get_autostart') : false;
}

export async function setAutostart(on: boolean): Promise<void> {
  if (inApp) await invoke('set_autostart', { on });
}

/** Opens the menu bar menu at the cursor. */
export async function showMenu(): Promise<void> {
  if (inApp) await invoke('show_menu');
}

/** Writes to the app's log (the terminal), or the browser console outside the app. */
export function log(message: string): void {
  if (inApp) void invoke('log', { message }).catch(() => {});
  else console.warn(message);
}
