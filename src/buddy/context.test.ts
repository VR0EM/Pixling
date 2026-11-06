import { describe, expect, it } from 'vitest';
import { ITEM_FOR, contextFor } from './context.ts';

describe('contextFor', () => {
  it('recognises editors, music, video and games by bundle id or name', () => {
    expect(contextFor({ bundleId: 'com.microsoft.VSCode', name: 'Code' })).toBe('code');
    expect(contextFor({ bundleId: 'com.apple.Terminal', name: 'Terminal' })).toBe('code');
    expect(contextFor({ bundleId: 'com.example.ide', name: 'Antigravity' })).toBe('code');
    expect(contextFor({ bundleId: 'com.spotify.client', name: 'Spotify' })).toBe('music');
    expect(contextFor({ bundleId: 'com.apple.Music', name: 'Muziek' })).toBe('music');
    expect(contextFor({ bundleId: 'com.apple.TV', name: 'TV' })).toBe('video');
    expect(contextFor({ bundleId: 'com.stremio.stremio-shell-macos', name: 'Stremio' })).toBe('video');
    expect(contextFor({ bundleId: 'com.valvesoftware.steam', name: 'Steam' })).toBe('game');
  });

  it('recognises Windows programs by their file name', () => {
    expect(contextFor({ bundleId: 'code.exe', name: 'Code' })).toBe('code');
    expect(contextFor({ bundleId: 'windowsterminal.exe', name: 'WindowsTerminal' })).toBe('code');
    expect(contextFor({ bundleId: 'idea64.exe', name: 'idea64' })).toBe('code');
    expect(contextFor({ bundleId: 'spotify.exe', name: 'Spotify' })).toBe('music');
    expect(contextFor({ bundleId: 'vlc.exe', name: 'vlc' })).toBe('video');
    expect(contextFor({ bundleId: 'steam.exe', name: 'steam' })).toBe('game');
    // Explorer and the browser aren't one of them.
    expect(contextFor({ bundleId: 'explorer.exe', name: 'explorer' })).toBeNull();
    expect(contextFor({ bundleId: 'msedge.exe', name: 'msedge' })).toBeNull();
  });

  it('leaves other apps alone', () => {
    expect(contextFor({ bundleId: 'com.apple.Safari', name: 'Safari' })).toBeNull();
    expect(contextFor({ bundleId: 'md.obsidian', name: 'Obsidian' })).toBeNull();
    expect(contextFor(null)).toBeNull();
  });

  it('has an item for every context', () => {
    expect(Object.keys(ITEM_FOR).sort()).toEqual(['code', 'game', 'music', 'video']);
  });
});
