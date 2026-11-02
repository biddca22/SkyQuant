"use client";

import { useState } from "react";
import { ResponsiveContainer, RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Tooltip } from "recharts";
import { Leaf, DollarSign, Sliders } from "lucide-react";
import { FlightData, FuelMetrics } from "../types";
import { formatNumber } from "../page";

interface EconomicsProps {
  telemetry: FlightData;
  fuelMetrics: FuelMetrics;
  theme?: "glass" | "obsidian";
  language?: "EN" | "FR" | "ES";
}

export default function AviationEconomics({ telemetry, fuelMetrics, theme = "glass", language = "EN" }: EconomicsProps) {
  const [fuelPricePerTon, setFuelPricePerTon] = useState(880);
  const [loadFactor, setLoadFactor] = useState(82);

  const burnRateKgH = fuelMetrics?.burn_rate_kg_hr || 2560;
  const co2PerHourTons = fuelMetrics?.co2_per_hr_tons || (burnRateKgH * 3.16) / 1000;
  const euEtsCostPerHour = fuelMetrics?.eu_ets_cost_hr_eur || co2PerHourTons * 72.4;

  const hourlyFuelCost = (burnRateKgH / 1000) * fuelPricePerTon;
  const seatCapacity = 312;
  const totalCostPerHour = hourlyFuelCost + euEtsCostPerHour * 1.08 + 1850;
  const costPerSeatHour = totalCostPerHour / (seatCapacity * (loadFactor / 100));

  const dynamicScore = 91;
  const radarData = [
    { subject: "Thrust Efficiency", value: dynamicScore + 3 },
    { subject: "Aero L/D", value: dynamicScore - 2 },
    { subject: "Carbon Abatement", value: dynamicScore - 4 },
    { subject: "Thermal Yield", value: dynamicScore + 5 },
    { subject: "Corridor Optima", value: dynamicScore + 1 },
    { subject: "Surrogate Model", value: 98 },
  ];

  const isGlass = theme === "glass";

  const t = {
    EN: { title: "EU ETS & Quantitative Aviation Economics", badge: "EU ETS COMPLIANT", desc: "Fuel sensitivity, CORSIA carbon credits, and operating margins", ets: "ETS Allowance", fuel: "Jet A-1 Market Price", pax: "Passenger Load Factor", hourly: "Hourly Fuel Burn Cost", seat: "Cost / Seat-Hour", cap: "Capacity", liab: "Carbon Liability", sar: "Specific Air Range", int: "CO₂ Intensity" },
    FR: { title: "EU ETS & Économie Quantitative", badge: "CONFORME EU ETS", desc: "Sensibilité au carburant, crédits CORSIA et marges d'exploitation", ets: "Quota ETS", fuel: "Prix du Jet A-1", pax: "Taux de remplissage", hourly: "Coût Horaire Carburant", seat: "Coût / Siège-Heure", cap: "Capacité", liab: "Obligation carbone", sar: "Distance spécifique", int: "Intensité CO₂" },
    ES: { title: "EU ETS y Economía Cuantitativa", badge: "CONFORME EU ETS", desc: "Sensibilidad al combustible, créditos CORSIA y márgenes", ets: "Derecho ETS", fuel: "Precio del Jet A-1", pax: "Factor de ocupación", hourly: "Coste Horario Combustible", seat: "Coste / Asiento-Hora", cap: "Capacidad", liab: "Pasivo de carbono", sar: "Alcance específico", int: "Intensidad CO₂" }
  }[language] || { title: "EU ETS & Quantitative Aviation Economics", badge: "EU ETS COMPLIANT", desc: "Fuel sensitivity, CORSIA carbon credits, and operating margins", ets: "ETS Allowance", fuel: "Jet A-1 Market Price", pax: "Passenger Load Factor", hourly: "Hourly Fuel Burn Cost", seat: "Cost / Seat-Hour", cap: "Capacity", liab: "Carbon Liability", sar: "Specific Air Range", int: "CO₂ Intensity" };

  return (
    <div className={`w-full h-full min-h-[480px] rounded-3xl p-6 flex flex-col justify-between transition-all duration-300 border border-white/10 font-sans ${isGlass ? "glass-deck-panel" : "obsidian-panel rounded-2xl"}`}>
      <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
        <div className="flex items-center gap-3.5">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${isGlass ? "bg-emerald-500/20 border border-emerald-400/40 text-emerald-300 shadow-[0_0_15px_rgba(16,185,129,0.3)]" : "bg-cyan-500/15 border border-cyan-400/40 text-cyan-400"}`}>
            <Leaf size={20} />
          </div>
          <div>
            <h3 className="text-sm font-extrabold text-white tracking-wide flex items-center gap-2.5">
              <span>{t.title}</span>
              {isGlass && (
                <span className="text-[9px] font-mono px-2 py-0.5 rounded-full bg-emerald-400/20 text-emerald-300 border border-emerald-400/30 tracking-wider">
                  {t.badge}
                </span>
              )}
            </h3>
            <p className="text-[11px] text-slate-400 mt-0.5">
              {t.desc}
            </p>
          </div>
        </div>

        <div className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl border text-xs font-mono ${isGlass ? "glass-deck-card border-white/10" : "bg-slate-900 border-slate-700"}`}>
          <span className="text-slate-400">{t.ets}:</span>
          <span className="font-bold text-emerald-300 glow-text-emerald">€72.40 / TON</span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 my-2">
        <div className="h-[260px] flex items-center justify-center relative">
          <ResponsiveContainer width="100%" height="100%">
            <RadarChart cx="50%" cy="50%" outerRadius="75%" data={radarData}>
              <PolarGrid stroke={isGlass ? "rgba(255,255,255,0.12)" : "#1e293b"} />
              <PolarAngleAxis
                dataKey="subject"
                tick={{ fill: isGlass ? "#cbd5e1" : "#94a3b8", fontSize: 10, fontFamily: "sans-serif", fontWeight: 500 }}
              />
              <PolarRadiusAxis
                angle={30}
                domain={[50, 100]}
                tick={{ fill: isGlass ? "#64748b" : "#475569", fontSize: 9 }}
              />
              <Radar
                name="Yield Score"
                dataKey="value"
                stroke={isGlass ? "#34d399" : "#06b6d4"}
                fill={isGlass ? "#34d399" : "#06b6d4"}
                fillOpacity={isGlass ? 0.35 : 0.25}
              />
              <Tooltip
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null;
                  return (
                    <div className={`p-2.5 rounded-xl border text-xs font-mono shadow-xl ${isGlass ? "glass-floating-hud text-slate-100 border-white/20" : "bg-slate-900 text-slate-100 border-slate-700"}`}>
                      <p className="font-bold text-emerald-300 font-sans">{payload[0]?.name}</p>
                      <p className="text-white mt-1">Index: {payload[0]?.value} / 100</p>
                    </div>
                  );
                }}
              />
            </RadarChart>
          </ResponsiveContainer>
        </div>

        <div className="flex flex-col justify-center space-y-4">
          <div className={`p-4 rounded-2xl border transition-all ${isGlass ? "glass-deck-card border-white/10" : "bg-slate-900/80 border-slate-800"}`}>
            <div className="flex justify-between items-center mb-2.5 text-[11px] font-sans font-medium">
              <span className="text-slate-300 flex items-center gap-1.5 tracking-wide">
                <DollarSign size={14} className="text-amber-400" />
                {t.fuel}:
              </span>
              <span className="font-bold text-amber-300 font-mono">${formatNumber(fuelPricePerTon, language)} / Ton</span>
            </div>
            <input
              type="range"
              min="500"
              max="1500"
              step="20"
              value={fuelPricePerTon}
              onChange={(e) => setFuelPricePerTon(Number(e.target.value))}
              className="w-full accent-amber-400 cursor-pointer h-1.5 bg-white/10 rounded-lg"
            />
          </div>

          <div className={`p-4 rounded-2xl border transition-all ${isGlass ? "glass-deck-card border-white/10" : "bg-slate-900/80 border-slate-800"}`}>
            <div className="flex justify-between items-center mb-2.5 text-[11px] font-sans font-medium">
              <span className="text-slate-300 flex items-center gap-1.5 tracking-wide">
                <Sliders size={14} className="text-violet-400" />
                {t.pax}:
              </span>
              <span className="font-bold text-violet-300 font-mono">{loadFactor}% {t.cap}</span>
            </div>
            <input
              type="range"
              min="50"
              max="100"
              step="1"
              value={loadFactor}
              onChange={(e) => setLoadFactor(Number(e.target.value))}
              className="w-full accent-violet-400 cursor-pointer h-1.5 bg-white/10 rounded-lg"
            />
          </div>

          <div className="grid grid-cols-2 gap-3 text-xs font-sans">
            <div className={`p-3 rounded-xl border flex flex-col justify-center ${isGlass ? "glass-deck-card border-white/10" : "bg-slate-900 border-slate-800"}`}>
              <span className="text-[10px] text-slate-400 font-medium">{t.hourly}</span>
              <span className="text-base font-extrabold text-white mt-1 font-mono">
                ${formatNumber(Math.round(hourlyFuelCost), language)} / hr
              </span>
            </div>
            <div className={`p-3 rounded-xl border flex flex-col justify-center ${isGlass ? "glass-deck-card border-white/10" : "bg-slate-900 border-slate-800"}`}>
              <span className="text-[10px] text-slate-400 font-medium">{t.seat}</span>
              <span className="text-base font-extrabold text-emerald-300 mt-1 font-mono">
                ${formatNumber(costPerSeatHour, language, false)} / pax-hr
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-4 border-t border-white/10 text-xs font-sans">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_8px_#34d399]" />
          <span className="text-slate-300">
            {t.liab}: <strong className="text-white font-mono ml-1">€{formatNumber(euEtsCostPerHour, language, false)}/hr</strong>
          </span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-violet-400 shadow-[0_0_8px_#c084fc]" />
          <span className="text-slate-300">
            {t.sar}: <strong className="text-white font-mono ml-1">0.184 nm/kg</strong>
          </span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-sky-400 shadow-[0_0_8px_#38bdf8]" />
          <span className="text-slate-300">
            {t.int}: <strong className="text-white font-mono ml-1">{formatNumber(co2PerHourTons, language, false)} tons/hr</strong>
          </span>
        </div>
      </div>
    </div>
  );
}