import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from "react";
import { api } from "../api/resources";
import type {
  CollectionCenter,
  CollectionTripIncident,
  CollectionTrip,
  CollectionTripTelemetryPoint,
  CollectionTripStop,
  Driver,
  EvidenceFile,
  Party,
  Route,
  Vehicle,
} from "../types";
import { Page } from "../components/Page";
import { RouteMap, type RouteMapPoint } from "../components/RouteMap";
import { Pagination } from "../components/Pagination";
import { SortableHeader } from "../components/SortableHeader";
import { matchesSearch, paginate } from "../utils/listing";
import { sortByValue } from "../utils/listing";

function routeLabel(route: Route | undefined) {
  if (!route) return "-";
  const origin = route.origin_center_name ?? route.origin_center;
  const destination = route.destination_center_name ?? route.destination_center;
  const originCoords = route.origin_center_latitude && route.origin_center_longitude ? ` (${route.origin_center_latitude}, ${route.origin_center_longitude})` : "";
  const destinationCoords =
    route.destination_center_latitude && route.destination_center_longitude
      ? ` (${route.destination_center_latitude}, ${route.destination_center_longitude})`
      : "";
  return `${route.code} · ${route.name} · ${origin}${originCoords} → ${destination}${destinationCoords}`;
}

function vehicleLabel(vehicle: Vehicle | undefined) {
  if (!vehicle) return "-";
  return `${vehicle.plate_number}${vehicle.label ? ` Â· ${vehicle.label}` : ""}`;
}

function partyLabel(party: Party | undefined) {
  if (!party) return "-";
  return party.trade_name || party.legal_name || "-";
}

function centerLabel(center: CollectionCenter | undefined) {
  if (!center) return "-";
  const kind = center.kind === "smelter" ? "Fundidora" : center.kind === "destination" ? "Destino" : "Acopio";
  const coordinates = center.latitude && center.longitude ? ` · ${center.latitude}, ${center.longitude}` : "";
  return `${center.code} · ${center.name} · ${kind}${coordinates}`;
}

function toNumber(value?: string | null) {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function toMapPoint(label: string, latitude?: string | null, longitude?: string | null, kind: RouteMapPoint["kind"] = "stop") {
  const lat = toNumber(latitude);
  const lng = toNumber(longitude);
  if (lat === null || lng === null) return null;
  return { label, latitude: lat, longitude: lng, kind };
}

export function LogisticsPage() {
  const [routes, setRoutes] = useState<Route[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [centers, setCenters] = useState<CollectionCenter[]>([]);
  const [parties, setParties] = useState<Party[]>([]);
  const [trips, setTrips] = useState<CollectionTrip[]>([]);
  const [evidences, setEvidences] = useState<EvidenceFile[]>([]);
  const [stops, setStops] = useState<CollectionTripStop[]>([]);
  const [incidents, setIncidents] = useState<CollectionTripIncident[]>([]);
  const [telemetryPoints, setTelemetryPoints] = useState<CollectionTripTelemetryPoint[]>([]);
  const [selectedTripId, setSelectedTripId] = useState("");
  const [routeId, setRouteId] = useState("");
  const [vehicleId, setVehicleId] = useState("");
  const [driverId, setDriverId] = useState("");
  const [originCenterId, setOriginCenterId] = useState("");
  const [destinationCenterId, setDestinationCenterId] = useState("");
  const [estimatedDistanceKm, setEstimatedDistanceKm] = useState("0");
  const [tripNotes, setTripNotes] = useState("");
  const [evidenceFile, setEvidenceFile] = useState<File | null>(null);
  const [evidenceType, setEvidenceType] = useState("photo");
  const [evidenceDescription, setEvidenceDescription] = useState("");
  const [stopLabel, setStopLabel] = useState("");
  const [stopNotes, setStopNotes] = useState("");
  const [stopLatitude, setStopLatitude] = useState("");
  const [stopLongitude, setStopLongitude] = useState("");
  const [stopPhoto, setStopPhoto] = useState<File | null>(null);
  const [telemetryLatitude, setTelemetryLatitude] = useState("");
  const [telemetryLongitude, setTelemetryLongitude] = useState("");
  const [telemetrySpeed, setTelemetrySpeed] = useState("");
  const [telemetrySource, setTelemetrySource] = useState<CollectionTripTelemetryPoint["source"]>("gps");
  const [telemetryNotes, setTelemetryNotes] = useState("");
  const [incidentTitle, setIncidentTitle] = useState("");
  const [incidentDescription, setIncidentDescription] = useState("");
  const [incidentSeverity, setIncidentSeverity] = useState<CollectionTripIncident["severity"]>("medium");
  const [incidentLatitude, setIncidentLatitude] = useState("");
  const [incidentLongitude, setIncidentLongitude] = useState("");
  const [incidentPhoto, setIncidentPhoto] = useState<File | null>(null);
  const [departOdometer, setDepartOdometer] = useState("");
  const [arriveOdometer, setArriveOdometer] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [sortKey, setSortKey] = useState<"route" | "vehicle" | "driver" | "status" | "gps" | "distance">("route");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    refresh();
    api.routes().then(setRoutes).catch(() => setRoutes([]));
    api.vehicles().then(setVehicles).catch(() => setVehicles([]));
    api.drivers().then(setDrivers).catch(() => setDrivers([]));
    api.centers().then(setCenters).catch(() => setCenters([]));
    api.parties().then(setParties).catch(() => setParties([]));
  }, []);

  async function refresh() {
    setTrips(await api.collectionTrips().catch(() => []));
    setEvidences(await api.evidenceFiles().catch(() => []));
    setStops(await api.collectionTripStops().catch(() => []));
    setIncidents(await api.collectionTripIncidents().catch(() => []));
    setTelemetryPoints(await api.collectionTripTelemetryPoints().catch(() => []));
  }

  const routeById = useMemo(() => Object.fromEntries(routes.map((route) => [route.id, route])), [routes]);
  const vehicleById = useMemo(() => Object.fromEntries(vehicles.map((vehicle) => [vehicle.id, vehicle])), [vehicles]);
  const driverById = useMemo(() => Object.fromEntries(drivers.map((driver) => [driver.id, driver])), [drivers]);
  const centerById = useMemo(() => Object.fromEntries(centers.map((center) => [center.id, center])), [centers]);
  const partyById = useMemo(() => Object.fromEntries(parties.map((party) => [party.id, party])), [parties]);
  const selectedTrip = useMemo(() => trips.find((trip) => trip.id === selectedTripId) ?? null, [trips, selectedTripId]);
  const selectedTripEvidences = useMemo(() => evidences.filter((evidence) => evidence.trip === selectedTripId), [evidences, selectedTripId]);
  const selectedTripStops = useMemo(() => stops.filter((stop) => stop.trip === selectedTripId), [stops, selectedTripId]);
  const selectedTripIncidents = useMemo(() => incidents.filter((incident) => incident.trip === selectedTripId), [incidents, selectedTripId]);
  const selectedTripTelemetry = useMemo(() => telemetryPoints.filter((point) => point.trip === selectedTripId), [telemetryPoints, selectedTripId]);
  const openIncidentCount = useMemo(() => selectedTripIncidents.filter((incident) => !incident.resolved).length, [selectedTripIncidents]);
  const filteredTrips = useMemo(
    () =>
      trips.filter((trip) =>
        matchesSearch(
          [
            routeLabel(routeById[trip.route]),
            trip.route_name ?? routeById[trip.route]?.name ?? trip.route,
            vehicleLabel(vehicleById[trip.vehicle ?? ""]),
            trip.vehicle_label,
            trip.driver_name ?? partyById[driverById[trip.driver ?? ""]?.person ?? ""]?.legal_name,
            trip.status,
            trip.origin_center_name ?? centerById[trip.origin_center]?.name ?? trip.origin_center,
            trip.destination_center_name ?? centerById[trip.destination_center]?.name ?? trip.destination_center,
            trip.closure_notes,
            trip.notes,
          ],
          search,
        ),
      ),
    [centerById, driverById, partyById, routeById, search, trips, vehicleById],
  );
  const sortedTrips = useMemo(() => {
    const accessors = {
      route: (trip: CollectionTrip) => routeLabel(routeById[trip.route]),
      vehicle: (trip: CollectionTrip) => trip.vehicle_label ?? vehicleById[trip.vehicle ?? ""]?.plate_number ?? trip.vehicle ?? "",
      driver: (trip: CollectionTrip) => trip.driver_name ?? partyById[driverById[trip.driver ?? ""]?.person ?? ""]?.legal_name ?? trip.driver ?? "",
      status: (trip: CollectionTrip) => trip.status,
      gps: (trip: CollectionTrip) => trip.telemetry_points_count,
      distance: (trip: CollectionTrip) => trip.telemetry_distance_km,
    } satisfies Record<typeof sortKey, (trip: CollectionTrip) => string | number>;
    return sortByValue(filteredTrips, accessors[sortKey], sortDirection);
  }, [driverById, filteredTrips, partyById, routeById, sortDirection, sortKey, vehicleById]);
  const paginatedTrips = useMemo(() => paginate(sortedTrips, page, pageSize), [page, pageSize, sortedTrips]);
  useEffect(() => {
    if (!selectedTripId && trips.length) {
      setSelectedTripId(trips[0].id);
    }
  }, [trips, selectedTripId]);
  useEffect(() => {
    setPage(1);
  }, [search]);

  useEffect(() => {
    setPage(1);
  }, [pageSize]);

  useEffect(() => {
    setPage(1);
  }, [sortDirection, sortKey]);

  function toggleSort(nextKey: typeof sortKey) {
    if (nextKey === sortKey) {
      setSortDirection((current) => (current === "asc" ? "desc" : "asc"));
      return;
    }
    setSortKey(nextKey);
    setSortDirection("asc");
  }
  const mapPoints = useMemo<RouteMapPoint[]>(() => {
    if (!selectedTrip) return [];
    const points: Array<RouteMapPoint | null> = [
      toMapPoint("Salida", selectedTrip.geo_start_lat, selectedTrip.geo_start_lng, "start"),
      ...selectedTripStops.map((stop) => toMapPoint(`Parada ${stop.sequence}`, stop.latitude, stop.longitude, "stop")),
      ...selectedTripTelemetry.map((point) => toMapPoint(`GPS ${point.sequence}`, point.latitude, point.longitude, "telemetry")),
      ...selectedTripIncidents.map((incident, index) =>
        toMapPoint(
          `Incidencia ${index + 1}: ${incident.title}`,
          incident.geo_lat,
          incident.geo_lng,
          "incident",
        ),
      ),
      toMapPoint("Llegada", selectedTrip.geo_end_lat, selectedTrip.geo_end_lng, "end"),
    ];
    return points.filter((point): point is RouteMapPoint => Boolean(point));
  }, [selectedTrip, selectedTripStops, selectedTripIncidents, selectedTripTelemetry]);
  const timelineEntries = useMemo(() => {
    if (!selectedTrip) return [];
    const entries = [
      {
        title: "Viaje planificado",
        detail: selectedTrip.planned_at,
        kind: "plan",
      },
      ...selectedTripStops.map((stop) => ({
        title: `Parada ${stop.sequence}: ${stop.label}`,
        detail: stop.latitude && stop.longitude ? `${stop.latitude}, ${stop.longitude}` : stop.notes || "Sin coordenadas",
        kind: "stop",
      })),
      ...selectedTripEvidences.map((evidence) => ({
        title: `Evidencia ${evidence.file_type}`,
        detail: evidence.description || evidence.file_name || "Registro sin descripcion",
        kind: "evidence",
      })),
      ...selectedTripIncidents.map((incident) => ({
        title: `Incidencia ${incident.severity}: ${incident.title}`,
        detail: incident.resolved ? "Resuelta" : incident.description || "Pendiente",
        kind: incident.resolved ? "incident-resolved" : "incident-open",
      })),
      ...selectedTripTelemetry.map((point) => ({
        title: `GPS ${point.sequence}`,
        detail: point.notes || `${point.latitude}, ${point.longitude}`,
        kind: "telemetry",
      })),
    ];
    if (selectedTrip.departed_at) {
      entries.splice(1, 0, {
        title: "Salida registrada",
        detail:
          selectedTrip.geo_start_lat && selectedTrip.geo_start_lng
            ? `${selectedTrip.geo_start_lat}, ${selectedTrip.geo_start_lng}`
            : selectedTrip.departed_at,
        kind: "depart",
      });
    }
    if (selectedTrip.arrived_at) {
      entries.push({
        title: "Llegada registrada",
        detail:
          selectedTrip.geo_end_lat && selectedTrip.geo_end_lng ? `${selectedTrip.geo_end_lat}, ${selectedTrip.geo_end_lng}` : selectedTrip.arrived_at,
        kind: "arrive",
      });
    }
    if (selectedTrip.closed_at) {
      entries.push({
        title: "Viaje cerrado",
        detail: selectedTrip.closure_notes || selectedTrip.closed_at,
        kind: "close",
      });
    }
    return entries;
  }, [selectedTrip, selectedTripStops, selectedTripEvidences, selectedTripTelemetry]);

  async function createTrip(event: FormEvent) {
    event.preventDefault();
    setMessage(null);
    try {
      await api.collectionTripCreate({
        route_id: routeId,
        vehicle_id: vehicleId,
        driver_id: driverId,
        origin_center_id: originCenterId,
        destination_center_id: destinationCenterId,
        estimated_distance_km: estimatedDistanceKm,
        notes: tripNotes,
      });
      setMessage("Viaje de recoleccion creado.");
      await refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo crear el viaje");
    }
  }

  async function departTrip(trip: CollectionTrip) {
    try {
      await api.collectionTripDepart(trip.id, {
        notes: "Salida registrada desde UI",
        odometer: departOdometer || undefined,
      });
      setMessage("Viaje marcado como salida.");
      await refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo marcar la salida");
    }
  }

  async function arriveTrip(trip: CollectionTrip) {
    try {
      await api.collectionTripArrive(trip.id, {
        notes: "Llegada registrada desde UI",
        odometer: arriveOdometer || undefined,
      });
      setMessage("Viaje marcado como llegada.");
      await refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo marcar la llegada");
    }
  }

  async function closeTrip(trip: CollectionTrip) {
    try {
      await api.collectionTripClose(trip.id, { notes: "Cierre operativo desde UI" });
      setMessage("Viaje cerrado.");
      await refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo cerrar el viaje");
    }
  }

  async function uploadEvidence(event: FormEvent) {
    event.preventDefault();
    if (!selectedTripId || !evidenceFile) return;
    setMessage(null);
    try {
      const formData = new FormData();
      formData.append("trip", selectedTripId);
      formData.append("file", evidenceFile);
      formData.append("file_type", evidenceType);
      formData.append("description", evidenceDescription);
      await api.evidenceFileUpload(formData);
      setEvidenceFile(null);
      setEvidenceDescription("");
      setMessage("Evidencia cargada.");
      await refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo subir la evidencia");
    }
  }

  async function addStop(event: FormEvent) {
    event.preventDefault();
    if (!selectedTripId || !stopLabel) return;
    setMessage(null);
    try {
      const formData = new FormData();
      formData.append("label", stopLabel);
      formData.append("notes", stopNotes);
      if (stopLatitude) formData.append("latitude", stopLatitude);
      if (stopLongitude) formData.append("longitude", stopLongitude);
      if (stopPhoto) formData.append("photo", stopPhoto);
      await api.collectionTripStopCreate(selectedTripId, formData);
      setStopLabel("");
      setStopNotes("");
      setStopLatitude("");
      setStopLongitude("");
      setStopPhoto(null);
      setMessage("Parada registrada.");
      await refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo registrar la parada");
    }
  }

  async function addIncident(event: FormEvent) {
    event.preventDefault();
    if (!selectedTripId || !incidentTitle) return;
    setMessage(null);
    try {
      const formData = new FormData();
      formData.append("trip_id", selectedTripId);
      formData.append("title", incidentTitle);
      formData.append("description", incidentDescription);
      formData.append("severity", incidentSeverity);
      if (incidentLatitude) formData.append("latitude", incidentLatitude);
      if (incidentLongitude) formData.append("longitude", incidentLongitude);
      if (incidentPhoto) formData.append("photo", incidentPhoto);
      await api.collectionTripIncidentCreate(formData);
      setIncidentTitle("");
      setIncidentDescription("");
      setIncidentSeverity("medium");
      setIncidentLatitude("");
      setIncidentLongitude("");
      setIncidentPhoto(null);
      setMessage("Incidencia registrada.");
      await refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo registrar la incidencia");
    }
  }

  async function addTelemetryPoint(event: FormEvent) {
    event.preventDefault();
    if (!selectedTripId || !telemetryLatitude || !telemetryLongitude) return;
    setMessage(null);
    try {
      const formData = new FormData();
      formData.append("trip_id", selectedTripId);
      formData.append("latitude", telemetryLatitude);
      formData.append("longitude", telemetryLongitude);
      formData.append("source", telemetrySource);
      if (telemetrySpeed) formData.append("speed_kmh", telemetrySpeed);
      if (telemetryNotes) formData.append("notes", telemetryNotes);
      await api.collectionTripTelemetryPointCreate(formData);
      setTelemetryNotes("");
      setTelemetrySpeed("");
      setMessage("Punto GPS registrado.");
      await refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo registrar el punto GPS");
    }
  }

  async function resolveIncident(incident: CollectionTripIncident) {
    try {
      await api.collectionTripIncidentResolve(incident.id, { notes: "Incidencia resuelta desde UI" });
      setMessage("Incidencia resuelta.");
      await refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo resolver la incidencia");
    }
  }

  function onFileChange(event: ChangeEvent<HTMLInputElement>) {
    setEvidenceFile(event.target.files?.[0] ?? null);
  }

  function useCurrentLocation(setLat: (value: string) => void, setLng: (value: string) => void) {
    if (!navigator.geolocation) {
      setMessage("Este navegador no soporta geolocalizacion.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLat(position.coords.latitude.toFixed(6));
        setLng(position.coords.longitude.toFixed(6));
        setMessage("Ubicacion actual capturada.");
      },
      () => setMessage("No se pudo obtener la ubicacion actual."),
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }

  async function useCurrentLocationForTelemetry() {
    if (!navigator.geolocation) {
      setMessage("Este navegador no soporta geolocalizacion.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setTelemetryLatitude(position.coords.latitude.toFixed(6));
        setTelemetryLongitude(position.coords.longitude.toFixed(6));
        setTelemetrySource("gps");
        setMessage("Ubicacion GPS capturada para telemetria.");
      },
      () => setMessage("No se pudo obtener la ubicacion GPS."),
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }

  return (
    <Page title="Logistica" actions={<span className="muted">Rutas, viajes, paradas y evidencias</span>}>
      <section className="metric-panel" style={{ marginBottom: 16 }}>
        <span>Viajes activos</span>
        <strong>{trips.length}</strong>
        <div className="muted" style={{ marginTop: 6 }}>
          Seguimiento de recoleccion, traslado y evidencia operativa.
        </div>
      </section>

      <section className="metric-panel" style={{ marginBottom: 16 }}>
        <span>Viaje activo</span>
        <strong>{selectedTrip ? routeLabel(routeById[selectedTrip.route]) : "Selecciona un viaje"}</strong>
        <div className="muted">Estado: {selectedTrip?.status ?? "-"}</div>
        <div className="muted">Origen: {selectedTrip ? centerLabel(centerById[selectedTrip.origin_center]) : "-"}</div>
        <div className="muted">Destino: {selectedTrip ? centerLabel(centerById[selectedTrip.destination_center]) : "-"}</div>
        <div className="muted">Unidad: {selectedTrip?.vehicle_label ?? vehicleById[selectedTrip?.vehicle ?? ""]?.plate_number ?? "-"}</div>
        <div className="muted">Conductor: {selectedTrip?.driver_name ?? "-"}</div>
        <div className="muted">Puntos GPS: {selectedTrip?.telemetry_points_count ?? 0}</div>
        <div className="muted">Km estimados: {selectedTrip?.telemetry_distance_km ?? "0.000"}</div>
        <div className="muted">Combustible estimado: {selectedTrip?.estimated_fuel_liters ?? "0.000"} L</div>
      </section>

      <div className="metric-panel" style={{ marginBottom: 12 }}>
        <label className="search-box">
          Búsqueda rápida
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por ruta, unidad, conductor, estado, origen o destino"
          />
        </label>
      </div>

      <form className="inline-form" onSubmit={createTrip}>
        <label>
          Ruta
          <select value={routeId} onChange={(e) => setRouteId(e.target.value)}>
            <option value="">Seleccionar</option>
            {routes.map((route) => (
              <option key={route.id} value={route.id}>
                {routeLabel(route)}
              </option>
            ))}
          </select>
        </label>
        <label>
          Vehiculo
          <select value={vehicleId} onChange={(e) => setVehicleId(e.target.value)}>
            <option value="">Seleccionar</option>
            {vehicles.map((vehicle) => (
              <option key={vehicle.id} value={vehicle.id}>
                {vehicleLabel(vehicle)}
              </option>
            ))}
          </select>
        </label>
        <label>
          Conductor
          <select value={driverId} onChange={(e) => setDriverId(e.target.value)}>
            <option value="">Seleccionar</option>
            {drivers.map((driver) => (
              <option key={driver.id} value={driver.id}>
                {partyLabel(partyById[driver.person])}
              </option>
            ))}
          </select>
        </label>
        <label>
          Origen
          <select value={originCenterId} onChange={(e) => setOriginCenterId(e.target.value)}>
            <option value="">Usar ruta</option>
            {centers.map((center) => (
              <option key={center.id} value={center.id}>
                {centerLabel(center)}
              </option>
            ))}
          </select>
        </label>
        <label>
          Destino
          <select value={destinationCenterId} onChange={(e) => setDestinationCenterId(e.target.value)}>
            <option value="">Usar ruta</option>
            {centers.map((center) => (
              <option key={center.id} value={center.id}>
                {centerLabel(center)}
              </option>
            ))}
          </select>
        </label>
        <label>
          Distancia estimada
          <input value={estimatedDistanceKm} onChange={(e) => setEstimatedDistanceKm(e.target.value)} />
        </label>
        <label>
          Observaciones
          <input value={tripNotes} onChange={(e) => setTripNotes(e.target.value)} />
        </label>
        <button type="submit" disabled={!routeId}>
          Crear viaje
        </button>
      </form>

      {message ? <div className="info-banner">{message}</div> : null}

        <section style={{ marginTop: 24 }}>
          <h3>Panel de viajes</h3>
          <div className="inline-form" style={{ marginBottom: 12 }}>
            <label>
              Odometro salida
              <input value={departOdometer} onChange={(e) => setDepartOdometer(e.target.value)} />
            </label>
            <label>
              Odometro llegada
              <input value={arriveOdometer} onChange={(e) => setArriveOdometer(e.target.value)} />
            </label>
          </div>
        <table className="table">
          <thead>
          <tr>
              <th><SortableHeader label="Ruta" active={sortKey === "route"} direction={sortDirection} onClick={() => toggleSort("route")} /></th>
              <th><SortableHeader label="Vehículo" active={sortKey === "vehicle"} direction={sortDirection} onClick={() => toggleSort("vehicle")} /></th>
              <th><SortableHeader label="Conductor" active={sortKey === "driver"} direction={sortDirection} onClick={() => toggleSort("driver")} /></th>
              <th>Origen</th>
              <th>Destino</th>
              <th><SortableHeader label="Estado" active={sortKey === "status"} direction={sortDirection} onClick={() => toggleSort("status")} /></th>
              <th><SortableHeader label="GPS" active={sortKey === "gps"} direction={sortDirection} onClick={() => toggleSort("gps")} /></th>
              <th><SortableHeader label="Km" active={sortKey === "distance"} direction={sortDirection} onClick={() => toggleSort("distance")} /></th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {paginatedTrips.items.map((trip) => (
              <tr key={trip.id} onClick={() => setSelectedTripId(trip.id)} style={{ cursor: "pointer" }}>
                <td>{trip.route_name ?? routeById[trip.route]?.name ?? trip.route}</td>
                <td>{trip.vehicle_label ?? vehicleById[trip.vehicle ?? ""]?.plate_number ?? trip.vehicle ?? "-"}</td>
                <td>{trip.driver_name ?? partyById[driverById[trip.driver ?? ""]?.person ?? ""]?.legal_name ?? trip.driver ?? "-"}</td>
                <td>{trip.origin_center_name ?? centerById[trip.origin_center]?.name ?? trip.origin_center}</td>
                <td>{trip.destination_center_name ?? centerById[trip.destination_center]?.name ?? trip.destination_center}</td>
                <td>{trip.status}</td>
                <td>{trip.telemetry_points_count}</td>
                <td>{trip.telemetry_distance_km}</td>
                <td>
                  <button type="button" onClick={() => departTrip(trip)} disabled={trip.status !== "planned"}>
                    Salir
                  </button>{" "}
                  <button type="button" onClick={() => arriveTrip(trip)} disabled={trip.status !== "departed"}>
                    Llegar
                  </button>{" "}
                  <button type="button" onClick={() => closeTrip(trip)} disabled={trip.status !== "arrived"}>
                    Cerrar
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <Pagination {...paginatedTrips} onPageChange={setPage} pageSize={pageSize} onPageSizeChange={setPageSize} />
      </section>

      <section style={{ marginTop: 24 }}>
        <h3>Paradas y geolocalizacion</h3>
        <form className="inline-form" onSubmit={addStop}>
          <label>
            Parada
            <input value={stopLabel} onChange={(e) => setStopLabel(e.target.value)} placeholder="Recolector A / Punto 3 / etc." />
          </label>
          <label>
            Latitud
            <input value={stopLatitude} onChange={(e) => setStopLatitude(e.target.value)} />
          </label>
          <label>
            Longitud
            <input value={stopLongitude} onChange={(e) => setStopLongitude(e.target.value)} />
          </label>
          <button type="button" onClick={() => useCurrentLocation(setStopLatitude, setStopLongitude)}>
            Ubicacion actual parada
          </button>
          <label>
            Foto
            <input type="file" onChange={(e) => setStopPhoto(e.target.files?.[0] ?? null)} />
          </label>
          <label style={{ flex: 1 }}>
            Notas
            <input value={stopNotes} onChange={(e) => setStopNotes(e.target.value)} />
          </label>
          <button type="submit" disabled={!selectedTripId || !stopLabel}>
            Registrar parada
          </button>
        </form>

        <table className="table">
          <thead>
            <tr>
              <th>#</th>
              <th>Parada</th>
              <th>Geo</th>
              <th>Notas</th>
            </tr>
          </thead>
          <tbody>
            {selectedTripStops.map((stop) => (
              <tr key={stop.id}>
                <td>{stop.sequence}</td>
                <td>{stop.label}</td>
                <td>{stop.latitude && stop.longitude ? `${stop.latitude}, ${stop.longitude}` : "-"}</td>
                <td>{stop.notes}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section style={{ marginTop: 24 }}>
        <h3>Telemetria GPS</h3>
        <form className="inline-form" onSubmit={addTelemetryPoint}>
          <label>
            Fuente
            <select value={telemetrySource} onChange={(e) => setTelemetrySource(e.target.value as CollectionTripTelemetryPoint["source"])}>
              <option value="gps">GPS</option>
              <option value="manual">Manual</option>
            </select>
          </label>
          <label>
            Latitud
            <input value={telemetryLatitude} onChange={(e) => setTelemetryLatitude(e.target.value)} />
          </label>
          <label>
            Longitud
            <input value={telemetryLongitude} onChange={(e) => setTelemetryLongitude(e.target.value)} />
          </label>
          <button type="button" onClick={useCurrentLocationForTelemetry}>
            Ubicacion actual GPS
          </button>
          <label>
            Velocidad km/h
            <input value={telemetrySpeed} onChange={(e) => setTelemetrySpeed(e.target.value)} />
          </label>
          <label style={{ flex: 1 }}>
            Notas
            <input value={telemetryNotes} onChange={(e) => setTelemetryNotes(e.target.value)} />
          </label>
          <button type="submit" disabled={!selectedTripId || !telemetryLatitude || !telemetryLongitude}>
            Registrar punto GPS
          </button>
        </form>

        <table className="table">
          <thead>
            <tr>
              <th>#</th>
              <th>Fuente</th>
              <th>Geo</th>
              <th>Velocidad</th>
              <th>Notas</th>
              <th>Hora</th>
            </tr>
          </thead>
          <tbody>
            {selectedTripTelemetry.map((point) => (
              <tr key={point.id}>
                <td>{point.sequence}</td>
                <td>{point.source}</td>
                <td>
                  {point.latitude}, {point.longitude}
                </td>
                <td>{point.speed_kmh ?? "-"}</td>
                <td>{point.notes || "-"}</td>
                <td>{point.recorded_at}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section style={{ marginTop: 24 }}>
        <h3>Incidencias de viaje</h3>
        <form className="inline-form" onSubmit={addIncident}>
          <label>
            Severidad
            <select value={incidentSeverity} onChange={(e) => setIncidentSeverity(e.target.value as CollectionTripIncident["severity"])}>
              <option value="low">Baja</option>
              <option value="medium">Media</option>
              <option value="high">Alta</option>
              <option value="critical">CrÃ­tica</option>
            </select>
          </label>
          <label>
            Titulo
            <input value={incidentTitle} onChange={(e) => setIncidentTitle(e.target.value)} />
          </label>
          <label>
            Latitud
            <input value={incidentLatitude} onChange={(e) => setIncidentLatitude(e.target.value)} />
          </label>
          <label>
            Longitud
            <input value={incidentLongitude} onChange={(e) => setIncidentLongitude(e.target.value)} />
          </label>
          <button type="button" onClick={() => useCurrentLocation(setIncidentLatitude, setIncidentLongitude)}>
            Ubicacion actual incidencia
          </button>
          <label>
            Foto
            <input type="file" onChange={(e) => setIncidentPhoto(e.target.files?.[0] ?? null)} />
          </label>
          <label style={{ flex: 1 }}>
            Descripcion
            <input value={incidentDescription} onChange={(e) => setIncidentDescription(e.target.value)} />
          </label>
          <button type="submit" disabled={!selectedTripId || !incidentTitle}>
            Registrar incidencia
          </button>
        </form>

        <table className="table">
          <thead>
            <tr>
              <th>Titulo</th>
              <th>Severidad</th>
              <th>Estado</th>
              <th>Geo</th>
              <th>Foto</th>
              <th>Accion</th>
            </tr>
          </thead>
          <tbody>
            {selectedTripIncidents.map((incident) => (
              <tr key={incident.id}>
                <td>{incident.title}</td>
                <td>{incident.severity}</td>
                <td>{incident.resolved ? "Resuelta" : "Pendiente"}</td>
                <td>{incident.geo_lat && incident.geo_lng ? `${incident.geo_lat}, ${incident.geo_lng}` : "-"}</td>
                <td>
                  {incident.photo_url ? (
                    <a href={incident.photo_url} target="_blank" rel="noreferrer">
                      {incident.photo_name ?? "Abrir"}
                    </a>
                  ) : (
                    "-"
                  )}
                </td>
                <td>
                  <button type="button" onClick={() => resolveIncident(incident)} disabled={incident.resolved}>
                    Resolver
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section style={{ marginTop: 24 }}>
        <h3>Evidencias de viaje</h3>
        <form className="inline-form" onSubmit={uploadEvidence}>
          <label>
            Tipo
            <select value={evidenceType} onChange={(e) => setEvidenceType(e.target.value)}>
              <option value="photo">Foto</option>
              <option value="document">Documento</option>
              <option value="receipt">Comprobante</option>
            </select>
          </label>
          <label>
            Archivo
            <input type="file" onChange={onFileChange} />
          </label>
          <label>
            Descripcion
            <input value={evidenceDescription} onChange={(e) => setEvidenceDescription(e.target.value)} />
          </label>
          <button type="submit" disabled={!selectedTripId || !evidenceFile}>
            Subir evidencia
          </button>
        </form>

        <table className="table">
          <thead>
            <tr>
              <th>Viaje</th>
              <th>Tipo</th>
              <th>Descripcion</th>
              <th>Vista previa</th>
            </tr>
          </thead>
          <tbody>
            {selectedTripEvidences.map((evidence) => (
              <tr key={evidence.id}>
                <td>{evidence.trip_name ?? evidence.trip ?? "-"}</td>
                <td>{evidence.file_type}</td>
                <td>{evidence.description}</td>
                <td>
                  {evidence.file_url ? (
                    <div style={{ display: "grid", gap: 8 }}>
                      {evidence.file_type === "photo" ? (
                        <img
                          src={evidence.file_url}
                          alt={evidence.description || evidence.file_name || "Evidencia"}
                          style={{ maxWidth: 140, borderRadius: 8 }}
                        />
                      ) : null}
                      <a href={evidence.file_url} target="_blank" rel="noreferrer">
                        {evidence.file_name ?? "Abrir archivo"}
                      </a>
                    </div>
                  ) : (
                    evidence.file_name ?? evidence.file ?? "-"
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section style={{ marginTop: 24 }}>
        <h3>Detalle del viaje</h3>
        <div className="metric-panel">
          <span>Seleccionado</span>
          <strong>{selectedTrip ? routeLabel(routeById[selectedTrip.route]) : "-"}</strong>
          <div className="muted">Estado: {selectedTrip?.status ?? "-"}</div>
          <div className="muted">Incidencias abiertas: {openIncidentCount}</div>
          <div className="muted">Vehiculo: {selectedTrip?.vehicle_label ?? "-"}</div>
          <div className="muted">Conductor: {selectedTrip?.driver_name ?? "-"}</div>
          <div className="muted">Puntos GPS: {selectedTrip?.telemetry_points_count ?? 0}</div>
          <div className="muted">Km estimados: {selectedTrip?.telemetry_distance_km ?? "0.000"}</div>
          <div className="muted">Combustible estimado: {selectedTrip?.estimated_fuel_liters ?? "0.000"} L</div>
          <div className="muted">
            Geo inicio: {selectedTrip?.geo_start_lat && selectedTrip?.geo_start_lng ? `${selectedTrip.geo_start_lat}, ${selectedTrip.geo_start_lng}` : "-"}
          </div>
          <div className="muted">
            Geo fin: {selectedTrip?.geo_end_lat && selectedTrip?.geo_end_lng ? `${selectedTrip.geo_end_lat}, ${selectedTrip.geo_end_lng}` : "-"}
          </div>
          <div className="muted">Cierre: {selectedTrip?.closed_at ?? "-"}</div>
          <div className="muted">Notas cierre: {selectedTrip?.closure_notes || "-"}</div>
        </div>
      </section>

      <section style={{ marginTop: 24 }}>
        <h3>Mapa de ruta</h3>
        <RouteMap points={mapPoints} />
      </section>

      <section style={{ marginTop: 24 }}>
        <h3>Linea de tiempo</h3>
        <div style={{ display: "grid", gap: 12 }}>
          {timelineEntries.map((entry, index) => (
            <article key={`${entry.title}-${index}`} className="metric-panel">
              <span>{entry.title}</span>
              <strong>{entry.detail}</strong>
              <div className="muted">Tipo: {entry.kind}</div>
            </article>
          ))}
        </div>
      </section>
    </Page>
  );
}


