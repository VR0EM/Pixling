import { invoke, isTauri } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { getCurrentWebview } from '@tauri-apps/api/webview';

/** The saved look; mirrors `Config` in src-tauri/src/config.rs. */
export interface Config {
  species: string;
  palette: string;
  accessory: string;
  scale: number;
  watchApps: boolean;
  climbWindows: boolean;
  character: string;
  metOn: string | null;
  watchSystem: boolean;
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
  characters: { id: string; name: string }[];
}

export const DEFAULT_CONFIG: Config = {
  species: 'robot',
  palette: 'sky',
  accessory: 'none',
  scale: 3,
  watchApps: true,
  climbWindows: true,
  character: 'sweet',
  metOn: null,
  watchSystem: true,
  water: true,
  breaks: true,
  focusMinutes: 25,
  breakMinutes: 5,
};

/** False when the page runs in a normal browser (`npm run dev`), which is handy while working on the art. */
export const inApp = isTauri();

let browserCursor: { x: number; y: number } | null = null;
if (!inApp && typeof window !== 'undefined') {
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

/**
 * Where the cursor is, in overlay pixels, and whether the user is dragging something (like a file).
 * Works even while the overlay lets clicks through.
 */
export async function cursor(): Promise<{ x: number; y: number; dragging: boolean } | null> {
  if (!inApp) return browserCursor ? { ...browserCursor, dragging: false } : null;
  const position = await invoke<[number, number, boolean] | null>('cursor');
  return position ? { x: position[0], y: position[1], dragging: position[2] } : null;
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

export interface Note {
  id: number;
  text: string;
  done: boolean;
}

export interface SystemInfo {
  battery: number | null;
  charging: boolean;
  busy: boolean;
}

let browserNotes: Note[] = [];

export async function getNotes(): Promise<Note[]> {
  return inApp ? invoke<Note[]>('get_notes') : [...browserNotes];
}

export async function setNotes(list: Note[]): Promise<void> {
  if (inApp) await invoke('set_notes', { list });
  else browserNotes = [...list];
}

export async function openNotes(): Promise<void> {
  if (inApp) await invoke('open_notes');
}

/** Fires with the number of open notes after they were saved. */
export function onNotesChanged(callback: (open: number) => void): void {
  if (inApp) void listen<number>('notes-changed', (event) => callback(event.payload));
}

let browserDiary: unknown = { days: {} };

export async function getDiary<T>(): Promise<T> {
  return (inApp ? invoke('get_diary') : browserDiary) as Promise<T>;
}

export async function setDiary(diary: unknown): Promise<void> {
  if (inApp) await invoke('set_diary', { diary });
  else browserDiary = diary;
}

export async function openDiary(): Promise<void> {
  if (inApp) await invoke('open_diary');
}

let browserCreations: unknown[] = [];

export async function getCreations<T>(): Promise<T[]> {
  return (inApp ? invoke('get_creations') : Promise.resolve([...browserCreations])) as Promise<T[]>;
}

export async function setCreations(list: unknown[]): Promise<void> {
  if (inApp) await invoke('set_creations', { list });
  else browserCreations = [...list];
}

export function onCreationsChanged<T>(callback: (list: T[]) => void): void {
  if (inApp) void listen<T[]>('creations-changed', (event) => callback(event.payload));
}

export async function openStudio(): Promise<void> {
  if (inApp) await invoke('open_studio');
}

/** Reads a dropped or picked .json file (a shared Pixling file). */
export async function readTextFile(path: string): Promise<string> {
  if (!inApp) throw new Error('Files can only be read in the app.');
  return invoke<string>('read_text_file', { path });
}

/** Saves a file to share in Downloads and shows it in Finder; returns where it went. */
export async function exportFile(name: string, contents: string): Promise<string> {
  if (inApp) return invoke<string>('export_file', { name, contents });
  const link = Object.assign(document.createElement('a'), { download: name, href: URL.createObjectURL(new Blob([contents])) });
  link.click();
  return name;
}

export async function copyText(text: string): Promise<void> {
  if (inApp) await invoke('copy_text', { text });
  else await navigator.clipboard.writeText(text);
}

export async function systemInfo(): Promise<SystemInfo | null> {
  return inApp ? invoke<SystemInfo>('system_info') : null;
}

export function onSystem(callback: (info: SystemInfo) => void): void {
  if (inApp) void listen<SystemInfo>('system', (event) => callback(event.payload));
}

/** Files are dragged over the overlay ('over') or dropped ('drop'); x and y are in overlay pixels. */
export function onFileDrop(callback: (kind: 'over' | 'drop' | 'leave', paths: string[], x: number, y: number) => void): void {
  if (!inApp) return;
  void getCurrentWebview().onDragDropEvent((event) => {
    const p = event.payload;
    const ratio = window.devicePixelRatio || 1;
    if (p.type === 'leave') callback('leave', [], 0, 0);
    else if (p.type === 'over') callback('over', [], p.position.x / ratio, p.position.y / ratio);
    else if (p.type === 'drop') callback('drop', p.paths, p.position.x / ratio, p.position.y / ratio);
  });
}

export async function fileMenu(paths: string[]): Promise<void> {
  if (inApp) await invoke('file_menu', { paths });
}

export function onFileDone(callback: (message: string) => void): void {
  if (inApp) void listen<string>('file-done', (event) => callback(event.payload));
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
