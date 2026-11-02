"use client";

import { Mountain, Gauge, MapPin, Compass, TrendingDown } from "lucide-react";
import { formatNumber } from "../page";

interface QuantTelemetryCardProps {
  telemetry: any;
  fuelMetrics: any;
  isMetric?: boolean;
  theme?: "glass" | "obsidian";
  language?: "EN" | "FR" | "ES";
}

const CARD_TEXT: Record<
  "EN" | "FR" | "ES",
  {
    header: string;
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
    altitude: "Altitude",
    speed: "Speed",
    position: "Position",
    trueTrack: "True Track",
    quantEcon: "Quantitative Economics",
    costIndex: "Cost Index",
    fuelSens: "Fuel Sens.",
    co2Abatement: "CO₂ Abatement",
  },
  FR: {
    header: "CINÉMATIQUE & ÉCONOMIE DU VOL",
    altitude: "Altitude",
    speed: "Vitesse",
    position: "Position",
    trueTrack: "Cap vrai",
    quantEcon: "Économie Quantitative",
    costIndex: "Indice de coût",
    fuelSens: "Sens. carburant",
    co2Abatement: "Réduction de CO₂",
  },
  ES: {
    header: "CINEMÁTICA Y ECONOMÍA DEL VUELO",
    altitude: "Altitud",
    speed: "Velocidad",
    position: "Posición",
    trueTrack: "Rumbo verdadero",
    quantEcon: "Economía Cuantitativa",
    costIndex: "Índice de coste",
    fuelSens: "Sens. combustible",
    co2Abatement: "Reducción de CO₂",
  },
};

function getCardinalDirection(deg: number, lang: string): string {
  if (lang === "FR") {
    const dirs = ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE", "S", "SSO", "SO", "OSO", "O", "ONO", "NO", "NNO"];
    return dirs[Math.round(((deg % 360) + 360) % 360 / 22.5) % 16];
  } else if (lang === "ES") {
    const dirs = ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE", "S", "SSO", "SO", "OSO", "O", "ONO", "NO", "NNO"];
    return dirs[Math.round(((deg % 360) + 360) % 360 / 22.5) % 16];
  } else {
    const dirs = ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE", "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW"];
    return dirs[Math.round(((deg % 360) + 360) % 360 / 22.5) % 16];
  }
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
  const cardinal = getCardinalDirection(headingDeg, language);

  const altDisplay = isMetric
    ? `${formatNumber(rawAltM, language)} m`
    : `${formatNumber(rawAltM * 3.28084, language)} ft`;

  const speedDisplay = isMetric
    ? `${formatNumber(rawVelMs * 3.6, language)} km/h`
    : `${formatNumber(rawVelMs * 1.94384, language)} kts`;

  const latHem = lat >= 0 ? "N" : "S";
  const lngHem = lng >= 0 ? "E" : "W";
  const posDisplay = `${formatNumber(Math.abs(lat), language, false)}°${latHem}, ${formatNumber(Math.abs(lng), language, false)}°${lngHem}`;

  const burnKgHr = Number(fuelMetrics?.burn_rate_kg_hr ?? 2500);
  const burnKgS = Number(fuelMetrics?.burn_rate_kg_s ?? 0.7);
  const speedRatio = Math.min(1.25, Math.max(0.55, rawVelMs / 240));

  const dynamicCI = Math.round(Math.min(180, Math.max(12, speedRatio * 48 + burnKgS * 8.5)));
  const dynamicFuelSens = Math.round(Math.min(240, Math.max(42, 54 + burnKgS * 16.5 + (rawAltM / 12000) * 14)));
  const co2TonnesPerHr = (burnKgHr * 3.16) / 1000;
  const dynamicAbatement = (64.0 + Math.min(24.0, co2TonnesPerHr * 1.15 + speedRatio * 4.2));

  return (
    <div className={`p-4 rounded-2xl flex-1 flex flex-col justify-between transition-all duration-300 border border-white/10 ${isGlass ? "glass-deck-panel" : "obsidian-panel"}`}>
      <div className="flex items-center justify-between gap-2 pb-3 border-b border-white/10">
        <h3 className="text-xs font-sans font-bold uppercase tracking-wider text-slate-200 flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-cyan-400 shadow-[0_0_8px_#22d3ee] shrink-0" />
          <span className="leading-tight">{t.header}</span>
        </h3>
      </div>

      <div className="grid grid-cols-2 gap-3 my-3">
        <div className={`p-3 rounded-xl border ${isGlass ? "glass-deck-card border-white/10" : "bg-[#141c2e] border-slate-700"}`}>
          <span className="text-[11px] font-sans font-medium text-slate-400 flex items-center gap-1.5 mb-1">
            <Mountain size={12} className="text-violet-400 shrink-0" />
            <span>{t.altitude}</span>
          </span>
          <span className="text-sm font-extrabold font-mono text-violet-300 glow-text-violet block whitespace-nowrap">
            {altDisplay}
          </span>
        </div>

        <div className={`p-3 rounded-xl border ${isGlass ? "glass-deck-card border-white/10" : "bg-[#141c2e] border-slate-700"}`}>
          <span className="text-[11px] font-sans font-medium text-slate-400 flex items-center gap-1.5 mb-1">
            <Gauge size={12} className="text-emerald-400 shrink-0" />
            <span>{t.speed}</span>
          </span>
          <span className="text-sm font-extrabold font-mono text-emerald-300 glow-text-emerald block whitespace-nowrap">
            {speedDisplay}
          </span>
        </div>

        <div className={`p-3 rounded-xl border ${isGlass ? "glass-deck-card border-white/10" : "bg-[#141c2e] border-slate-700"}`}>
          <span className="text-[11px] font-sans font-medium text-slate-400 flex items-center gap-1.5 mb-1">
            <MapPin size={12} className="text-sky-400 shrink-0" />
            <span>{t.position}</span>
          </span>
          <span className="text-xs font-bold font-mono text-white block whitespace-nowrap tracking-tight">
            {posDisplay}
          </span>
        </div>

        <div className={`p-3 rounded-xl border ${isGlass ? "glass-deck-card border-white/10" : "bg-[#141c2e] border-slate-700"}`}>
          <span className="text-[11px] font-sans font-medium text-slate-400 flex items-center gap-1.5 mb-1">
            <Compass size={12} className="text-amber-400 shrink-0" />
            <span>{t.trueTrack}</span>
          </span>
          <span className="text-xs font-extrabold font-mono text-amber-300 glow-text-amber block whitespace-nowrap">
            {headingDeg}° {cardinal}
          </span>
        </div>
      </div>

      <div className="p-3 rounded-2xl border border-violet-400/20 bg-violet-950/20">
        <div className="flex items-center justify-between mb-2.5">
          <span className="text-[11px] font-sans font-bold uppercase tracking-wider text-violet-200 flex items-center gap-1.5">
            <TrendingDown size={12} className="text-violet-400" />
            <span>{t.quantEcon}</span>
          </span>
          <span className="text-[9px] font-mono text-slate-400">OpenAP · PyTorch</span>
        </div>

        <div className="grid grid-cols-3 gap-2 text-center font-sans">
          <div className="p-2 rounded-xl bg-black/30 border border-white/5 flex flex-col justify-center min-h-[56px]" title="Cost Index: balances time-related operating costs against fuel burn">
            <span className="text-[9px] sm:text-[10px] text-slate-400 block font-medium leading-tight">{t.costIndex}</span>
            <span className="text-[11px] sm:text-xs font-extrabold font-mono text-white block mt-0.5">CI {dynamicCI}</span>
          </div>

          <div className="p-2 rounded-xl bg-black/30 border border-white/5 flex flex-col justify-center min-h-[56px]" title="Marginal cost sensitivity per metric ton of fuel burn rate">
            <span className="text-[9px] sm:text-[10px] text-slate-400 block font-medium leading-tight">{t.fuelSens}</span>
            <span className="text-[11px] sm:text-xs font-extrabold font-mono text-amber-300 block mt-0.5">+${dynamicFuelSens}/t</span>
          </div>

          <div className="p-2 rounded-xl bg-black/30 border border-white/5 flex flex-col justify-center min-h-[56px]" title="EU ETS Marginal Abatement / Carbon Allowance Valuation">
            <span className="text-[9px] sm:text-[10px] text-slate-400 block font-medium leading-tight">{t.co2Abatement}</span>
            <span className="text-[11px] sm:text-xs font-extrabold font-mono text-emerald-300 block mt-0.5">€{formatNumber(dynamicAbatement, language, false)}/t</span>
          </div>
        </div>
      </div>
    </div>
  );
}