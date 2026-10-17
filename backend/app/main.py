import os
import random
import requests
import airportsdata
from typing import Optional
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv
from openap import FuelFlow
from FlightRadarAPI import FlightRadar24API

load_dotenv(dotenv_path="../.env")
RAPIDAPI_KEY = os.getenv("RAPIDAPI_KEY")

# Load airport GPS coordinates dictionary
airports = airportsdata.load('IATA')

# Initialize FlightRadar24 API (Bypasses OpenSky rate limits)
fr_api = FlightRadar24API()

app = FastAPI(title="SkyQuant Engine", version="2.2.0")

app.add_middleware(
    CORSMiddleware, allow_origins=["*"], allow_credentials=True,
    allow_methods=["*"], allow_headers=["*"],
)

class RouteData(BaseModel):
    origin: str
    destination: str
    airline: str
    logo_url: str
    departure_time: str
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


# --- Intelligent Airspace Scanner ---
@app.get("/api/random-flight")
def get_random_flight():
    try:
        flights = fr_api.get_flights()
        
        # Filter for active commercial flights cruising above 24,000 feet
        valid_flights = [f for f in flights if f.callsign and f.altitude > 24000]
        
        if not valid_flights:
            raise HTTPException(status_code=404, detail="No active flights found.")
            
        target = random.choice(valid_flights)
        return {"callsign": target.callsign.strip()}
    except Exception as e:
        raise HTTPException(status_code=503, detail=f"Radar offline: {e}")


@app.get("/api/flight/{callsign}", response_model=FlightResponse)
def get_flight_data(callsign: str):
    callsign = callsign.strip().upper()
    
    # 1. Telemetry via FlightRadar24
    try:
        flights = fr_api.get_flights()
        target = next((f for f in flights if f.callsign and f.callsign.strip().upper() == callsign), None)
        
        if not target:
            raise HTTPException(status_code=404, detail=f"Flight {callsign} not found in live airspace.")
            
        # Convert FR24 Imperial units to Metric
        altitude_m = target.altitude * 0.3048
        velocity_ms = target.ground_speed * 0.51444
        
        icao24 = target.registration if target.registration else "UNKNOWN"
        longitude = target.longitude
        latitude = target.latitude
        
    except Exception as e:
        raise HTTPException(status_code=503, detail=f"FlightRadar24 Error: {e}")

    # 2. Route & Coordinates (AeroDataBox via RapidAPI)
    route_info = RouteData(origin="Unknown", destination="Unknown", airline="Unknown", logo_url="", departure_time="Unknown")
    
    if RAPIDAPI_KEY:
        headers = {"X-RapidAPI-Key": RAPIDAPI_KEY, "X-RapidAPI-Host": "aerodatabox.p.rapidapi.com"}
        try:
            adb_res = requests.get(f"https://aerodatabox.p.rapidapi.com/flights/callsign/{callsign}", headers=headers, timeout=10)
            if adb_res.status_code == 200 and adb_res.json():
                f = adb_res.json()[0]
                orig, dest, airline = f.get("departure", {}).get("airport", {}), f.get("arrival", {}).get("airport", {}), f.get("airline", {})
                
                orig_iata, dest_iata = orig.get("iata", ""), dest.get("iata", "")
                
                orig_data = airports.get(orig_iata, {})
                dest_data = airports.get(dest_iata, {})
                raw_time = f.get("departure", {}).get("scheduledTime", {}).get("utc", "Unknown")
                
                route_info = RouteData(
                    origin=f"{orig.get('name', 'Unknown')} ({orig_iata})",
                    destination=f"{dest.get('name', 'Unknown')} ({dest_iata})",
                    airline=airline.get("name", "Unknown"),
                    logo_url=f"https://images.kiwi.com/airlines/64/{airline.get('iata', '')}.png" if airline.get("iata") else "",
                    departure_time=raw_time.replace("Z", " UTC").replace("T", " ") if raw_time != "Unknown" else raw_time,
                    origin_lat=orig_data.get('lat'),
                    origin_lng=orig_data.get('lon'),
                    dest_lat=dest_data.get('lat'),
                    dest_lng=dest_data.get('lon')
                )
        except Exception as e:
            print(f"Route warning: {e}")

    # 3. Physics (OpenAP)
    try:
        burn = FuelFlow(ac="A320").enroute(mass=64000, tas=max(velocity_ms, 50), alt=max(altitude_m, 100))
    except Exception:
        burn = 0.0
    
    return FlightResponse(
        status="Success",
        flight=FlightData(icao24=icao24, callsign=callsign, longitude=longitude, latitude=latitude, altitude_m=altitude_m, velocity_ms=velocity_ms),
        route=route_info,
        fuel_metrics=FuelMetrics(burn_rate_kg_s=round(burn, 3), burn_rate_kg_hr=round(burn * 3600, 2), aircraft_type_assumed="A320")
    )

@app.get("/api/telemetry/{callsign}", response_model=TelemetryResponse)
def get_live_telemetry(callsign: str):
    callsign = callsign.strip().upper()
    try:
        flights = fr_api.get_flights()
        target = next((f for f in flights if f.callsign and f.callsign.strip().upper() == callsign), None)
        
        if not target:
            raise HTTPException(status_code=404, detail="Flight signal temporarily lost.")
            
        altitude_m = target.altitude * 0.3048
        velocity_ms = target.ground_speed * 0.51444
            
        try:
            burn = FuelFlow(ac="A320").enroute(mass=64000, tas=max(velocity_ms, 50), alt=max(altitude_m, 100))
        except Exception:
            burn = 0.0
        
        return TelemetryResponse(
            flight=FlightData(icao24=target.registration if target.registration else "UNKNOWN", callsign=callsign, longitude=target.longitude, latitude=target.latitude, altitude_m=altitude_m, velocity_ms=velocity_ms),
            fuel_metrics=FuelMetrics(burn_rate_kg_s=round(burn, 3), burn_rate_kg_hr=round(burn * 3600, 2), aircraft_type_assumed="A320")
        )
    except Exception as e:
        raise HTTPException(status_code=503, detail=f"Radar Error: {e}")