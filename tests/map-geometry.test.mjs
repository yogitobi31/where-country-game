import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import world from '@svg-maps/world';
import { allCountryCodes } from '../lib/countries.ts';
import {
  parseRings,
  pacificRings,
  boundsOf,
  fitBounds,
  zoomAt,
  clusterMarkers,
} from '../lib/map-geometry.ts';

test('relative subpaths start from the closed ring origin', () => {
  const rings = parseRings('m 10,20 4,0 0,4 z m 20,0 2,0 0,2 z');
  assert.deepEqual(rings[1][0], { x: 30, y: 20 });
});

test('dataset only contains supported path commands and every country has geometry', () => {
  for (const location of world.locations) {
    assert.match((location.path.match(/[a-df-z]/gi) ?? []).join(''), /^[mz]+$/);
    const box = boundsOf(parseRings(location.path).flat());
    assert.ok(Number.isFinite(box.width) && box.width > 0, location.id);
  }
  for (const code of allCountryCodes)
    assert.ok(
      world.locations.some((l) => l.id === code.toLowerCase()),
      code,
    );
});

test('zoom preserves a pointer anchor in different viewport aspect ratios', () => {
  for (const [width, height] of [
    [1032, 734],
    [376, 480],
    [570, 265],
  ]) {
    const base = fitBounds(
      { x: 300, y: 170, width: 250, height: 220 },
      width,
      height,
    );
    for (const anchor of [
      { x: 0.2, y: 0.1 },
      { x: 0.85, y: 0.8 },
      { x: 0.5, y: 0.5 },
    ]) {
      const previous = { x: 450, y: 290, zoom: 1.5 };
      const next = zoomAt(previous, base, anchor, 8);
      for (const [key, dim] of [
        ['x', 'width'],
        ['y', 'height'],
      ]) {
        const before =
          previous[key] + ((anchor[key] - 0.5) * base[dim]) / previous.zoom;
        const after = next[key] + ((anchor[key] - 0.5) * base[dim]) / next.zoom;
        assert.ok(Math.abs(before - after) < 1e-9);
      }
    }
  }
});

test('Pacific islands are contiguous across the world seam', () => {
  const kiribati = world.locations.find((l) => l.id === 'ki');
  assert.ok(boundsOf(parseRings(kiribati.path).flat()).width > 900);
  assert.ok(
    boundsOf(pacificRings(parseRings(kiribati.path), 1010).flat()).width < 150,
  );
});

test('neighbouring microstates group first and separate after zooming', () => {
  const pins = [
    { x: 0, y: 0, codes: ['SM'] },
    { x: 0, y: 13, codes: ['VA'] },
  ];
  assert.equal(clusterMarkers(pins, 1).length, 1);
  assert.equal(clusterMarkers(pins, 3).length, 2);
});

test('every playable nation has an on-disk SVG flag', () => {
  for (const code of allCountryCodes)
    assert.ok(
      existsSync(
        new URL(`../public/flags/${code.toLowerCase()}.svg`, import.meta.url),
      ),
      code,
    );
});
