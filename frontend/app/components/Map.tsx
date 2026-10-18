"use client";

import { useEffect, useRef } from "react";
import "leaflet/dist/leaflet.css";

// Unwraps longitudes across the ±180° International Date Line
// Ensures Trans-Pacific flights (e.g., MEL -> SFO) cross the Pacific instead of the Atlantic
const normalizeRouteCoordinates = (
  origLat?: number, origLng?: number,
  currLat?: number, currLng?: number,
  destLat?: number, destLng?: number
) => {
  const cLat = currLat ?? 0;
  let cLng = currLng ?? 0;

  if (origLat != null && origLng != null && destLat != null && destLng != null) {
    const oLng = origLng;
    let dLng = destLng;

    while (cLng - oLng > 180) cLng -= 360;
    while (cLng - oLng < -180) cLng += 360;

    while (dLng - cLng > 180) dLng -= 360;
    while (dLng - cLng < -180) dLng += 360;

    if (Math.abs(dLng - oLng) > 220) {
      if (dLng - oLng > 180) dLng -= 360;
      else if (dLng - oLng < -180) dLng += 360;
    }

    return {
      origin: [origLat, oLng] as [number, number],
      current: [cLat, cLng] as [number, number],
      dest: [destLat, dLng] as [number, number],
    };
  }

  return {
    origin: null,
    current: [cLat, cLng] as [number, number],
    dest: null,
  };
};

export default function Map({
  latitude,
  longitude,
  routeData,
}: {
  latitude: number;
  longitude: number;
  routeData: any;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<any>(null);
  const layerGroupRef = useRef<any>(null);
  const lastRouteKeyRef = useRef<string>("");

  // Clean up the map instance when switching tabs or unmounting
  useEffect(() => {
    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []);

  // Initialize and update the map purely on the client
  useEffect(() => {
    let isCancelled = false;

    async function updateMap() {
      const L = (await import("leaflet")).default || (await import("leaflet"));
      if (isCancelled || !containerRef.current) return;

      const norm = normalizeRouteCoordinates(
        routeData?.origin_lat,
        routeData?.origin_lng,
        latitude,
        longitude,
        routeData?.dest_lat,
        routeData?.dest_lng
      );

      if (!mapRef.current) {
        const map = L.map(containerRef.current, {
          center: norm.current,
          zoom: 4,
          minZoom: 2,
          zoomControl: false,
        });

        L.tileLayer(
          "https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}"
        ).addTo(map);

        L.tileLayer(
          "https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Reference/MapServer/tile/{z}/{y}/{x}"
        ).addTo(map);

        layerGroupRef.current = L.layerGroup().addTo(map);
        mapRef.current = map;
      }

      const map = mapRef.current;
      const layerGroup = layerGroupRef.current;
      if (!map || !layerGroup) return;

      layerGroup.clearLayers();

      // Straight dashed flight line between Origin and Destination
      if (norm.origin && norm.dest) {
        L.polyline([norm.origin, norm.dest], {
          color: "#8b5cf6",
          weight: 2,
          dashArray: "5, 8",
          opacity: 0.6,
        }).addTo(layerGroup);
      }

      // Origin Marker (Blue)
      if (norm.origin) {
        L.circleMarker(norm.origin, {
          radius: 4,
          color: "#3b82f6",
          fillColor: "#3b82f6",
          fillOpacity: 1,
          weight: 1,
        }).addTo(layerGroup);
      }

      // Destination Marker (Emerald)
      if (norm.dest) {
        L.circleMarker(norm.dest, {
          radius: 4,
          color: "#10b981",
          fillColor: "#10b981",
          fillOpacity: 1,
          weight: 1,
        }).addTo(layerGroup);
      }

      // Live Aircraft Marker (Fuchsia)
      L.circleMarker(norm.current, {
        radius: 5,
        color: "#d946ef",
        fillColor: "#f0abfc",
        fillOpacity: 1,
        weight: 2,
      }).addTo(layerGroup);

      // Intelligently fit bounds once per flight search
      const routeKey = `${routeData?.origin_lat}-${routeData?.origin_lng}-${routeData?.dest_lat}-${routeData?.dest_lng}`;
      if (lastRouteKeyRef.current !== routeKey) {
        lastRouteKeyRef.current = routeKey;
        if (norm.origin && norm.dest) {
          const bounds = L.latLngBounds([norm.origin, norm.current, norm.dest]);
          map.fitBounds(bounds, {
            padding: [45, 45],
            maxZoom: 6,
            animate: true,
            duration: 1.5,
          });
        } else {
          map.setView(norm.current, 4, { animate: true, duration: 1.5 });
        }
      }
    }

    updateMap();

    return () => {
      isCancelled = true;
    };
  }, [latitude, longitude, routeData]);

  return <div ref={containerRef} className="w-full h-full bg-[#111215] z-0" />;
}