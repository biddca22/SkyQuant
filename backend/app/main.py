import os
import requests
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv
from openap import FuelFlow

# Load environment variables
load_dotenv(dotenv_path="../.env")
USERNAME = os.getenv("OPENSKY_USERNAME")
PASSWORD = os.getenv("OPENSKY_PASSWORD")
AUTH = (USERNAME, PASSWORD) if USERNAME and PASSWORD else None

# Initialise the enterprise API
app = FastAPI(
    title="SkyQuant Engine",
    description="Real-time flight telemetry, trajectory optimisation, and fuel analytics API",
    version="1.0.0"
)

# Configure CORS for the Next.js frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- Pydantic Data Models ---
class HealthCheck(BaseModel):
    status: str
    message: str

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
    fuel_metrics: FuelMetrics

# --- API Endpoints ---
@app.get("/", response_model=HealthCheck)
def health_check():
    """Root endpoint to verify the backend server is operational."""
    return HealthCheck(
        status="Operational",
        message="SkyQuant Data Pipeline is successfully routed."
    )

@app.get("/api/flight/{callsign}", response_model=FlightResponse)
def get_flight_data(callsign: str):
    """
    Scans global airspace for a specific flight callsign, retrieves its 3D telemetry, 
    and calculates real-time operational fuel consumption.
    """
    callsign = callsign.strip().upper()
    url = "https://opensky-network.org/api/states/all"
    
    try:
        # Fetch global airspace data (this may take 2-4 seconds)
        response = requests.get(url, auth=AUTH, timeout=15)
        response.raise_for_status()
        data = response.json()
        
        states = data.get("states", [])
        
        # Search the globe for the requested callsign
        target_flight = None
        for state in states:
            current_callsign = (state[1] or "").strip().upper()
            if current_callsign == callsign:
                target_flight = state
                break
                
        if not target_flight:
            raise HTTPException(status_code=404, detail=f"Flight {callsign} not found in live global airspace.")
            
        # Extract telemetry
        icao24 = target_flight[0]
        longitude = target_flight[5]
        latitude = target_flight[6]
        altitude_m = target_flight[7]
        velocity_ms = target_flight[9]
        
        # Validate critical data exists for physics calculations
        if altitude_m is None or velocity_ms is None or longitude is None or latitude is None:
            raise HTTPException(status_code=422, detail="Incomplete telemetry data for this flight. Cannot calculate metrics.")
            
        # Initialise physics engine and calculate fuel
        aircraft_type = "A320" # Defaulting to A320 for the prototype
        fuelflow = FuelFlow(ac=aircraft_type)
        burn_rate = fuelflow.enroute(mass=64000, tas=velocity_ms, alt=altitude_m)
        
        return FlightResponse(
            status="Success",
            flight=FlightData(
                icao24=icao24,
                callsign=callsign,
                longitude=longitude,
                latitude=latitude,
                altitude_m=altitude_m,
                velocity_ms=velocity_ms
            ),
            fuel_metrics=FuelMetrics(
                burn_rate_kg_s=round(burn_rate, 3),
                burn_rate_kg_hr=round(burn_rate * 3600, 2),
                aircraft_type_assumed=aircraft_type
            )
        )
        
    except requests.exceptions.RequestException as e:
        raise HTTPException(status_code=503, detail=f"Failed to connect to OpenSky telemetry: {e}")