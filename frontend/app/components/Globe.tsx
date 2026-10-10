"use client";

import { useEffect, useState } from "react";
import { Viewer, Entity, PointGraphics } from "resium";
import { Cartesian3, Color, Ion } from "cesium";
import "cesium/Build/Cesium/Widgets/widgets.css";

// Load the token from your .env.local file
Ion.defaultAccessToken = process.env.NEXT_PUBLIC_CESIUM_ION_TOKEN as string;

// Enterprise Trick: Tell Cesium to load its heavy 3D assets from a CDN 
if (typeof window !== "undefined") {
  (window as any).CESIUM_BASE_URL = "https://unpkg.com/cesium@latest/Build/Cesium/";
}

interface GlobeProps {
  latitude: number;
  longitude: number;
  altitude: number;
}

export default function Globe({ latitude, longitude, altitude }: GlobeProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return <div className="h-[500px] w-full bg-slate-900 rounded-xl animate-pulse mt-8 border border-slate-800"></div>;

  const flightPosition = Cartesian3.fromDegrees(longitude, latitude, altitude);

  return (
    <div className="relative w-full h-[600px] rounded-xl overflow-hidden border border-slate-800 shadow-2xl mt-8">
      <Viewer 
        style={{ width: "100%", height: "100%" }}
        timeline={false} 
        animation={false} 
        baseLayerPicker={false}
        geocoder={false}
        homeButton={false}
        navigationHelpButton={false}
        sceneModePicker={false}
      >
        <Entity position={flightPosition} name="Tracked Flight">
          <PointGraphics 
            pixelSize={16} 
            color={Color.fromCssColorString('#3b82f6')} 
            outlineColor={Color.WHITE} 
            outlineWidth={3} 
          />
        </Entity>
      </Viewer>
    </div>
  );
}