import type { Palette } from './types.ts';

export const PALETTES: Record<string, Palette> = {
  rood: { name: 'Rood', o: '#5a1a22', b: '#e8524f', s: '#b83a3e', h: '#ff8f80', a: '#fbe9d0', c: '#ff9fb0' },
  terracotta: { name: 'Terracotta', o: '#4a2416', b: '#cd7a52', s: '#a75a38', h: '#e7a07c', a: '#f2c9a8', c: '#e5858a' },
  gember: { name: 'Gember', o: '#4a2414', b: '#e8964a', s: '#bf6a2e', h: '#f6c48c', a: '#fbe6cc', c: '#e5858a' },
  zand: { name: 'Zand', o: '#3b2e25', b: '#b8a084', s: '#8f7860', h: '#d9c7b2', a: '#f4ede4', c: '#d98b8b' },
  mos: { name: 'Mos', o: '#1d3524', b: '#6dab5c', s: '#478244', h: '#9dd07e', a: '#ece0a0', c: '#d98b8b' },
  spookwit: { name: 'Spookwit', o: '#4a5180', b: '#f2f5ff', s: '#c8d1ef', h: '#ffffff', a: '#ffd6e5', c: '#ffb0c6' },
  hemel: { name: 'Hemel', o: '#21406b', b: '#a0d4ff', s: '#68a7e6', h: '#e8f5ff', a: '#ffe08a', c: '#ff9fb8' },
  houtskool: { name: 'Houtskool', o: '#15161c', b: '#5d5f6c', s: '#43454f', h: '#868896', a: '#a9abb8', c: '#ff8fa3', e: '#ffe27a' },
};

/** Colours that never change with the palette: eyes, leaves, hats, the robot's screen. */
export const FIXED: Record<string, string> = {
  e: '#1d1a2c',
  w: '#ffffff',
  g: '#7cc65a',
  G: '#3f8a3a',
  K: '#1f4220',
  r: '#e8454f',
  R: '#8f2234',
  y: '#ffd54f',
  Y: '#d6981f',
  m: '#ff6fae',
  t: '#6fd3ff',
  p: '#1b2742',
  q: '#7cf8ff',
  Q: '#2f8fa0',
  n: '#26242e',
  z: '#2b2a40',
  k: '#6b4226',
  v: '#f6ead2',
  V: '#d9c6a3',
  X: '#cdd1dc',
  x: '#9a9fb0',
  N: '#4f5363',
  M: '#c2407e',
  j: '#d4cfe2',
  u: '#4b4fb0',
};
