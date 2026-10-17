"use client";

import "leaflet/dist/leaflet.css";
import { CircleMarker, MapContainer, Polyline, TileLayer, Tooltip } from "react-leaflet";
import type { MapStop } from "@/lib/itinerary/stops";

/** Numbered stops for one day, joined in visiting order. Client-only (Leaflet needs window). */
export default function DayMap({ stops }: { stops: MapStop[] }) {
  const bounds = stops.map((s) => [s.lat, s.lon] as [number, number]);
  return (
    <MapContainer
      bounds={bounds}
      boundsOptions={{ padding: [24, 24], maxZoom: 16 }}
      scrollWheelZoom={false}
      className="h-64 w-full rounded-xl"
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <Polyline
        positions={bounds}
        pathOptions={{ color: "#0284c7", weight: 2, dashArray: "4 6" }}
      />
      {stops.map((s) => (
        <CircleMarker
          key={s.order}
          center={[s.lat, s.lon]}
          radius={11}
          pathOptions={{ color: "#fff", weight: 2, fillColor: "#0284c7", fillOpacity: 1 }}
        >
          <Tooltip direction="center" permanent className="tm-stop-label">
            {s.order}
          </Tooltip>
          <Tooltip direction="top" offset={[0, -10]}>
            {s.time} · {s.name}
          </Tooltip>
        </CircleMarker>
      ))}
    </MapContainer>
  );
}
