"use client";

import { useEffect } from "react";
import { MapContainer, Marker, TileLayer, useMap, useMapEvents } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

/** אייקון סיכה — טעינה מ-CDN כדי להימנע מבעיית נתיבי תמונות של Leaflet עם bundler. */
const markerIcon = L.icon({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

const ISRAEL_CENTER: [number, number] = [31.7683, 35.2137];

function ClickToPlace({ onChange }: { onChange: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(event) {
      onChange(event.latlng.lat, event.latlng.lng);
    }
  });
  return null;
}

/** ממרכז את המפה כשמתקבל מיקום חדש (למשל מבחירת יישוב בחיפוש). */
function Recenter({ latitude, longitude }: { latitude: number | null; longitude: number | null }) {
  const map = useMap();
  useEffect(() => {
    if (latitude != null && longitude != null) {
      map.setView([latitude, longitude], Math.max(map.getZoom(), 13));
    }
  }, [latitude, longitude, map]);
  return null;
}

export default function MapPicker({
  latitude,
  longitude,
  onChange
}: {
  latitude: number | null;
  longitude: number | null;
  onChange: (lat: number, lng: number) => void;
}) {
  const center: [number, number] =
    latitude != null && longitude != null ? [latitude, longitude] : ISRAEL_CENTER;

  return (
    <MapContainer
      center={center}
      zoom={latitude != null && longitude != null ? 14 : 8}
      style={{ height: 300, width: "100%" }}
      className="rounded-md border border-border"
      scrollWheelZoom
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <ClickToPlace onChange={onChange} />
      {latitude != null && longitude != null ? (
        <Marker
          position={[latitude, longitude]}
          icon={markerIcon}
          draggable
          eventHandlers={{
            dragend: (event) => {
              const pos = (event.target as L.Marker).getLatLng();
              onChange(pos.lat, pos.lng);
            }
          }}
        />
      ) : null}
      <Recenter latitude={latitude} longitude={longitude} />
    </MapContainer>
  );
}
