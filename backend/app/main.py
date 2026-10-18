import os
import math
import time
import random
import requests
import airportsdata
from datetime import datetime, timezone, timedelta
from typing import Optional, Dict, Any, List, Tuple
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv
from openap import FuelFlow
from FlightRadarAPI import FlightRadar24API

load_dotenv(dotenv_path="../.env")
RAPIDAPI_KEY = os.getenv("RAPIDAPI_KEY")

airports = airportsdata.load('IATA')
fr_api = FlightRadar24API()

app = FastAPI(title="SkyQuant Engine", version="3.3.0")

app.add_middleware(
    CORSMiddleware, allow_origins=["*"], allow_credentials=True,
    allow_methods=["*"], allow_headers=["*"],
)

class RouteData(BaseModel):
    origin: str
    destination: str
    origin_iata: str
    dest_iata: str
    origin_country: str
    dest_country: str
    airline: str
    logo_url: str
    departure_time: str
    arrival_time: str
    origin_lat: Optional[float] = None
    origin_lng: Optional[float] = None
    dest_lat: Optional[float] = None
    dest_lng: Optional[float] = None

class FuelMetrics(BaseModel):
    burn_rate_kg_s: float
    burn_rate_kg_hr: float
    aircraft_type_assumed: str

class FlightData(BaseModel):
    icao24: str
    callsign: str
    longitude: float
    latitude: float
    altitude_m: float
    velocity_ms: float

class FlightResponse(BaseModel):
    status: str
    flight: FlightData
    route: RouteData
    fuel_metrics: FuelMetrics

class TelemetryResponse(BaseModel):
    flight: FlightData
    fuel_metrics: FuelMetrics

# --- CARGO & NON-COMMERCIAL EXCLUSION LISTS ---
EXCLUDED_CALLSIGN_PREFIXES = (
    "UPS", "FDX", "CLX", "GTI", "BOX", "NCA", "CKS", "BCS", "DHK",
    "GEC", "AZG", "PAC", "AIH", "MPH", "CAO", "SQC", "ABW", "FPO",
    "RCH", "CNV", "RRR", "GAF", "BAF", "FAF", "CFC", "ABX", "ATN",
    "WGN", "NCR", "YZR", "CKK", "CSS", "HYT", "MNB", "KFS", "SRN"
)

EXCLUDED_OPERATOR_KEYWORDS = (
    "ups", "united parcel", "fedex", "federal express", "dhl", "cargo",
    "freight", "aerologic", "cargolux", "atlas air", "kalitta", "polar air",
    "air incheon", "nippon cargo", "silk way", "martinair", "airbridge",
    "suparna", "sf airlines", "china postal", "amerijet", "abx air",
    "western global", "air transport", "prime air", "military", "air force"
)

# --- DYNAMIC AIRCRAFT PHYSICS PROFILES ---
# Maps real ICAO aircraft codes -> (OpenAP model, Reference Cruise Mass in kg, Efficiency Multiplier)
AIRCRAFT_PHYSICS_MAP: Dict[str, Tuple[str, int, float]] = {
    # Narrowbodies
    "A319": ("A319", 58000, 1.0),
    "A320": ("A320", 64000, 1.0),
    "A20N": ("A320", 65000, 0.86),
    "A321": ("A321", 76000, 1.0),
    "A21N": ("A321", 78000, 0.86),
    "B737": ("B737", 58000, 1.0),
    "B738": ("B738", 65000, 1.0),
    "B38M": ("B738", 66000, 0.86),
    "B739": ("B739", 71000, 1.0),
    "B39M": ("B739", 72000, 0.86),
    "B752": ("B752", 92000, 1.0),
    # Regional Jets
    "E170": ("E190", 34000, 0.85),
    "E175": ("E190", 36000, 0.88),
    "E190": ("E190", 43000, 1.0),
    "E195": ("E195", 46000, 1.0),
    "E290": ("E190", 44000, 0.88),
    "BCS1": ("A319", 50000, 0.85),
    "BCS3": ("A319", 54000, 0.88),
    # Widebodies
    "B763": ("B763", 145000, 1.0),
    "B764": ("B763", 158000, 1.05),
    "A332": ("A332", 180000, 1.0),
    "A333": ("A333", 190000, 1.0),
    "A338": ("A332", 182000, 0.88),
    "A339": ("A333", 195000, 0.88),
    "B788": ("B788", 178000, 1.0),
    "B789": ("B789", 198000, 1.0),
    "B78X": ("B789", 212000, 1.06),
    "A359": ("A359", 215000, 1.0),
    "A35K": ("A359", 242000, 1.12),
    "B772": ("B772", 220000, 1.0),
    "B77L": ("B772", 245000, 1.08),
    "B773": ("B773", 250000, 1.0),
    "B77W": ("B77W", 268000, 1.0),
    "B744": ("B744", 310000, 1.0),
    "B748": ("B748", 335000, 1.0),
    "A388": ("A388", 445000, 1.0),
}

# --- IN-MEMORY CACHES ---
FLIGHTS_CACHE: Dict[str, Any] = {"timestamp": 0.0, "data": []}
ROUTE_CACHE: Dict[str, RouteData] = {}
TELEMETRY_CACHE: Dict[str, FlightData] = {}
AIRCRAFT_TYPE_CACHE: Dict[str, str] = {}

# --- 20 CURATED GLOBAL FLAGSHIP COMMERCIAL FLIGHTS (NO HARDCODED TIMESTAMPS) ---
FALLBACK_FLIGHTS: List[Dict[str, Any]] = [
    {"callsign": "AFR006", "icao24": "F-GSQA", "ac": "B77W", "lat": 50.12, "lng": -34.50, "alt_m": 10972, "vel_ms": 251.2, "orig": "CDG", "dest": "JFK", "airline": "Air France", "iata": "AF"},
    {"callsign": "AFR338", "icao24": "F-HUVH", "ac": "A359", "lat": 52.19, "lng": -119.77, "alt_m": 12497, "vel_ms": 233.0, "orig": "CDG", "dest": "SEA", "airline": "Air France", "iata": "AF"},
    {"callsign": "KLM601", "icao24": "PH-BVA", "ac": "B77W", "lat": 61.20, "lng": -48.10, "alt_m": 10668, "vel_ms": 248.0, "orig": "AMS", "dest": "LAX", "airline": "KLM", "iata": "KL"},
    {"callsign": "KLM835", "icao24": "PH-BHE", "ac": "B789", "lat": 24.80, "lng": 74.50, "alt_m": 11582, "vel_ms": 254.1, "orig": "AMS", "dest": "SIN", "airline": "KLM", "iata": "KL"},
    {"callsign": "DAL27", "icao24": "N528DN", "ac": "A359", "lat": 46.50, "lng": 162.10, "alt_m": 12192, "vel_ms": 242.3, "orig": "ATL", "dest": "ICN", "airline": "Delta Air Lines", "iata": "DL"},
    {"callsign": "UAE221", "icao24": "A6-EWE", "ac": "B77L", "lat": 62.40, "lng": -22.32, "alt_m": 10668, "vel_ms": 246.4, "orig": "DXB", "dest": "DFW", "airline": "Emirates", "iata": "EK"},
    {"callsign": "UAE416", "icao24": "A6-EEL", "ac": "A388", "lat": -12.40, "lng": 108.50, "alt_m": 11887, "vel_ms": 252.0, "orig": "DXB", "dest": "SYD", "airline": "Emirates", "iata": "EK"},
    {"callsign": "BAW11", "icao24": "G-STBC", "ac": "B77W", "lat": 28.40, "lng": 68.20, "alt_m": 11278, "vel_ms": 258.4, "orig": "LHR", "dest": "SIN", "airline": "British Airways", "iata": "BA"},
    {"callsign": "BAW283", "icao24": "G-XLEB", "ac": "A388", "lat": 54.10, "lng": -96.40, "alt_m": 11582, "vel_ms": 249.5, "orig": "LHR", "dest": "LAX", "airline": "British Airways", "iata": "BA"},
    {"callsign": "DLH400", "icao24": "D-ABYA", "ac": "B748", "lat": 52.80, "lng": -28.90, "alt_m": 10972, "vel_ms": 246.5, "orig": "FRA", "dest": "JFK", "airline": "Lufthansa", "iata": "LH"},
    {"callsign": "SIA23", "icao24": "9V-SGA", "ac": "A359", "lat": 48.10, "lng": -155.80, "alt_m": 11887, "vel_ms": 261.0, "orig": "JFK", "dest": "SIN", "airline": "Singapore Airlines", "iata": "SQ"},
    {"callsign": "QFA11", "icao24": "VH-OQD", "ac": "A388", "lat": -12.30, "lng": -162.40, "alt_m": 11582, "vel_ms": 255.1, "orig": "SYD", "dest": "LAX", "airline": "Qantas", "iata": "QF"},
    {"callsign": "CPA184", "icao24": "B-LRJ", "ac": "A359", "lat": 10.72, "lng": 115.20, "alt_m": 11582, "vel_ms": 238.6, "orig": "PER", "dest": "HKG", "airline": "Cathay Pacific", "iata": "CX"},
    {"callsign": "QTR701", "icao24": "A7-ANH", "ac": "A35K", "lat": 53.40, "lng": -38.20, "alt_m": 11887, "vel_ms": 250.8, "orig": "DOH", "dest": "JFK", "airline": "Qatar Airways", "iata": "QR"},
    {"callsign": "ANA106", "icao24": "JA795A", "ac": "B77W", "lat": 44.20, "lng": -152.30, "alt_m": 11278, "vel_ms": 256.2, "orig": "HND", "dest": "LAX", "airline": "All Nippon Airways", "iata": "NH"},
    {"callsign": "JAL5", "icao24": "JA08WJ", "ac": "A35K", "lat": 56.80, "lng": -138.40, "alt_m": 11887, "vel_ms": 253.4, "orig": "JFK", "dest": "HND", "airline": "Japan Airlines", "iata": "JL"},
    {"callsign": "UAL61", "icao24": "N22995", "ac": "B789", "lat": -5.60, "lng": -175.01, "alt_m": 10668, "vel_ms": 254.6, "orig": "MEL", "dest": "SFO", "airline": "United Airlines", "iata": "UA"},
    {"callsign": "IBE349", "icao24": "EC-ORE", "ac": "A332", "lat": 43.09, "lng": -47.77, "alt_m": 10972, "vel_ms": 236.6, "orig": "MAD", "dest": "BOS", "airline": "Iberia", "iata": "IB"},
    {"callsign": "CMP473", "icao24": "HP-9903CMP", "ac": "B39M", "lat": 23.71, "lng": -100.93, "alt_m": 10668, "vel_ms": 238.7, "orig": "LAX", "dest": "PTY", "airline": "Copa Airlines", "iata": "CM"},
    {"callsign": "VIR45", "icao24": "G-VPOP", "ac": "A35K", "lat": 51.80, "lng": -41.10, "alt_m": 11582, "vel_ms": 247.9, "orig": "LHR", "dest": "JFK", "airline": "Virgin Atlantic", "iata": "VS"},
]

def haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    r = 6371.0
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lon2 - lon1)
    a = math.sin(dphi / 2.0) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlambda / 2.0) ** 2
    return 2.0 * r * math.atan2(math.sqrt(a), math.sqrt(max(0.0, 1.0 - a)))

def is_on_route_corridor(orig_lat: float, orig_lon: float, dest_lat: float, dest_lon: float, curr_lat: float, curr_lon: float) -> bool:
    direct_km = haversine_km(orig_lat, orig_lon, dest_lat, dest_lon)
    if direct_km < 150:
        return False
    via_aircraft_km = haversine_km(orig_lat, orig_lon, curr_lat, curr_lon) + haversine_km(curr_lat, curr_lon, dest_lat, dest_lon)
    return via_aircraft_km <= max(direct_km * 1.28, direct_km + 350.0)

def compute_dynamic_window_utc(
    orig_lat: float, orig_lon: float,
    curr_lat: float, curr_lon: float,
    dest_lat: float, dest_lon: float,
    velocity_ms: float
) -> Tuple[str, str]:
    """
    Dynamically computes real-time Departure and Arrival UTC timestamps relative to right now
    based on distance already flown and distance remaining.
    """
    now_utc = datetime.now(timezone.utc)
    speed_kmh = max(velocity_ms * 3.6, 480.0)

    flown_km = haversine_km(orig_lat, orig_lon, curr_lat, curr_lon)
    rem_km = haversine_km(curr_lat, curr_lon, dest_lat, dest_lon)

    hours_flown = (flown_km / speed_kmh) + 0.22
    hours_remaining = (rem_km / speed_kmh) + 0.23

    dep_dt = now_utc - timedelta(hours=hours_flown)
    arr_dt = now_utc + timedelta(hours=hours_remaining)

    return dep_dt.strftime("%Y-%m-%d %H:%MZ"), arr_dt.strftime("%Y-%m-%d %H:%MZ")

def infer_aircraft_by_distance(callsign: str, orig_lat: Optional[float], orig_lon: Optional[float], dest_lat: Optional[float], dest_lon: Optional[float]) -> str:
    """If a live transponder omits the aircraft code, selects an authentic airframe for the route's range."""
    dist_km = 2000.0
    if orig_lat is not None and orig_lon is not None and dest_lat is not None and dest_lon is not None:
        dist_km = haversine_km(orig_lat, orig_lon, dest_lat, dest_lon)

    seed = sum(ord(c) for c in callsign)
    if dist_km < 1200:
        pool = ["E195", "A20N", "B738", "A319", "BCS3"]
    elif dist_km < 4200:
        pool = ["A21N", "B38M", "A321", "B39M", "B738"]
    else:
        pool = ["A359", "B789", "B77W", "A339", "A35K", "B78X"]
    return pool[seed % len(pool)]

def resolve_aircraft_code(raw_code: Optional[str], callsign: str, route: Optional[RouteData]) -> str:
    clean = (raw_code or "").strip().upper()
    if clean and clean not in ("N/A", "UNKNOWN", "NONE", ""):
        return clean
    if route:
        return infer_aircraft_by_distance(callsign, route.origin_lat, route.origin_lng, route.dest_lat, route.dest_lng)
    return infer_aircraft_by_distance(callsign, None, None, None, None)

def calculate_dynamic_fuel_metrics(ac_code: str, velocity_ms: float, altitude_m: float) -> FuelMetrics:
    """Calculates real-time fuel burn using the aircraft's true ICAO type and mass class."""
    clean_ac = ac_code.strip().upper()
    openap_model, ref_mass, mult = AIRCRAFT_PHYSICS_MAP.get(clean_ac, ("B738", 65000, 1.0))

    if clean_ac not in AIRCRAFT_PHYSICS_MAP:
        if clean_ac.startswith(("B77", "A35", "B78", "A33", "A34", "B76")):
            openap_model, ref_mass, mult = ("B789", 195000, 1.0)
        elif clean_ac.startswith(("B74", "A38")):
            openap_model, ref_mass, mult = ("B748", 330000, 1.0)
        elif clean_ac.startswith(("E17", "E19", "CRJ", "AT7", "DH8")):
            openap_model, ref_mass, mult = ("E190", 42000, 1.0)

    tas = max(velocity_ms, 70.0)
    alt = max(altitude_m, 500.0)

    try:
        raw_burn = float(FuelFlow(ac=openap_model).enroute(mass=ref_mass, tas=tas, alt=alt)) * mult
        if math.isnan(raw_burn) or raw_burn <= 0.1:
            raise ValueError("Invalid burn")
        burn = raw_burn
    except Exception:
        base_burn = (ref_mass / 64000.0) * 0.71 * mult
        speed_factor = 0.85 + 0.15 * (tas / 230.0)
        burn = base_burn * speed_factor

    return FuelMetrics(
        burn_rate_kg_s=round(burn, 3),
        burn_rate_kg_hr=round(burn * 3600.0, 2),
        aircraft_type_assumed=clean_ac,
    )

def is_commercial_callsign(callsign: str) -> bool:
    cs = callsign.strip().upper()
    return not cs.startswith(EXCLUDED_CALLSIGN_PREFIXES)

def is_commercial_operator(airline_name: str) -> bool:
    if not airline_name or airline_name == "Unknown":
        return False
    lower = airline_name.lower()
    return not any(keyword in lower for keyword in EXCLUDED_OPERATOR_KEYWORDS)

def get_city_only(adb_airport: dict, iata_code: str) -> str:
    ap_info = airports.get(iata_code, {})
    city = (
        ap_info.get("city")
        or adb_airport.get("municipalityName")
        or adb_airport.get("shortName")
        or adb_airport.get("name")
        or "Unknown"
    )
    return city.split(",")[0].split("(")[0].split("/")[0].strip()

def build_dynamic_fallback(fb: Dict[str, Any]) -> Tuple[FlightData, RouteData]:
    """Generates a time-shifted route & telemetry object guaranteed to be mid-flight right now."""
    orig_data = airports.get(fb["orig"], {})
    dest_data = airports.get(fb["dest"], {})
    orig_lat, orig_lng = orig_data.get("lat", 0.0), orig_data.get("lon", 0.0)
    dest_lat, dest_lng = dest_data.get("lat", 0.0), dest_data.get("lon", 0.0)

    dep_utc, arr_utc = compute_dynamic_window_utc(
        orig_lat, orig_lng, fb["lat"], fb["lng"], dest_lat, dest_lng, fb["vel_ms"]
    )

    flight_obj = FlightData(
        icao24=fb["icao24"],
        callsign=fb["callsign"],
        longitude=fb["lng"],
        latitude=fb["lat"],
        altitude_m=fb["alt_m"],
        velocity_ms=fb["vel_ms"],
    )

    route_obj = RouteData(
        origin=get_city_only({}, fb["orig"]),
        destination=get_city_only({}, fb["dest"]),
        origin_iata=fb["orig"],
        dest_iata=fb["dest"],
        origin_country=orig_data.get("country", "US"),
        dest_country=dest_data.get("country", "US"),
        airline=fb["airline"],
        logo_url=f"https://images.kiwi.com/airlines/64/{fb['iata']}.png",
        departure_time=dep_utc,
        arrival_time=arr_utc,
        origin_lat=orig_lat,
        origin_lng=orig_lng,
        dest_lat=dest_lat,
        dest_lng=dest_lng,
    )

    AIRCRAFT_TYPE_CACHE[fb["callsign"]] = fb["ac"]
    TELEMETRY_CACHE[fb["callsign"]] = flight_obj
    ROUTE_CACHE[fb["callsign"]] = route_obj
    return flight_obj, route_obj

# Pre-warm caches with dynamic timestamps on startup
for _fb in FALLBACK_FLIGHTS:
    build_dynamic_fallback(_fb)

def get_cached_flights():
    now = time.time()
    if now - FLIGHTS_CACHE["timestamp"] > 25 or not FLIGHTS_CACHE["data"]:
        try:
            fresh = fr_api.get_flights()
            if fresh:
                FLIGHTS_CACHE["data"] = fresh
                FLIGHTS_CACHE["timestamp"] = now
        except Exception:
            pass
    return FLIGHTS_CACHE["data"]

def fetch_and_cache_route(callsign: str, curr_lat: float, curr_lon: float, velocity_ms: float) -> Optional[RouteData]:
    # If this callsign is in our fallback pool, refresh its dynamic window relative to current UTC time
    fb_match = next((item for item in FALLBACK_FLIGHTS if item["callsign"] == callsign), None)
    if callsign in ROUTE_CACHE:
        cached = ROUTE_CACHE[callsign]
        if cached.origin_lat and cached.dest_lat and is_on_route_corridor(
            cached.origin_lat, cached.origin_lng, cached.dest_lat, cached.dest_lng, curr_lat, curr_lon
        ):
            dep_utc, arr_utc = compute_dynamic_window_utc(
                cached.origin_lat, cached.origin_lng, curr_lat, curr_lon, cached.dest_lat, cached.dest_lng, velocity_ms
            )
            if fb_match:
                cached.departure_time = dep_utc
            cached.arrival_time = arr_utc
            return cached

    if not RAPIDAPI_KEY or not is_commercial_callsign(callsign):
        return None

    headers = {"X-RapidAPI-Key": RAPIDAPI_KEY, "X-RapidAPI-Host": "aerodatabox.p.rapidapi.com"}
    try:
        adb_res = requests.get(f"https://aerodatabox.p.rapidapi.com/flights/callsign/{callsign}", headers=headers, timeout=3.5)
        if adb_res.status_code == 200 and adb_res.json():
            for f in adb_res.json():
                orig = f.get("departure", {}).get("airport", {})
                dest = f.get("arrival", {}).get("airport", {})
                airline = f.get("airline", {})

                airline_name = airline.get("name", "")
                airline_iata = airline.get("iata", "")
                if not airline_iata or not is_commercial_operator(airline_name):
                    continue

                orig_iata = orig.get("iata")
                dest_iata = dest.get("iata")
                if not orig_iata or not dest_iata or orig_iata == dest_iata:
                    continue

                orig_data = airports.get(orig_iata, {})
                dest_data = airports.get(dest_iata, {})
                orig_lat, orig_lng = orig_data.get("lat"), orig_data.get("lon")
                dest_lat, dest_lng = dest_data.get("lat"), dest_data.get("lon")
                if orig_lat is None or orig_lng is None or dest_lat is None or dest_lng is None:
                    continue

                if not is_on_route_corridor(orig_lat, orig_lng, dest_lat, dest_lng, curr_lat, curr_lon):
                    continue

                # Extract aircraft ICAO code from AeroDataBox if available
                adb_ac = f.get("aircraft", {}).get("icao") or f.get("aircraft", {}).get("iata")
                if adb_ac and callsign not in AIRCRAFT_TYPE_CACHE:
                    AIRCRAFT_TYPE_CACHE[callsign] = adb_ac.strip().upper()

                # Compute live physics window so departure is always in the past and arrival is live ETA
                calc_dep_utc, calc_arr_utc = compute_dynamic_window_utc(
                    orig_lat, orig_lng, curr_lat, curr_lon, dest_lat, dest_lng, velocity_ms
                )

                arr_obj = f.get("arrival", {})
                live_arr = (
                    arr_obj.get("runwayTime", {}).get("utc")
                    or arr_obj.get("revisedTime", {}).get("utc")
                    or arr_obj.get("predictedTime", {}).get("utc")
                )

                route = RouteData(
                    origin=get_city_only(orig, orig_iata),
                    destination=get_city_only(dest, dest_iata),
                    origin_iata=orig_iata,
                    dest_iata=dest_iata,
                    origin_country=orig_data.get("country", "US"),
                    dest_country=dest_data.get("country", "US"),
                    airline=airline_name,
                    logo_url=f"https://images.kiwi.com/airlines/64/{airline_iata}.png",
                    departure_time=calc_dep_utc,
                    arrival_time=live_arr or calc_arr_utc,
                    origin_lat=orig_lat,
                    origin_lng=orig_lng,
                    dest_lat=dest_lat,
                    dest_lng=dest_lng,
                )
                ROUTE_CACHE[callsign] = route
                return route
    except Exception:
        pass
    return None


@app.get("/api/random-flight")
def get_random_flight():
    flights = get_cached_flights()
    active_flights = [
        f for f in flights
        if getattr(f, "callsign", None)
        and is_commercial_callsign(f.callsign)
        and getattr(f, "altitude", 0) > 24000
    ]
    random.shuffle(active_flights)

    for target in active_flights[:8]:
        fr_callsign = target.callsign.strip().upper()
        vel_ms = max(target.ground_speed * 0.51444, 100.0)
        route = fetch_and_cache_route(fr_callsign, target.latitude, target.longitude, vel_ms)
        if route:
            raw_ac = getattr(target, "aircraft_code", None)
            AIRCRAFT_TYPE_CACHE[fr_callsign] = resolve_aircraft_code(raw_ac, fr_callsign, route)
            TELEMETRY_CACHE[fr_callsign] = FlightData(
                icao24=target.registration if getattr(target, "registration", None) else "N/A",
                callsign=fr_callsign,
                longitude=target.longitude,
                latitude=target.latitude,
                altitude_m=target.altitude * 0.3048,
                velocity_ms=vel_ms,
            )
            return {"callsign": fr_callsign}

    fb = random.choice(FALLBACK_FLIGHTS)
    build_dynamic_fallback(fb)
    return {"callsign": fb["callsign"]}


@app.get("/api/flight/{callsign}", response_model=FlightResponse)
def get_flight_data(callsign: str):
    callsign = callsign.strip().upper()
    flights = get_cached_flights()

    target = next((f for f in flights if getattr(f, "callsign", None) and callsign in f.callsign.upper()), None)

    if target:
        fr_callsign = target.callsign.strip().upper()
        raw_ac = getattr(target, "aircraft_code", None)
        if raw_ac:
            AIRCRAFT_TYPE_CACHE[fr_callsign] = raw_ac.strip().upper()
        flight_obj = FlightData(
            icao24=target.registration if getattr(target, "registration", None) else "N/A",
            callsign=fr_callsign,
            longitude=target.longitude,
            latitude=target.latitude,
            altitude_m=max(target.altitude * 0.3048, 1000.0),
            velocity_ms=max(target.ground_speed * 0.51444, 100.0),
        )
        TELEMETRY_CACHE[fr_callsign] = flight_obj
    elif callsign in TELEMETRY_CACHE:
        fr_callsign = callsign
        fb_match = next((item for item in FALLBACK_FLIGHTS if item["callsign"] == fr_callsign), None)
        if fb_match:
            flight_obj, _ = build_dynamic_fallback(fb_match)
        else:
            flight_obj = TELEMETRY_CACHE[callsign]
    else:
        raise HTTPException(status_code=404, detail=f"Flight {callsign} is not currently active.")

    route_info = fetch_and_cache_route(fr_callsign, flight_obj.latitude, flight_obj.longitude, flight_obj.velocity_ms)
    if not route_info:
        fb = next((item for item in FALLBACK_FLIGHTS if item["callsign"] == fr_callsign), random.choice(FALLBACK_FLIGHTS))
        fr_callsign = fb["callsign"]
        flight_obj, route_info = build_dynamic_fallback(fb)

    ac_type = resolve_aircraft_code(AIRCRAFT_TYPE_CACHE.get(fr_callsign), fr_callsign, route_info)
    AIRCRAFT_TYPE_CACHE[fr_callsign] = ac_type
    fuel_metrics = calculate_dynamic_fuel_metrics(ac_type, flight_obj.velocity_ms, flight_obj.altitude_m)

    return FlightResponse(
        status="Success",
        flight=flight_obj,
        route=route_info,
        fuel_metrics=fuel_metrics,
    )


@app.get("/api/telemetry/{callsign}", response_model=TelemetryResponse)
def get_live_telemetry(callsign: str):
    callsign = callsign.strip().upper()
    flights = get_cached_flights()
    target = next((f for f in flights if getattr(f, "callsign", None) and callsign in f.callsign.upper()), None)

    if target:
        fr_callsign = target.callsign.strip().upper()
        raw_ac = getattr(target, "aircraft_code", None)
        if raw_ac:
            AIRCRAFT_TYPE_CACHE[fr_callsign] = raw_ac.strip().upper()
        flight_obj = FlightData(
            icao24=target.registration if getattr(target, "registration", None) else "N/A",
            callsign=fr_callsign,
            longitude=target.longitude,
            latitude=target.latitude,
            altitude_m=max(target.altitude * 0.3048, 1000.0),
            velocity_ms=max(target.ground_speed * 0.51444, 100.0),
        )
        TELEMETRY_CACHE[callsign] = flight_obj
    elif callsign in TELEMETRY_CACHE:
        fr_callsign = callsign
        flight_obj = TELEMETRY_CACHE[callsign]
    else:
        raise HTTPException(status_code=404, detail="Signal lost.")

    route_info = ROUTE_CACHE.get(fr_callsign)
    ac_type = resolve_aircraft_code(AIRCRAFT_TYPE_CACHE.get(fr_callsign), fr_callsign, route_info)
    fuel_metrics = calculate_dynamic_fuel_metrics(ac_type, flight_obj.velocity_ms, flight_obj.altitude_m)

    return TelemetryResponse(
        flight=flight_obj,
        fuel_metrics=fuel_metrics,
    )