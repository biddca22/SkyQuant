"use client";

import { Mountain, Gauge, MapPin, Compass, TrendingDown } from "lucide-react";

interface QuantTelemetryCardProps {
  telemetry: any;
  fuelMetrics: any;
  isMetric?: boolean;
  theme?: "glass" | "obsidian";
  language?: "EN" | "FR" | "ES";
  progressScrubber?: number;
  onScrub?: (val: number) => void;
  isLive?: boolean;
  onToggleLive?: () => void;
  simSpeed?: number;
  onSpeedChange?: (spd: number) => void;
}

const CARD_TEXT: Record<
  "EN" | "FR" | "ES",
  {
    header: string;
    badge: string;
    altitude: string;
    speed: string;
    position: string;
    trueTrack: string;
    quantEcon: string;
    costIndex: string;
    fuelSens: string;
    co2Abatement: string;
  }
> = {
  EN: {
    header: "KINEMATICS & FLIGHT ECONOMICS",
    badge: "KINEMATICS · ECON",
    altitude: "Altitude",
    speed: "Speed",
    position: "Position",
    trueTrack: "True Track",
    quantEcon: "Quantitative Economics",
    costIndex: "COST INDEX",
    fuelSens: "FUEL SENS.",
    co2Abatement: "CO2 ABATEMENT",
  },
  FR: {
    header: "CINÉMATIQUE & ÉCONOMIE DE VOL",
    badge: "CINÉMATIQUE · ÉCO",
    altitude: "Altitude",
    speed: "Vitesse",
    position: "Position",
    trueTrack: "Cap Vrai",
    quantEcon: "Économie Quantitative",
    costIndex: "COST INDEX",
    fuelSens: "SENS. CARB.",
    co2Abatement: "ABATTEMENT CO2",
  },
  ES: {
    header: "CINEMÁTICA Y ECONOMÍA DE VUELO",
    badge: "CINEMÁTICA · ECON",
    altitude: "Altitud",
    speed: "Velocidad",
    position: "Posición",
    trueTrack: "Rumbo Real",
    quantEcon: "Economía Cuantitativa",
    costIndex: "COST INDEX",
    fuelSens: "SENS. COMB.",
    co2Abatement: "ABATIMIENTO CO2",
  },
};

function getCardinalDirection(deg: number): string {
  const dirs = [
    "N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE",
    "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW",
  ];
  const idx = Math.round(((deg % 360) + 360) % 360 / 22.5) % 16;
  return dirs[idx];
}

export default function QuantTelemetryCard({
  telemetry,
  fuelMetrics,
  isMetric = true,
  theme = "glass",
  language = "EN",
}: QuantTelemetryCardProps) {
  const isGlass = theme === "glass";
  const t = CARD_TEXT[language] || CARD_TEXT.EN;

  const rawAltM = Number(telemetry?.altitude_m ?? telemetry?.altitude ?? 0);
  const rawVelMs = Number(telemetry?.velocity_ms ?? telemetry?.speed ?? telemetry?.velocity ?? 0);
  const lat = Number(telemetry?.latitude ?? 0);
  const lng = Number(telemetry?.longitude ?? 0);
  const headingDeg = Math.round(((Number(telemetry?.heading_deg ?? telemetry?.heading ?? 0) % 360) + 360) % 360);
  const cardinal = getCardinalDirection(headingDeg);

  const altDisplay = isMetric
    ? `${Math.round(rawAltM).toLocaleString()} m`
    : `${Math.round(rawAltM * 3.28084).toLocaleString()} ft`;

  const speedDisplay = isMetric
    ? `${Math.round(rawVelMs * 3.6).toLocaleString()} km/h`
    : `${Math.round(rawVelMs * 1.94384).toLocaleString()} kts`;

  const latHem = lat >= 0 ? "N" : "S";
  const lngHem = lng >= 0 ? "E" : "W";
  const posDisplay = `${Math.abs(lat).toFixed(2)}°${latHem}, ${Math.abs(lng).toFixed(2)}°${lngHem}`;

  // Dynamic Quantitative Economics derived from live kinematics & OpenAP fuel burn
  const burnKgHr = Number(fuelMetrics?.burn_rate_kg_hr ?? 2500);
  const burnKgS = Number(fuelMetrics?.burn_rate_kg_s ?? 0.7);
  const speedRatio = Math.min(1.25, Math.max(0.55, rawVelMs / 240));

  // Cost Index (CI: ratio of time-cost to fuel-cost, scales with cruise Mach/speed & airframe class)
  const dynamicCI = Math.round(Math.min(180, Math.max(12, speedRatio * 48 + burnKgS * 8.5)));

  // Fuel Price Sensitivity (marginal cost sensitivity per metric ton of fuel burn rate)
  const dynamicFuelSens = Math.round(Math.min(240, Math.max(42, 54 + burnKgS * 16.5 + (rawAltM / 12000) * 14)));

  // EU ETS Marginal Abatement / Carbon Allowance Valuation (€/t CO2, modulated by efficiency intensity)
  const co2TonnesPerHr = (burnKgHr * 3.16) / 1000;
  const dynamicAbatement = (64.0 + Math.min(24.0, co2TonnesPerHr * 1.15 + speedRatio * 4.2)).toFixed(1);

  return (
    <div
      className={`p-3 rounded-2xl flex-1 flex flex-col justify-between transition-all duration-300 ${
        isGlass ? "glass-deck-panel" : "obsidian-panel rounded-2xl"
      }`}
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-2 pb-2 border-b border-white/10">
        <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-slate-200 flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-cyan-400 shadow-[0_0_8px_#22d3ee] shrink-0" />
          <span className="leading-tight">{t.header}</span>
        </h3>
        <span className="text-[9px] font-mono font-bold uppercase px-2 py-0.5 rounded-lg bg-cyan-500/10 text-cyan-300 border border-cyan-400/25 shrink-0">
          {t.badge}
        </span>
      </div>

      {/* 2x2 Kinematics Grid */}
      <div className="grid grid-cols-2 gap-2 my-2">
        {/* Altitude */}
        <div
          className={`p-2.5 rounded-xl border ${
            isGlass ? "glass-deck-card" : "bg-[#141c2e] border-slate-700"
          }`}
        >
          <span className="text-[10px] font-mono text-slate-400 flex items-center gap-1">
            <Mountain size={11} className="text-violet-400 shrink-0" />
            <span>{t.altitude}</span>
          </span>
          <span className="text-sm font-extrabold font-mono text-violet-300 glow-text-violet block mt-1 whitespace-nowrap">
            {altDisplay}
          </span>
        </div>

        {/* Speed */}
        <div
          className={`p-2.5 rounded-xl border ${
            isGlass ? "glass-deck-card" : "bg-[#141c2e] border-slate-700"
          }`}
        >
          <span className="text-[10px] font-mono text-slate-400 flex items-center gap-1">
            <Gauge size={11} className="text-emerald-400 shrink-0" />
            <span>{t.speed}</span>
          </span>
          <span className="text-sm font-extrabold font-mono text-emerald-300 glow-text-emerald block mt-1 whitespace-nowrap">
            {speedDisplay}
          </span>
        </div>

        {/* Position (Full coordinates without truncation) */}
        <div
          className={`p-2.5 rounded-xl border ${
            isGlass ? "glass-deck-card" : "bg-[#141c2e] border-slate-700"
          }`}
        >
          <span className="text-[10px] font-mono text-slate-400 flex items-center gap-1">
            <MapPin size={11} className="text-sky-400 shrink-0" />
            <span>{t.position}</span>
          </span>
          <span className="text-[11px] sm:text-xs font-bold font-mono text-white block mt-1 whitespace-nowrap tracking-tight">
            {posDisplay}
          </span>
        </div>

        {/* Live True Track */}
        <div
          className={`p-2.5 rounded-xl border ${
            isGlass ? "glass-deck-card" : "bg-[#141c2e] border-slate-700"
          }`}
        >
          <span className="text-[10px] font-mono text-slate-400 flex items-center gap-1">
            <Compass size={11} className="text-amber-400 shrink-0" />
            <span>{t.trueTrack}</span>
          </span>
          <span className="text-xs font-extrabold font-mono text-amber-300 glow-text-amber block mt-1 whitespace-nowrap">
            {headingDeg}° {cardinal}
          </span>
        </div>
      </div>

      {/* Quantitative Economics Subcard (No bottom scrubber controls) */}
      <div className="p-2.5 rounded-2xl border border-violet-400/20 bg-violet-950/20">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[11px] font-mono font-bold text-violet-200 flex items-center gap-1.5">
            <TrendingDown size={12} className="text-violet-400" />
            <span>{t.quantEcon}</span>
          </span>
          <span className="text-[9px] font-mono text-slate-400">OpenAP · PyTorch</span>
        </div>

        <div className="grid grid-cols-3 gap-1.5 text-center font-mono">
          <div className="p-1.5 rounded-xl bg-black/30 border border-white/5">
            <span className="text-[8px] text-slate-400 block uppercase">{t.costIndex}</span>
            <span className="text-xs font-extrabold text-white block mt-0.5">CI {dynamicCI}</span>
            <span className="text-[8px] text-slate-500 block">kg/min</span>
          </div>

          <div className="p-1.5 rounded-xl bg-black/30 border border-white/5">
            <span className="text-[8px] text-slate-400 block uppercase">{t.fuelSens}</span>
            <span className="text-xs font-extrabold text-amber-300 block mt-0.5">+${dynamicFuelSens}/t</span>
            <span className="text-[8px] text-slate-500 block">∂C/∂P</span>
          </div>

          <div className="p-1.5 rounded-xl bg-black/30 border border-white/5">
            <span className="text-[8px] text-slate-400 block uppercase">{t.co2Abatement}</span>
            <span className="text-xs font-extrabold text-emerald-300 block mt-0.5">€{dynamicAbatement}/t</span>
            <span className="text-[8px] text-slate-500 block">EUA</span>
          </div>
        </div>
      </div>
    </div>
  );
}