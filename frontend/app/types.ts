export interface FlightData {
  icao24: string;
  callsign: string;
  longitude: number;
  latitude: number;
  altitude_m: number;
  velocity_ms: number;
  heading_deg?: number;
  vertical_rate_ms?: number;
  mach?: number;
}

export interface RouteData {
  origin: string;
  destination: string;
  origin_iata: string;
  dest_iata: string;
  origin_country?: string;
  dest_country?: string;
  airline: string;
  logo_url?: string;
  departure_time: string;
  arrival_time: string;
  origin_lat: number;
  origin_lng: number;
  dest_lat: number;
  dest_lng: number;
  total_distance_km?: number;
}

export interface FuelMetrics {
  aircraft_type_assumed: string;
  burn_rate_kg_s: number;
  burn_rate_kg_hr: number;
  casm_fuel_usd?: number;
  specific_air_range_nm_kg?: number;
  co2_per_hr_tons?: number;
  eu_ets_cost_hr_eur?: number;
}

export interface FlightResponse {
  status: string;
  flight: FlightData;
  route: RouteData;
  fuel_metrics: FuelMetrics;
  isSimulated?: boolean;
}

export interface TelemetryResponse {
  flight: FlightData;
  fuel_metrics: FuelMetrics;
  isSimulated?: boolean;
}
