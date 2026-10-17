"use client";

import { useEffect } from "react";
import { MapContainer, TileLayer, Polyline, CircleMarker, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";

interface MapProps {
  latitude: number;
  longitude: number;
  routeData?: any;
}

function MapCamera({ latitude, longitude, routeData }: MapProps) {
  const map = useMap();

  useEffect(() => {
    const hasRoute = routeData?.origin_lat != null && routeData?.origin_lng != null && routeData?.dest_lat != null && routeData?.dest_lng != null;

    if (hasRoute) {
      const bounds = L.latLngBounds([
        [routeData.origin_lat, routeData.origin_lng],
        [routeData.dest_lat, routeData.dest_lng],
        [latitude, longitude]
      ]);
      map.flyToBounds(bounds, { padding: [50, 50], duration: 1.5 });
    } else {
      map.flyTo([latitude, longitude], 6, { duration: 1.5 });
    }
  }, [latitude, longitude, routeData, map]);

  return null;
}

export default function FlightMap({ latitude, longitude, routeData }: MapProps) {
  const flightCoords: [number, number] = [latitude, longitude];
  
  const hasRoute = routeData?.origin_lat != null && routeData?.origin_lng != null && routeData?.dest_lat != null && routeData?.dest_lng != null;
  const routeCoords: [number, number][] = hasRoute 
    ? [[routeData.origin_lat, routeData.origin_lng], [routeData.dest_lat, routeData.dest_lng]]
    : [];

  return (
    <div className="w-full h-full bg-[#050505] rounded-xl overflow-hidden border border-[#1a1a1a] z-0">
      <MapContainer center={flightCoords} zoom={5} className="h-full w-full" zoomControl={false} attributionControl={false}>
        
        {/* New, reliable Esri Dark Canvas Map */}
        <TileLayer url="https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}" />
        
        <MapCamera latitude={latitude} longitude={longitude} routeData={routeData} />

        {routeCoords.length === 2 && (
          <Polyline positions={routeCoords} pathOptions={{ color: '#8b5cf6', weight: 2, dashArray: '5, 10', opacity: 0.6 }} />
        )}

        {routeCoords.length === 2 && (
          <>
            <CircleMarker center={routeCoords[0]} radius={4} pathOptions={{ color: '#3b82f6', fillColor: '#3b82f6', fillOpacity: 1 }} />
            <CircleMarker center={routeCoords[1]} radius={4} pathOptions={{ color: '#10b981', fillColor: '#10b981', fillOpacity: 1 }} />
          </>
        )}

        <CircleMarker center={flightCoords} radius={6} pathOptions={{ color: '#f0abfc', fillColor: '#f0abfc', fillOpacity: 1 }}>
          <div className="animate-ping absolute inline-flex h-full w-full rounded-full bg-fuchsia-400 opacity-75"></div>
        </CircleMarker>
      </MapContainer>
    </div>
  );
}