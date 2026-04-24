import { useEffect, useMemo, useRef, useState } from "react";

declare global {
  interface Window {
    L: any;
  }
}

export type RouteMapPoint = {
  label: string;
  latitude: number;
  longitude: number;
  kind: "start" | "stop" | "telemetry" | "incident" | "end";
};

type RouteMapProps = {
  points: RouteMapPoint[];
  title?: string;
};

export function RouteMap({ points, title = "Mapa de ruta" }: RouteMapProps) {
  const mapRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  const polylineRef = useRef<any>(null);
  const [leafletReady, setLeafletReady] = useState(Boolean(window.L));
  const [tileFailed, setTileFailed] = useState(false);

  const bounds = useMemo(() => {
    if (!points.length) return null;
    const latitudes = points.map((point) => point.latitude);
    const longitudes = points.map((point) => point.longitude);
    return {
      minLat: Math.min(...latitudes),
      maxLat: Math.max(...latitudes),
      minLng: Math.min(...longitudes),
      maxLng: Math.max(...longitudes),
    };
  }, [points]);

  useEffect(() => {
    if (window.L) {
      setLeafletReady(true);
      return;
    }

    const timer = window.setInterval(() => {
      if (window.L) {
        setLeafletReady(true);
        window.clearInterval(timer);
      }
    }, 150);

    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!leafletReady) return;
    if (!mapRef.current || !window.L || mapInstanceRef.current) return;

    const map = window.L.map(mapRef.current, {
      zoomControl: true,
      scrollWheelZoom: true,
    }).setView([19.4326, -99.1332], 5);

    window.L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 19,
    })
      .on("tileerror", () => setTileFailed(true))
      .addTo(map);

    mapInstanceRef.current = map;

    return () => {
      map.remove();
      mapInstanceRef.current = null;
      markersRef.current = [];
      polylineRef.current = null;
    };
  }, [leafletReady]);

  useEffect(() => {
    if (!leafletReady) return;
    const map = mapInstanceRef.current;
    if (!map || !window.L) return;

    markersRef.current.forEach((marker) => marker.remove());
    markersRef.current = [];
    if (polylineRef.current) {
      polylineRef.current.remove();
      polylineRef.current = null;
    }

    if (!points.length) return;

    const colors: Record<RouteMapPoint["kind"], string> = {
      start: "#22c55e",
      stop: "#38bdf8",
      telemetry: "#a855f7",
      incident: "#ef4444",
      end: "#f97316",
    };

    const leafletPoints = points.map((point, index) => {
      const marker = window.L.circleMarker([point.latitude, point.longitude], {
        radius: point.kind === "incident" ? 10 : point.kind === "start" || point.kind === "end" ? 12 : 8,
        color: "#f8fafc",
        weight: 2,
        fillColor: colors[point.kind],
        fillOpacity: 0.95,
      })
        .addTo(map)
        .bindPopup(`<strong>${index + 1}. ${point.label}</strong><br/>${point.latitude.toFixed(5)}, ${point.longitude.toFixed(5)}`);

      markersRef.current.push(marker);
      return [point.latitude, point.longitude] as [number, number];
    });

    polylineRef.current = window.L.polyline(leafletPoints, {
      color: "#7c3aed",
      weight: 4,
      opacity: 0.85,
    }).addTo(map);

    map.fitBounds(polylineRef.current.getBounds().pad(0.15), { maxZoom: 15 });
  }, [leafletReady, points]);

  if (!leafletReady) {
    return <RouteFallback points={points} title={title} subtitle="Leaflet se esta cargando para mostrar la ruta real." />;
  }

  if (tileFailed) {
    return <RouteFallback points={points} title={title} subtitle="Los tiles de OpenStreetMap no respondieron, se muestra un mapa de respaldo." />;
  }

  return (
    <div className="metric-panel">
      <span>{title}</span>
      <div className="muted" style={{ marginBottom: 12 }}>
        Mapa real con OpenStreetMap y Leaflet usando las coordenadas del viaje.
      </div>
      <div ref={mapRef} className="route-map" />
      <div className="muted" style={{ marginTop: 12 }}>
        {bounds ? `${points.length} punto(s) rastreados en la ruta.` : "Aun no hay coordenadas suficientes para dibujar la ruta."}
      </div>
    </div>
  );
}

function RouteFallback({ points, title, subtitle }: { points: RouteMapPoint[]; title: string; subtitle: string }) {
  const bounds = useMemo(() => {
    if (!points.length) return null;
    const latitudes = points.map((point) => point.latitude);
    const longitudes = points.map((point) => point.longitude);
    return {
      minLat: Math.min(...latitudes),
      maxLat: Math.max(...latitudes),
      minLng: Math.min(...longitudes),
      maxLng: Math.max(...longitudes),
    };
  }, [points]);

  const colors: Record<RouteMapPoint["kind"], string> = {
    start: "#22c55e",
    stop: "#38bdf8",
    telemetry: "#a855f7",
    incident: "#ef4444",
    end: "#f97316",
  };

  return (
    <div className="metric-panel">
      <span>{title}</span>
      <div className="muted" style={{ marginBottom: 12 }}>
        {subtitle}
      </div>
      {bounds && points.length ? (
        <svg viewBox="0 0 1000 420" role="img" aria-label="Mapa de ruta de respaldo" style={{ width: "100%", height: 420, display: "block" }}>
          <rect x="0" y="0" width="1000" height="420" rx="20" fill="#0f172a" />
          {Array.from({ length: 6 }).map((_, index) => (
            <line key={`grid-y-${index}`} x1="0" y1={index * 84} x2="1000" y2={index * 84} stroke="rgba(255,255,255,0.08)" strokeWidth="1" />
          ))}
          {Array.from({ length: 10 }).map((_, index) => (
            <line key={`grid-x-${index}`} x1={index * 100} y1="0" x2={index * 100} y2="420" stroke="rgba(255,255,255,0.08)" strokeWidth="1" />
          ))}
          {points.length > 1 ? (
            <polyline
              fill="none"
              stroke="#7c3aed"
              strokeWidth="6"
              strokeLinecap="round"
              strokeLinejoin="round"
              points={points
                .map((point) => {
                  const x = ((point.longitude - bounds.minLng) / Math.max(bounds.maxLng - bounds.minLng || 1, 1)) * 860 + 70;
                  const y = 350 - ((point.latitude - bounds.minLat) / Math.max(bounds.maxLat - bounds.minLat || 1, 1)) * 260;
                  return `${x.toFixed(1)},${y.toFixed(1)}`;
                })
                .join(" ")}
            />
          ) : null}
          {points.map((point, index) => {
            const x = ((point.longitude - bounds.minLng) / Math.max(bounds.maxLng - bounds.minLng || 1, 1)) * 860 + 70;
            const y = 350 - ((point.latitude - bounds.minLat) / Math.max(bounds.maxLat - bounds.minLat || 1, 1)) * 260;
            const radius = point.kind === "incident" ? 10 : point.kind === "start" || point.kind === "end" ? 12 : 8;
            return (
              <g key={`${point.label}-${index}`}>
                <circle cx={x} cy={y} r={radius + 6} fill="rgba(255,255,255,0.08)" />
                <circle cx={x} cy={y} r={radius} fill={colors[point.kind]} stroke="#fff" strokeWidth="2" />
                <text x={x + 14} y={y + 5} fill="#f8fafc" fontSize="16" fontWeight="600">
                  {point.label}
                </text>
                <text x={x + 14} y={y + 24} fill="#94a3b8" fontSize="12">
                  {point.latitude.toFixed(5)}, {point.longitude.toFixed(5)}
                </text>
              </g>
            );
          })}
        </svg>
      ) : (
        <div className="muted">Aun no hay coordenadas suficientes para dibujar la ruta.</div>
      )}
    </div>
  );
}
