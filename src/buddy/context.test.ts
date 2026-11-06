import { describe, expect, it } from 'vitest';
import { ITEM_FOR, contextFor } from './context.ts';

describe('contextFor', () => {
  it('recognises editors, music, video and games by bundle id or name', () => {
    expect(contextFor({ bundleId: 'com.microsoft.VSCode', name: 'Code' })).toBe('code');
    expect(contextFor({ bundleId: 'com.apple.Terminal', name: 'Terminal' })).toBe('code');
    expect(contextFor({ bundleId: 'com.example.ide', name: 'Antigravity' })).toBe('code');
    expect(contextFor({ bundleId: 'com.spotify.client', name: 'Spotify' })).toBe('muziek');
    expect(contextFor({ bundleId: 'com.apple.Music', name: 'Muziek' })).toBe('muziek');
    expect(contextFor({ bundleId: 'com.apple.TV', name: 'TV' })).toBe('video');
    expect(contextFor({ bundleId: 'com.stremio.stremio-shell-macos', name: 'Stremio' })).toBe('video');
    expect(contextFor({ bundleId: 'com.valvesoftware.steam', name: 'Steam' })).toBe('game');
  });

  it('leaves other apps alone', () => {
    expect(contextFor({ bundleId: 'com.apple.Safari', name: 'Safari' })).toBeNull();
    expect(contextFor({ bundleId: 'md.obsidian', name: 'Obsidian' })).toBeNull();
    expect(contextFor(null)).toBeNull();
  });

  it('has an item for every context', () => {
    expect(Object.keys(ITEM_FOR).sort()).toEqual(['code', 'game', 'muziek', 'video']);
  });
});
