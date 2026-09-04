'use client';
/* oxlint-disable jsx-a11y/prefer-tag-over-role -- SVG controls cannot contain HTML buttons; both keyboard and pointer input are handled. */

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import {
  allCountryCodes,
  continentOptions,
  getCountryContinent,
  getCountryName,
  microCountryCodes,
  type ContinentCode,
} from '@/lib/countries';
import {
  boundsOf,
  clusterMarkers,
  fitBounds,
  pacificRings,
  parseRings,
  ringArea,
  ringsPath,
  zoomAt,
  MAX_MAP_ZOOM,
  type Camera,
  type MapMarker,
  type Point,
} from '@/lib/map-geometry';

export type MapData = {
  viewBox: string;
  locations: Array<{ id: string; name: string; path: string }>;
};
const countrySet = new Set(allCountryCodes);
type Props = {
  map: MapData | null;
  targetCode?: string;
  lastGuess?: string | null;
  feedback?: 'idle' | 'wrong' | 'correct';
  hintLevel?: number;
  hintContinent?: ContinentCode;
  focusContinent?: ContinentCode;
  zoom: number;
  resetKey?: number;
  playable: boolean;
  onZoomChange?: (zoom: number) => void;
  onSelect?: (code: string) => void;
};

export function MapBoard({
  map,
  targetCode,
  lastGuess,
  feedback,
  hintLevel,
  hintContinent,
  focusContinent,
  zoom,
  resetKey = 0,
  playable,
  onZoomChange,
  onSelect,
}: Props) {
  const viewport = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 1000, height: 650 });
  const [camera, setCamera] = useState<Camera>({ x: 505, y: 333, zoom: 1 });
  const cameraRef = useRef(camera);
  const [panning, setPanning] = useState(false);
  const [notice, setNotice] = useState({ code: targetCode, text: '' });
  const beforeHint = useRef<Camera | null>(null);
  const pointers = useRef(new Map<number, Point>());
  const gesture = useRef<{
    start: Point;
    camera: Camera;
    distance: number;
    moved: boolean;
  } | null>(null);

  const shapes = useMemo(
    () =>
      (map?.locations ?? [])
        .filter(
          (location) =>
            !focusContinent ||
            (countrySet.has(location.id.toUpperCase()) &&
              getCountryContinent(location.id.toUpperCase()) ===
                focusContinent),
        )
        .map((location) => {
          const code = location.id.toUpperCase();
          let rings = parseRings(location.path);
          if (focusContinent === 'OC')
            rings = pacificRings(rings, Number(map!.viewBox.split(' ')[2]));
          const sorted = rings
            .map((points) => ({ points, area: ringArea(points) }))
            .sort((a, b) => b.area - a.area);
          const principal = sorted[0]?.points ?? [];
          const primaryBox = boundsOf(principal);
          const fitPoints = microCountryCodes.has(code)
            ? rings.flat()
            : sorted
                .filter((r) => r.area >= (sorted[0]?.area ?? 0) * 0.02)
                .flatMap((r) => r.points);
          return {
            code,
            path: focusContinent === 'OC' ? ringsPath(rings) : location.path,
            box: boundsOf(fitPoints),
            primaryBox,
            anchor: {
              x: primaryBox.x + primaryBox.width / 2,
              y: primaryBox.y + primaryBox.height / 2,
            },
          };
        }),
    [map, focusContinent],
  );

  const extent = useMemo(() => {
    if (!focusContinent || !shapes.length)
      return { x: 0, y: 0, width: 1010, height: 666 };
    // Fit European Russia's neighbours, not Russia's entire Asian landmass.
    const boxes = shapes
      .filter((s) => !(focusContinent === 'EU' && s.code === 'RU'))
      .map((s) => s.box);
    return boundsOf(
      boxes.flatMap((b) => [
        { x: b.x, y: b.y },
        { x: b.x + b.width, y: b.y + b.height },
      ]),
    );
  }, [shapes, focusContinent]);
  const base = useMemo(
    () => fitBounds(extent, size.width, size.height),
    [extent, size],
  );
  const baseRef = useRef(base);
  useLayoutEffect(() => {
    baseRef.current = base;
  }, [base]);

  const commit = useCallback(
    (next: Camera) => {
      const b = baseRef.current;
      const width = b.width / next.zoom,
        height = b.height / next.zoom;
      const safe = {
        zoom: Math.max(1, Math.min(MAX_MAP_ZOOM, next.zoom)),
        x: Math.max(
          b.x - width * 0.2,
          Math.min(b.x + b.width + width * 0.2, next.x),
        ),
        y: Math.max(
          b.y - height * 0.2,
          Math.min(b.y + b.height + height * 0.2, next.y),
        ),
      };
      cameraRef.current = safe;
      setCamera(safe);
      onZoomChange?.(safe.zoom);
    },
    [onZoomChange],
  );

  useLayoutEffect(() => {
    const element = viewport.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      if (width > 0 && height > 0) setSize({ width, height });
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useLayoutEffect(() => {
    const b = baseRef.current;
    beforeHint.current = null;
    commit({ x: b.x + b.width / 2, y: b.y + b.height / 2, zoom: 1 });
  }, [extent, resetKey, commit]);

  useEffect(() => {
    if (Math.abs(zoom - cameraRef.current.zoom) > 0.001)
      commit({ ...cameraRef.current, zoom });
  }, [zoom, commit]);

  const atClient = useCallback((point: Point) => {
    const rect = viewport.current!.getBoundingClientRect();
    return {
      x: (point.x - rect.left) / rect.width,
      y: (point.y - rect.top) / rect.height,
    };
  }, []);

  useEffect(() => {
    const element = viewport.current;
    if (!element || !playable) return;
    const wheel = (event: WheelEvent) => {
      event.preventDefault();
      const delta =
        event.deltaY *
        (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? size.height : 1);
      commit(
        zoomAt(
          cameraRef.current,
          baseRef.current,
          atClient({ x: event.clientX, y: event.clientY }),
          cameraRef.current.zoom * Math.exp(-delta * 0.0015),
        ),
      );
    };
    element.addEventListener('wheel', wheel, { passive: false });
    return () => element.removeEventListener('wheel', wheel);
  }, [playable, size.height, atClient, commit]);

  useEffect(() => {
    if (beforeHint.current) {
      commit(beforeHint.current);
      beforeHint.current = null;
    }
  }, [targetCode, commit]);

  useEffect(() => {
    if (hintLevel !== 2 || !targetCode || !playable) return;
    const shape = shapes.find((s) => s.code === targetCode);
    if (!shape) return;
    beforeHint.current = cameraRef.current;
    const b = baseRef.current;
    const box = shape.primaryBox;
    const focusZoom = Math.min(
      MAX_MAP_ZOOM,
      Math.max(
        2,
        Math.min(
          b.width / Math.max(box.width * 2.5, 1),
          b.height / Math.max(box.height * 2.5, 1),
        ),
      ),
    );
    commit({ ...shape.anchor, zoom: focusZoom });
  }, [hintLevel, targetCode, playable, shapes, commit]);

  const scale = (size.width * camera.zoom) / base.width;
  const markers = useMemo(
    () =>
      clusterMarkers(
        shapes
          .filter(
            (s) =>
              countrySet.has(s.code) &&
              (microCountryCodes.has(s.code) ||
                Math.max(s.primaryBox.width, s.primaryBox.height) * scale < 24),
          )
          .map((s) => ({ ...s.anchor, codes: [s.code] })),
        scale,
      ),
    [shapes, scale],
  );
  const markersRef = useRef(markers);
  useLayoutEffect(() => {
    markersRef.current = markers;
  }, [markers]);

  function expandMarker(marker: MapMarker) {
    const nextZoom = Math.min(MAX_MAP_ZOOM, cameraRef.current.zoom * 2.5);
    commit({ x: marker.x, y: marker.y, zoom: nextZoom });
    setNotice({
      code: targetCode,
      text: '가까운 나라들을 확대했어요. 원하는 표시를 다시 눌러 주세요.',
    });
  }

  function pick(point: Point, touch: boolean) {
    if (feedback === 'correct') return;
    const anchor = atClient(point),
      c = cameraRef.current,
      b = baseRef.current;
    const world = {
      x: c.x + ((anchor.x - 0.5) * b.width) / c.zoom,
      y: c.y + ((anchor.y - 0.5) * b.height) / c.zoom,
    };
    const pxScale = (size.width * c.zoom) / b.width;
    const nearby = markersRef.current
      .map((marker) => ({
        marker,
        distance: Math.hypot(world.x - marker.x, world.y - marker.y) * pxScale,
      }))
      .filter((m) => m.distance < (touch ? 24 : 15))
      .sort((a, z) => a.distance - z.distance);
    const nearest = nearby[0];
    if (nearest) {
      if (nearest.marker.codes.length > 1) {
        expandMarker(nearest.marker);
        return;
      }
      // An uncertain touch near a pin magnifies instead of stealing its neighbour's answer.
      if (touch && nearest.distance > 11 && c.zoom < MAX_MAP_ZOOM) {
        expandMarker(nearest.marker);
        return;
      }
      onSelect?.(nearest.marker.codes[0]);
      return;
    }
    const country = document
      .elementsFromPoint(point.x, point.y)
      .find((element) => element.hasAttribute('data-country-code'));
    const code = country?.getAttribute('data-country-code');
    if (code && countrySet.has(code)) onSelect?.(code);
  }

  function start(event: ReactPointerEvent<HTMLDivElement>) {
    if (!playable || (event.pointerType === 'mouse' && event.button !== 0))
      return;
    event.currentTarget.setPointerCapture(event.pointerId);
    pointers.current.set(event.pointerId, {
      x: event.clientX,
      y: event.clientY,
    });
    const points = [...pointers.current.values()];
    if (points.length === 1)
      gesture.current = {
        start: points[0],
        camera: cameraRef.current,
        distance: 0,
        moved: false,
      };
    else {
      const [a, b] = points;
      gesture.current = {
        start: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 },
        camera: cameraRef.current,
        distance: Math.hypot(a.x - b.x, a.y - b.y),
        moved: true,
      };
    }
  }

  function move(event: ReactPointerEvent<HTMLDivElement>) {
    if (!pointers.current.has(event.pointerId) || !gesture.current) return;
    event.preventDefault();
    pointers.current.set(event.pointerId, {
      x: event.clientX,
      y: event.clientY,
    });
    const points = [...pointers.current.values()],
      g = gesture.current,
      b = baseRef.current;
    if (points.length >= 2 && g.distance > 0) {
      const [a, z] = points;
      const midpoint = { x: (a.x + z.x) / 2, y: (a.y + z.y) / 2 };
      const next = zoomAt(
        g.camera,
        b,
        atClient(g.start),
        (g.camera.zoom * Math.hypot(a.x - z.x, a.y - z.y)) / g.distance,
      );
      next.x -= ((midpoint.x - g.start.x) * b.width) / size.width / next.zoom;
      next.y -= ((midpoint.y - g.start.y) * b.height) / size.height / next.zoom;
      commit(next);
      g.moved = true;
      setPanning(true);
      return;
    }
    const dx = event.clientX - g.start.x,
      dy = event.clientY - g.start.y;
    if (
      !g.moved &&
      Math.hypot(dx, dy) < (event.pointerType === 'touch' ? 8 : 4)
    )
      return;
    g.moved = true;
    setPanning(true);
    commit({
      ...g.camera,
      x: g.camera.x - (dx * b.width) / size.width / g.camera.zoom,
      y: g.camera.y - (dy * b.height) / size.height / g.camera.zoom,
    });
  }

  function end(event: ReactPointerEvent<HTMLDivElement>) {
    if (!pointers.current.has(event.pointerId)) return;
    const tap =
      event.type === 'pointerup' &&
      pointers.current.size === 1 &&
      !gesture.current?.moved;
    pointers.current.delete(event.pointerId);
    if (event.currentTarget.hasPointerCapture(event.pointerId))
      event.currentTarget.releasePointerCapture(event.pointerId);
    if (tap)
      pick(
        { x: event.clientX, y: event.clientY },
        event.pointerType === 'touch',
      );
    const remaining = [...pointers.current.values()][0];
    gesture.current = remaining
      ? {
          start: remaining,
          camera: cameraRef.current,
          distance: 0,
          moved: true,
        }
      : null;
    if (!remaining) setPanning(false);
  }

  const viewWidth = base.width / camera.zoom,
    viewHeight = base.height / camera.zoom;
  return (
    <div
      ref={viewport}
      className={`map-scroll ${playable ? 'is-interactive' : ''} ${panning ? 'is-panning' : ''} ${hintContinent ? 'has-continent-hint' : ''} ${focusContinent ? 'is-continent-view' : ''}`}
      aria-busy={!map}
      onPointerDown={start}
      onPointerMove={move}
      onPointerUp={end}
      onPointerCancel={end}
      onLostPointerCapture={end}
    >
      {!map && <div className="map-loading">지도 펼치는 중…</div>}
      <svg
        className="world-map"
        viewBox={`${camera.x - viewWidth / 2} ${camera.y - viewHeight / 2} ${viewWidth} ${viewHeight}`}
        aria-label={
          focusContinent
            ? `${continentOptions.find((c) => c.code === focusContinent)?.name} 전용 지도`
            : '세계지도'
        }
      >
        {shapes.map((shape, index) => (
          <path
            key={shape.code}
            d={shape.path}
            data-country-code={shape.code}
            role={playable ? 'button' : undefined}
            tabIndex={playable && countrySet.has(shape.code) ? 0 : -1}
            aria-label={playable ? getCountryName(shape.code) : undefined}
            aria-disabled={
              !countrySet.has(shape.code) || feedback === 'correct'
            }
            onClick={(event) => {
              if (event.detail === 0 && playable && countrySet.has(shape.code))
                onSelect?.(shape.code);
            }}
            onKeyDown={(event) => {
              if (
                (event.key === 'Enter' || event.key === ' ') &&
                playable &&
                countrySet.has(shape.code)
              ) {
                event.preventDefault();
                onSelect?.(shape.code);
              }
            }}
            className={`map-country ${!countrySet.has(shape.code) ? 'is-territory' : ''} ${!playable && index % 7 === 0 ? 'is-preview' : ''} ${hintContinent && getCountryContinent(shape.code) === hintContinent ? 'is-continent-hint' : ''} ${feedback === 'correct' && shape.code === targetCode ? 'is-correct' : ''} ${feedback === 'wrong' && shape.code === lastGuess ? 'is-wrong' : ''} ${hintLevel === 2 && shape.code === targetCode ? 'is-hint' : ''}`}
          />
        ))}
        {playable &&
          markers.map((marker) => {
            const cluster = marker.codes.length > 1;
            const highlighted =
              marker.codes.includes(targetCode ?? '') &&
              (hintLevel === 2 || feedback === 'correct');
            return (
              <g
                key={marker.codes.join('-')}
                transform={`translate(${marker.x} ${marker.y})`}
                className={`map-pin ${cluster ? 'is-cluster' : ''} ${highlighted ? 'is-highlighted' : ''} ${feedback === 'wrong' && marker.codes.includes(lastGuess ?? '') ? 'is-wrong' : ''}`}
                data-marker-codes={marker.codes.join(',')}
                role="button"
                tabIndex={0}
                aria-label={
                  cluster
                    ? `작은 나라 ${marker.codes.length}개 모인 곳 확대`
                    : `${getCountryName(marker.codes[0])} 위치 표시`
                }
                onClick={(event) => {
                  if (event.detail === 0) {
                    if (cluster) expandMarker(marker);
                    else onSelect?.(marker.codes[0]);
                  }
                }}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    if (cluster) expandMarker(marker);
                    else onSelect?.(marker.codes[0]);
                  }
                }}
              >
                <circle r={(cluster ? 14 : 10) / scale} />
                {cluster ? (
                  <text
                    textAnchor="middle"
                    dominantBaseline="central"
                    fontSize={12 / scale}
                  >
                    {marker.codes.length}
                  </text>
                ) : (
                  <circle className="pin-dot" r={3 / scale} />
                )}
              </g>
            );
          })}
      </svg>
      {notice.code === targetCode && notice.text && (
        <output className="map-action-notice">{notice.text}</output>
      )}
    </div>
  );
}
