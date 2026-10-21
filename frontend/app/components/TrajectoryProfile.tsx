"use client";

import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";
import { ArrowUpRight, Compass, ShieldAlert, CheckCircle2, TrendingUp, Layers } from "lucide-react";
import { FlightData } from "../types";

interface TrajectoryProps {
  telemetry: FlightData;
  isMetric: boolean;
  theme?: "glass" | "obsidian";
}

export default function TrajectoryProfile({ telemetry, isMetric, theme = "glass" }: TrajectoryProps) {
  const currentAltMeters = telemetry?.altitude_m || 10972;
  const currentAltDisplay = isMetric ? currentAltMeters : currentAltMeters / 0.3048;
  const optAltDisplay = isMetric ? 11582 : 38000;

  const profileData = [
    { waypoint: "DEP", actual: 0, optimal: 0 },
    { waypoint: "CLM-1 (FL180)", actual: isMetric ? 5500 : 18000, optimal: isMetric ? 6100 : 20000 },
    { waypoint: "CLM-2 (FL290)", actual: isMetric ? 8800 : 29000, optimal: isMetric ? 9400 : 31000 },
    { waypoint: "TOC (FL350)", actual: isMetric ? 10668 : 35000, optimal: isMetric ? 10668 : 35000 },
    { waypoint: "CRZ-1 (FL360)", actual: Math.round(currentAltDisplay), optimal: Math.round(optAltDisplay) },
    { waypoint: "CRZ-2 (FL390)", actual: isMetric ? 11887 : 39000, optimal: isMetric ? 12192 : 40000 },
    { waypoint: "TOD (FL390)", actual: isMetric ? 11887 : 39000, optimal: isMetric ? 12192 : 40000 },
    { waypoint: "DES (FL120)", actual: isMetric ? 3657 : 12000, optimal: isMetric ? 3657 : 12000 },
    { waypoint: "ARR", actual: 0, optimal: 0 },
  ];

  const altitudeDelta = optAltDisplay - currentAltDisplay;
  const isSuboptimal = altitudeDelta > (isMetric ? 450 : 1500);

  const isGlass = theme === "glass";

  return (
    <div
      className={`w-full h-full min-h-[480px] rounded-3xl p-6 flex flex-col justify-between transition-all duration-300 ${
        isGlass
          ? "glass-deck-panel"
          : "obsidian-panel rounded-2xl"
      }`}
    >
      <div className="flex flex-wrap items-center justify-between gap-4 mb-3">
        <div className="flex items-center gap-3">
          <div
            className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all ${
              isGlass
                ? "bg-sky-500/20 border border-sky-400/40 text-sky-300 shadow-[0_0_15px_rgba(56,189,248,0.3)]"
                : "bg-cyan-500/15 border border-cyan-400/40 text-cyan-400"
            }`}
          >
            <Layers size={18} />
          </div>
          <div>
            <h3 className="text-sm font-extrabold text-white tracking-wide flex items-center gap-2">
              <span>Vertical Trajectory & Step-Climb Optimizer</span>
              {isGlass && (
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-sky-400/20 text-sky-300 border border-sky-400/30">
                  OPTIMAL CRUISE
                </span>
              )}
            </h3>
            <p className="text-xs text-slate-400">
              Atmospheric wind shear, air density strata, and step-climb fuel savings
            </p>
          </div>
        </div>

        {/* Status Callout Badge */}
        <div
          className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl border text-xs font-mono font-bold ${
            isSuboptimal
              ? "bg-amber-500/15 border-amber-400/40 text-amber-300 shadow-[0_0_12px_rgba(245,158,11,0.25)]"
              : "bg-emerald-500/15 border-emerald-400/40 text-emerald-300 shadow-[0_0_12px_rgba(16,185,129,0.25)]"
          }`}
        >
          {isSuboptimal ? (
            <>
              <ShieldAlert size={14} className="text-amber-400" />
              <span>Step-Climb to FL380 Recommended (-2.4% Burn)</span>
            </>
          ) : (
            <>
              <CheckCircle2 size={14} className="text-emerald-400" />
              <span>Cruising at Optimal Stratum</span>
            </>
          )}
        </div>
      </div>

      {/* Main Trajectory Chart */}
      <div className="w-full h-[320px] relative">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={profileData} margin={{ top: 15, right: 20, left: 10, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={isGlass ? "rgba(255,255,255,0.08)" : "#1e293b"} />
            <XAxis
              dataKey="waypoint"
              stroke={isGlass ? "#94a3b8" : "#64748b"}
              tick={{ fill: isGlass ? "#cbd5e1" : "#94a3b8", fontSize: 10, fontFamily: "monospace" }}
            />
            <YAxis
              stroke={isGlass ? "#94a3b8" : "#64748b"}
              tick={{ fill: isGlass ? "#cbd5e1" : "#94a3b8", fontSize: 11, fontFamily: "monospace" }}
              unit={isMetric ? " m" : " ft"}
            />
            <Tooltip
              content={({ active, payload, label }) => {
                if (!active || !payload?.length) return null;
                return (
                  <div
                    className={`p-3 rounded-2xl shadow-2xl border text-xs font-mono ${
                      isGlass
                        ? "glass-floating-hud text-slate-100 border-white/20"
                        : "bg-slate-900/95 text-slate-100 border-slate-700"
                    }`}
                  >
                    <p className="font-bold text-white mb-2 pb-1 border-b border-white/10">{label}</p>
                    <div className="space-y-1">
                      {payload.map((entry, idx) => (
                        <div key={idx} className="flex items-center justify-between gap-4">
                          <span className="flex items-center gap-1.5" style={{ color: entry.color }}>
                            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }} />
                            {entry.name}:
                          </span>
                          <span className="font-bold text-white tabular-nums">
                            {Number(entry.value).toLocaleString()} {isMetric ? "m" : "ft"}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              }}
            />
            <Line
              type="monotone"
              dataKey="optimal"
              name="Optimal Geodesic Trajectory"
              stroke={isGlass ? "#34d399" : "#10b981"}
              strokeWidth={2.5}
              strokeDasharray="5 5"
              dot={{ r: 4, fill: isGlass ? "#34d399" : "#10b981", strokeWidth: 2, stroke: "#ffffff" }}
            />
            <Line
              type="monotone"
              dataKey="actual"
              name="Actual Radar Flight Path"
              stroke={isGlass ? "#c084fc" : "#06b6d4"}
              strokeWidth={3}
              dot={{ r: 5, fill: isGlass ? "#c084fc" : "#06b6d4", strokeWidth: 2, stroke: "#ffffff" }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Trajectory Insights Footer */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-3 border-t border-white/10 text-xs">
        <div
          className={`p-3 rounded-xl border transition-all ${
            isGlass ? "glass-deck-card" : "bg-slate-900 border-slate-800"
          }`}
        >
          <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider block mb-1">
            CURRENT FLIGHT LEVEL
          </span>
          <span className="font-mono font-bold text-sm text-white">
            FL{Math.round((telemetry?.altitude_m || 10972) / 30.48 / 10) * 10}
            <span className="text-xs text-slate-400 font-normal ml-2">
              ({isMetric ? `${Math.round(currentAltMeters).toLocaleString()} m` : `${Math.round(currentAltMeters / 0.3048).toLocaleString()} ft`})
            </span>
          </span>
        </div>

        <div
          className={`p-3 rounded-xl border transition-all ${
            isGlass ? "glass-deck-card" : "bg-slate-900 border-slate-800"
          }`}
        >
          <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider block mb-1">
            NEXT STEP-CLIMB WINDOW
          </span>
          <span className="font-mono font-bold text-sm text-sky-300">
            FL380 @ WAYPOINT DOTTY
          </span>
        </div>

        <div
          className={`p-3 rounded-xl border transition-all ${
            isGlass ? "glass-deck-card" : "bg-slate-900 border-slate-800"
          }`}
        >
          <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider block mb-1">
            ESTIMATED CRUISE SAVINGS
          </span>
          <span className="font-mono font-bold text-sm text-emerald-300">
            340 kg Fuel / 1.07 Tons CO₂
          </span>
        </div>
      </div>
    </div>
  );
}
