export type Point = { x: number; y: number };
export type Bounds = { x: number; y: number; width: number; height: number };
export type Camera = { x: number; y: number; zoom: number };
export const MAX_MAP_ZOOM = 16;

// The pinned world SVG uses relative move/line pairs and close commands only.
// A close resets the current point before the following relative move.
export function parseRings(path: string): Point[][] {
  const tokens = path.match(/[mz]|[-+]?(?:\d*\.)?\d+(?:e[-+]?\d+)?/gi) ?? [];
  const rings: Point[][] = [];
  let x = 0,
    y = 0;
  let ring: Point[] = [];
  for (let i = 0; i < tokens.length;) {
    const token = tokens[i++];
    if (token === 'm') {
      ring = [];
      rings.push(ring);
    } else if (token.toLowerCase() === 'z') {
      if (ring.length) ({ x, y } = ring[0]);
    } else {
      x += Number(token);
      y += Number(tokens[i++]);
      ring.push({ x, y });
    }
  }
  return rings.filter((points) => points.length > 2);
}

export function boundsOf(points: Point[]): Bounds {
  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity;
  for (const { x, y } of points) {
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
  }
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

export function ringArea(points: Point[]) {
  return (
    Math.abs(
      points.reduce((sum, p, i) => {
        const q = points[(i + 1) % points.length];
        return sum + p.x * q.y - q.x * p.y;
      }, 0),
    ) / 2
  );
}

export function pacificRings(rings: Point[][], worldWidth: number) {
  return rings.map((ring) => {
    const box = boundsOf(ring);
    const offset = box.x + box.width / 2 < worldWidth / 2 ? worldWidth : 0;
    return ring.map((p) => ({ x: p.x + offset, y: p.y }));
  });
}

export function ringsPath(rings: Point[][]) {
  return rings
    .map(
      (ring) =>
        `M${ring.map((p) => `${p.x.toFixed(3)},${p.y.toFixed(3)}`).join('L')}Z`,
    )
    .join('');
}

export function fitBounds(
  bounds: Bounds,
  width: number,
  height: number,
): Bounds {
  const scale = Math.max(bounds.width / width, bounds.height / height) * 1.12;
  return {
    x: bounds.x + bounds.width / 2 - (width * scale) / 2,
    y: bounds.y + bounds.height / 2 - (height * scale) / 2,
    width: width * scale,
    height: height * scale,
  };
}

export function zoomAt(
  camera: Camera,
  base: Bounds,
  anchor: Point,
  nextZoom: number,
): Camera {
  const zoom = Math.max(1, Math.min(MAX_MAP_ZOOM, nextZoom));
  return {
    x: camera.x + (anchor.x - 0.5) * base.width * (1 / camera.zoom - 1 / zoom),
    y: camera.y + (anchor.y - 0.5) * base.height * (1 / camera.zoom - 1 / zoom),
    zoom,
  };
}

export type MapMarker = Point & { codes: string[] };
// Clusters are screen-space controls, not invisible expanded country polygons.
export function clusterMarkers(
  markers: MapMarker[],
  scale: number,
): MapMarker[] {
  const groups: MapMarker[][] = [];
  for (const marker of markers) {
    const touching = groups.filter((group) =>
      group.some(
        (p) => Math.hypot(p.x - marker.x, p.y - marker.y) * scale < 32,
      ),
    );
    const merged = [marker, ...touching.flat()];
    for (const group of touching) groups.splice(groups.indexOf(group), 1);
    groups.push(merged);
  }
  return groups.map((group) => ({
    x: group.reduce((sum, p) => sum + p.x, 0) / group.length,
    y: group.reduce((sum, p) => sum + p.y, 0) / group.length,
    codes: [...new Set(group.flatMap((p) => p.codes))],
  }));
}
