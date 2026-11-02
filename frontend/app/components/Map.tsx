"use client";

import { useEffect, useRef, useState } from "react";
import "leaflet/dist/leaflet.css";
import { 
  Compass, Wind, Navigation, Maximize2, Minimize2, Crosshair, Gauge, Mountain, MapPin
} from "lucide-react";
import { formatNumber } from "../page";

interface MapProps {
  latitude: number;
  longitude: number;
  routeData: any;
  telemetry: any;
  callsign?: string;
  theme?: "glass" | "obsidian";
  isMetric?: boolean;
  language?: string;
  nearbyFlights?: any[];
  userLocation?: { lat: number; lon: number; label?: string };
  cooldownTime?: number;
  onSelectFlight?: (callsign: string) => void;
}

const normalizeRouteCoordinates = (
  origLat?: number, origLng?: number,
  currLat?: number, currLng?: number,
  destLat?: number, destLng?: number
) => {
  const cLat = currLat ?? 0;
  let cLng = currLng ?? 0;

  if (origLat != null && origLng != null && destLat != null && destLng != null) {
    let oLng = origLng;
    let dLng = destLng;

    if (oLng - cLng > 180) oLng -= 360;
    else if (cLng - oLng > 180) oLng += 360;
    
    if (dLng - oLng > 180) dLng -= 360;
    else if (oLng - dLng > 180) dLng += 360;

    return {
      origin: [origLat, oLng] as [number, number],
      current: [cLat, cLng] as [number, number],
      dest: [destLat, dLng] as [number, number],
    };
  }
  return { origin: null, current: [cLat, cLng] as [number, number], dest: null };
};

function interpolateGreatCircle(lat1: number, lon1: number, lat2: number, lon2: number, fraction: number) {
  const d2r = Math.PI / 180;
  const r2d = 180 / Math.PI;
  const phi1 = lat1 * d2r, lambda1 = lon1 * d2r;
  const phi2 = lat2 * d2r, lambda2 = lon2 * d2r;
  const deltaLambda = lambda2 - lambda1;

  const a = Math.sin((phi2 - phi1) / 2) ** 2 + Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) ** 2;
  const angularDist = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  if (angularDist === 0) return { lat: lat1, lng: lon1 };

  const A = Math.sin((1 - fraction) * angularDist) / Math.sin(angularDist);
  const B = Math.sin(fraction * angularDist) / Math.sin(angularDist);

  const x = A * Math.cos(phi1) * Math.cos(lambda1) + B * Math.cos(phi2) * Math.cos(lambda2);
  const y = A * Math.cos(phi1) * Math.sin(lambda1) + B * Math.cos(phi2) * Math.sin(lambda2);
  const z = A * Math.sin(phi1) + B * Math.sin(phi2);

  return { lat: Math.atan2(z, Math.sqrt(x * x + y * y)) * r2d, lng: Math.atan2(y, x) * r2d };
}

function getHaversineDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371; 
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon/2) * Math.sin(dLon/2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

export default function Map({
  latitude,
  longitude,
  routeData,
  telemetry,
  callsign,
  theme = "glass",
  isMetric = true,
  language = "EN",
  nearbyFlights = [],
  userLocation,
  cooldownTime,
  onSelectFlight,
}: MapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<any>(null);
  const layerGroupRef = useRef<any>(null);
  const lastRouteKeyRef = useRef<string>("");
  const hasCenteredLocalRef = useRef<boolean>(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const mapWrapperRef = useRef<HTMLDivElement | null>(null);

  const isGlass = theme === "glass";

  const tUI = {
    EN: { trackHdg: "Magnetic Heading", drift: "Drift", localAcft: "Local Aircraft", gSpd: "Ground Speed", pAlt: "Pressure Altitude", cMach: "Cruise Mach", wait: "Wait", clickTrack: "Click to track", clickTrackWait: "Wait" },
    FR: { trackHdg: "Cap Magnétique", drift: "Dérive", localAcft: "Aéronefs à Proximité", gSpd: "Vitesse Sol", pAlt: "Altitude-Pression", cMach: "Mach de Croisière", wait: "Attente", clickTrack: "Cliquez pour suivre", clickTrackWait: "Attendre" },
    ES: { trackHdg: "Rumbo Magnético", drift: "Deriva", localAcft: "Aeronaves en la Zona", gSpd: "Velocidad sobre el Suelo", pAlt: "Altitud de Presión", cMach: "Mach de Crucero", wait: "Espera", clickTrack: "Pulsa para seguir", clickTrackWait: "Espera" }
  }[language] || { trackHdg: "Magnetic Heading", drift: "Drift", localAcft: "Local Aircraft", gSpd: "Ground Speed", pAlt: "Pressure Altitude", cMach: "Cruise Mach", wait: "Wait", clickTrack: "Click to track", clickTrackWait: "Wait" };


  useEffect(() => {
    return () => {
      if (mapRef.current) { mapRef.current.remove(); mapRef.current = null; }
    };
  }, []);

  useEffect(() => {
    let isCancelled = false;

    async function initOrUpdateMap() {
      const L = (await import("leaflet")).default;
      if (isCancelled || !containerRef.current) return;

      const norm = normalizeRouteCoordinates(
        routeData?.origin_lat, routeData?.origin_lng,
        latitude, longitude,
        routeData?.dest_lat, routeData?.dest_lng
      );

      if (!mapRef.current) {
        const initialCenter: [number, number] = userLocation
          ? [userLocation.lat, userLocation.lon]
          : norm.current;
        const map = L.map(containerRef.current, { center: initialCenter, zoom: 6, minZoom: 2, maxZoom: 12, zoomControl: false });
        L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}", { opacity: isGlass ? 0.88 : 1 }).addTo(map);
        L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Reference/MapServer/tile/{z}/{y}/{x}", { opacity: isGlass ? 0.88 : 1 }).addTo(map);
        L.control.zoom({ position: "bottomright" }).addTo(map);
        layerGroupRef.current = L.layerGroup().addTo(map);
        mapRef.current = map;
        setTimeout(() => map.invalidateSize(), 150);
      }

      const map = mapRef.current;
      const layerGroup = layerGroupRef.current;
      if (!map || !layerGroup) return;

      map.invalidateSize();
      layerGroup.clearLayers();

      // Dynamic radius calculation for radar ring
      let maxDist = 0;
      if (userLocation && Array.isArray(nearbyFlights) && nearbyFlights.length > 0) {
        nearbyFlights.forEach((plane) => {
          if (plane && typeof plane.lat === 'number' && typeof plane.lon === 'number') {
            const d = getHaversineDistanceKm(userLocation.lat, userLocation.lon, plane.lat, plane.lon);
            if (d > maxDist) maxDist = d;
          }
        });
      }
      const dynamicRadiusMeters = maxDist > 0 ? (maxDist + 18) * 1000 : 150000;

      if (userLocation) {
        L.circle([userLocation.lat, userLocation.lon], {
          radius: Math.min(dynamicRadiusMeters, 450000),
          color: "#a855f7",
          weight: 1.5,
          dashArray: "4, 6",
          opacity: 0.35,
          fillColor: "#7c3aed",
          fillOpacity: 0.03,
          interactive: false,
        }).addTo(layerGroup);
      }

      if (Array.isArray(nearbyFlights) && nearbyFlights.length > 0) {
        nearbyFlights.forEach((plane) => {
          if (!plane || plane.callsign === callsign) return;
          const hdg = typeof plane.heading === "number" ? plane.heading : 0;
          const planeHtml = `
            <div style="transform: rotate(${hdg}deg); cursor: pointer;" class="w-7 h-7 flex items-center justify-center text-cyan-300/85 hover:text-white hover:scale-125 transition-all duration-150 drop-shadow-[0_0_6px_rgba(34,211,238,0.65)]">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
                <path d="M21 16v-2l-8-5V3.5c0-.83-.67-1.5-1.5-1.5S10 2.67 10 3.5V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5z"/>
              </svg>
            </div>
          `;

          const routeBadge =
            plane.origin_iata && plane.dest_iata && plane.origin_iata !== "UNK" && plane.dest_iata !== "UNK"
              ? `${plane.origin_iata} → ${plane.dest_iata}`
              : "COMMERCIAL";

          const marker = L.marker([plane.lat, plane.lon], {
            icon: L.divIcon({
              html: planeHtml,
              className: "nearby-aircraft-marker",
              iconSize: [28, 28],
              iconAnchor: [14, 14],
            }),
          });
          
          const markerText = cooldownTime && cooldownTime > 0 ? `${tUI.clickTrackWait} ${cooldownTime}S` : tUI.clickTrack;

          marker.bindTooltip(
            `<div style="text-align:center;">
              <strong style="color:#ffffff; letter-spacing:0.08em; font-family: monospace; font-size: 14px;">${plane.callsign}</strong>
              <div style="font-size:11px; font-family: sans-serif; font-weight: 500; color:#67e8f9; margin-top:2px;">${routeBadge} • ${plane.aircraft_code || "A320"}</div>
              <div style="font-size:9px; font-family: sans-serif; color:#c084fc; margin-top:4px; font-weight:bold; text-transform: uppercase;">${markerText}</div>
            </div>`,
            {
              permanent: false,
              direction: "top",
              className:
                "bg-slate-950/90 backdrop-blur-md border border-cyan-400/50 text-slate-100 px-3 py-2 rounded-xl shadow-2xl",
            }
          );

          marker.on("click", () => {
            if (onSelectFlight) onSelectFlight(plane.callsign);
          });

          marker.addTo(layerGroup);
        });
      }

      if (norm.origin && norm.dest) {
        const pointsFlown: [number, number][] = [];
        const totalSteps = 60;

        for (let i = 0; i <= totalSteps; i++) {
          const pt = interpolateGreatCircle(norm.origin[0], norm.origin[1], norm.dest[0], norm.dest[1], i / totalSteps);
          pointsFlown.push([pt.lat, pt.lng]);
        }

        for (let i = 1; i < pointsFlown.length; i++) {
          let prevLng = pointsFlown[i-1][1];
          let currLng = pointsFlown[i][1];
          if (currLng - prevLng > 180) currLng -= 360;
          else if (prevLng - currLng > 180) currLng += 360;
          pointsFlown[i][1] = currLng;
        }

        L.polyline(pointsFlown, { color: isGlass ? "#a855f7" : "#06b6d4", weight: isGlass ? 8 : 5, opacity: isGlass ? 0.22 : 0.25 }).addTo(layerGroup);
        L.polyline(pointsFlown, { color: isGlass ? "#c084fc" : "#06b6d4", weight: 2.5, dashArray: "6, 7", opacity: 0.95 }).addTo(layerGroup);

        const currentProgIndex = Math.max(1, pointsFlown.findIndex(p => Math.abs(p[0] - norm.current[0]) < 2 && Math.abs(p[1] - norm.current[1]) < 2));
        const flownSub = pointsFlown.slice(0, currentProgIndex > 0 ? currentProgIndex : 30);
        if (flownSub.length > 1) {
          L.polyline(flownSub, { color: isGlass ? "#38bdf8" : "#22d3ee", weight: 3.5, opacity: 0.85 }).addTo(layerGroup);
        }
      }

      if (norm.origin) L.circleMarker(norm.origin, { radius: 6, color: isGlass ? "#60a5fa" : "#38bdf8", fillColor: isGlass ? "#3b82f6" : "#0284c7", fillOpacity: 0.95, weight: 2 }).addTo(layerGroup);
      if (norm.dest) L.circleMarker(norm.dest, { radius: 6, color: isGlass ? "#34d399" : "#34d399", fillColor: isGlass ? "#10b981" : "#059669", fillOpacity: 0.95, weight: 2 }).addTo(layerGroup);

      if (callsign) {
        const activeHeading = typeof telemetry?.heading_deg === "number" ? telemetry.heading_deg : 0;
        const aircraftHtml = isGlass ? `
          <div class="relative flex items-center justify-center">
            <div class="absolute w-12 h-12 rounded-full border border-violet-400/50 animate-ping"></div>
            <div class="absolute w-9 h-9 rounded-full bg-violet-500/25 border border-cyan-300 shadow-[0_0_20px_#a855f7]"></div>
            <div style="transform: rotate(${activeHeading}deg);" class="relative w-6 h-6 bg-gradient-to-tr from-violet-500 to-cyan-400 rounded-full shadow-[0_0_15px_#38bdf8] flex items-center justify-center text-white">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="14" height="14" fill="currentColor">
                <path d="M21 16v-2l-8-5V3.5c0-.83-.67-1.5-1.5-1.5S10 2.67 10 3.5V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5z"/>
              </svg>
            </div>
          </div>
        ` : `
          <div class="relative flex items-center justify-center">
            <div class="absolute w-9 h-9 rounded-full border border-cyan-400/60 animate-ping"></div>
            <div class="absolute w-7 h-7 rounded-full bg-cyan-400/20 border border-cyan-300 shadow-[0_0_15px_#22d3ee]"></div>
            <div class="relative w-4 h-4 bg-cyan-300 rounded-full shadow-[0_0_12px_#38bdf8] flex items-center justify-center">
              <div class="w-1.5 h-1.5 bg-white rounded-full"></div>
            </div>
          </div>
        `;

        L.marker(norm.current, { icon: L.divIcon({ html: aircraftHtml, className: "aircraft-marker", iconSize: [44, 44], iconAnchor: [22, 22] }), zIndexOffset: 1000 })
          .bindTooltip(`<strong>${callsign}</strong><br/><span style="font-size: 11px; font-family:sans-serif; color: ${isGlass ? '#c084fc' : '#bae6fd'}">${formatNumber(norm.current[0], language, false)}°, ${formatNumber(norm.current[1], language, false)}°</span>`, { permanent: false, direction: "top", className: "text-sm font-mono bg-slate-950/90 backdrop-blur-md border border-violet-400/50 text-slate-100 px-3 py-2 rounded-xl shadow-2xl" })
          .addTo(layerGroup);
      }

      const routeKey = `${callsign || "NONE"}-${routeData?.origin_lat}-${routeData?.origin_lng}-${routeData?.dest_lat}-${routeData?.dest_lng}`;
      if (callsign && lastRouteKeyRef.current !== routeKey) {
        lastRouteKeyRef.current = routeKey;
        if (!hasCenteredLocalRef.current && userLocation) {
          hasCenteredLocalRef.current = true;
          map.setView([userLocation.lat, userLocation.lon], 6, { animate: true, duration: 1.0 });
        } else if (norm.origin && norm.dest) {
          map.fitBounds(L.latLngBounds([norm.origin, norm.current, norm.dest]), { padding: [60, 60], maxZoom: 6, animate: true, duration: 1.0 });
        } else {
          map.setView(norm.current, 6, { animate: true, duration: 1.0 });
        }
      } else if (!callsign && userLocation && !hasCenteredLocalRef.current) {
        hasCenteredLocalRef.current = true;
        map.setView([userLocation.lat, userLocation.lon], 6, { animate: true, duration: 0.8 });
      }
    }

    initOrUpdateMap();
    const handleResize = () => { if (mapRef.current) mapRef.current.invalidateSize(); };
    window.addEventListener("resize", handleResize);
    return () => { isCancelled = true; window.removeEventListener("resize", handleResize); };
  }, [latitude, longitude, routeData, callsign, theme, isGlass, nearbyFlights, userLocation, cooldownTime, language, tUI]);

  const handleRecenter = () => mapRef.current?.setView([latitude, longitude], 6, { animate: true, duration: 0.8 });
  const handleCenterUserAirspace = () => {
    if (userLocation && mapRef.current) {
      mapRef.current.setView([userLocation.lat, userLocation.lon], 6, { animate: true, duration: 0.8 });
    }
  };

  const handleToggleFullscreen = () => {
    if (!mapWrapperRef.current) return;
    if (!document.fullscreenElement) { mapWrapperRef.current.requestFullscreen().catch(() => {}); setIsFullscreen(true); } 
    else { document.exitFullscreen().catch(() => {}); setIsFullscreen(false); }
  };

  const safeVelocity = typeof telemetry?.velocity_ms === 'number' && !isNaN(telemetry.velocity_ms) ? telemetry.velocity_ms : 0;
  const speedKmh = safeVelocity * 3.6;
  const speedKts = safeVelocity * 1.94384;
  const altM = telemetry?.altitude_m || 0;
  const altFt = (telemetry?.altitude_m || 0) * 3.28084;
  const mach = Math.min((speedKmh / 1062), 0.95);
  const trackHdg = Math.round(telemetry?.heading_deg || 284);

  return (
    <div ref={mapWrapperRef} className={`relative w-full h-full min-h-[500px] rounded-3xl overflow-hidden transition-all duration-300 ${isGlass ? "glass-deck-panel border-white/20" : "obsidian-panel rounded-2xl"}`}>
      <div ref={containerRef} className="w-full h-full min-h-[500px] z-0" />

      {isGlass && telemetry && (
        <>
          <div className="absolute top-4 left-4 z-[400] glass-floating-hud rounded-2xl p-3 px-4 flex items-center gap-3.5 pointer-events-auto shadow-xl backdrop-blur-xl bg-black/40 border border-white/10 w-max">
            <div className="w-8 h-8 rounded-xl bg-violet-500/20 border border-violet-400/40 flex items-center justify-center text-violet-300 shadow-[0_0_12px_rgba(168,85,247,0.3)] shrink-0">
              <Compass size={18} className="animate-pulse" />
            </div>
            <div className="flex flex-col">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-sans font-medium text-slate-300 whitespace-nowrap">{tUI.trackHdg}</span>
                <span className="text-[13px] font-mono font-bold text-white glow-text-white whitespace-nowrap">{trackHdg}°</span>
              </div>
              <div className="flex items-center gap-3 text-[10px] font-mono text-slate-400 mt-0.5">
                <span className="flex items-center gap-1 text-cyan-300 whitespace-nowrap"><Wind size={10} /> 270° · 48 kt</span>
                <span className="text-emerald-400 font-sans font-medium whitespace-nowrap">
                  {nearbyFlights.length > 0 ? `${nearbyFlights.length} ${tUI.localAcft}` : `${tUI.drift} +1.2°`}
                </span>
              </div>
            </div>
          </div>

          <div className="absolute bottom-4 sm:bottom-6 left-1/2 -translate-x-1/2 z-[400] glass-floating-hud rounded-2xl px-5 py-2.5 flex items-center gap-6 pointer-events-auto shadow-2xl backdrop-blur-xl bg-black/40 border border-white/10 w-max">
            <div className="flex items-center gap-2.5 shrink-0">
              <div className="text-cyan-400"><Gauge size={15} /></div>
              <div className="flex flex-col">
                <span className="text-[9px] font-sans font-medium text-slate-400 whitespace-nowrap mb-0.5">{tUI.gSpd}</span>
                <span className="text-[13px] font-mono font-extrabold text-white glow-text-cyan whitespace-nowrap">{isMetric ? `${formatNumber(speedKmh, language)} km/h` : `${formatNumber(speedKts, language)} kts`}</span>
              </div>
            </div>
            <div className="w-[1px] h-7 bg-white/15" />
            <div className="flex items-center gap-2.5 shrink-0">
              <div className="text-violet-400"><Mountain size={15} /></div>
              <div className="flex flex-col">
                <span className="text-[9px] font-sans font-medium text-slate-400 whitespace-nowrap mb-0.5">{tUI.pAlt}</span>
                <span className="text-[13px] font-mono font-extrabold text-white glow-text-violet whitespace-nowrap">{isMetric ? `${formatNumber(altM, language)} m` : `${formatNumber(altFt, language)} ft`}</span>
              </div>
            </div>
            <div className="w-[1px] h-7 bg-white/15" />
            <div className="flex items-center gap-2.5 shrink-0">
              <div className="text-amber-400"><Navigation size={15} /></div>
              <div className="flex flex-col">
                <span className="text-[9px] font-sans font-medium text-slate-400 whitespace-nowrap mb-0.5">{tUI.cMach}</span>
                <span className="text-[13px] font-mono font-extrabold text-amber-300 glow-text-amber whitespace-nowrap">M {formatNumber(mach, language, false)}</span>
              </div>
            </div>
          </div>

          <div className="absolute bottom-16 right-4 z-[400] flex flex-col gap-2 pointer-events-auto">
            {userLocation && (
              <button onClick={handleCenterUserAirspace} title="Center on Local Airspace" className="w-9 h-9 rounded-xl glass-floating-hud flex items-center justify-center text-cyan-300 hover:text-white hover:border-cyan-400 transition-all active:scale-95 shadow-lg bg-black/40 backdrop-blur-xl border border-white/10"><MapPin size={15} /></button>
            )}
            <button onClick={handleRecenter} title="Recenter on Active Aircraft" className="w-9 h-9 rounded-xl glass-floating-hud flex items-center justify-center text-slate-300 hover:text-white hover:border-violet-400 transition-all active:scale-95 shadow-lg bg-black/40 backdrop-blur-xl border border-white/10"><Crosshair size={15} /></button>
            <button onClick={handleToggleFullscreen} title={isFullscreen ? "Exit Fullscreen" : "Fullscreen Radar"} className="w-9 h-9 rounded-xl glass-floating-hud flex items-center justify-center text-slate-300 hover:text-white hover:border-violet-400 transition-all active:scale-95 shadow-lg bg-black/40 backdrop-blur-xl border border-white/10">{isFullscreen ? <Minimize2 size={15} /> : <Maximize2 size={15} />}</button>
          </div>
        </>
      )}
    </div>
  );
}