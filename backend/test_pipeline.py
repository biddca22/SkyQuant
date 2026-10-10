import os
import requests
from dotenv import load_dotenv
from openap import FuelFlow

# 1. Load credentials from .env file
load_dotenv(dotenv_path="../.env")
username = os.getenv("OPENSKY_USERNAME")
password = os.getenv("OPENSKY_PASSWORD")
auth = (username, password) if username and password else None

print("Fetching live flights over France & Spain...")
# Bounding box covering France and Spain airspace
url = "https://opensky-network.org/api/states/all?lamin=35.0&lomin=-10.0&lamax=51.0&lomax=10.0"

try:
    # 2. Query the OpenSky Network API
    response = requests.get(url, auth=auth, timeout=10)
    response.raise_for_status()
    data = response.json()
    
    states = data.get("states", [])
    print(f"Total live aircraft detected: {len(states)}")
    
    if states:
        # Find the first flight with valid altitude and speed data
        valid_flight = None
        for state in states:
            if state[7] is not None and state[9] is not None:
                valid_flight = state
                break
                
        if valid_flight:
            icao24 = valid_flight[0]
            callsign = (valid_flight[1] or "UNKNOWN").strip()
            altitude_m = valid_flight[7]  
            velocity_ms = valid_flight[9] 
            
            print(f"\n--- Sample Flight Selected ---")
            print(f"Callsign: {callsign} | ICAO24: {icao24}")
            print(f"Altitude: {altitude_m} meters | Speed: {velocity_ms} m/s")
            
            # 3. Test OpenAP Fuel Flow Calculation
            print("\nRunning ML/Physics Fuel Calculation (OpenAP)...")
            aircraft_type = "A320" # Assuming A320 (Air France's primary short-haul aeroplane)
            
            # Initialise the physics engine using the correct positional argument
            fuelflow = FuelFlow(ac=aircraft_type)
            
            # Calculate en-route fuel burn assuming a standard mass of 64,000 kg
            fuel_burn_rate = fuelflow.enroute(mass=64000, tas=velocity_ms, alt=altitude_m)
            
            print(f"Estimated fuel burn rate (A320 profile): {fuel_burn_rate:.3f} kg/s")
            print(f"Estimated fuel burn per hour: {fuel_burn_rate * 3600:.2f} kg/hr")
            print("\nSUCCESS: SkyQuant Data Pipeline and Physics Engine are fully operational!")
        else:
            print("No flights with complete altitude/speed data found right now. Try again in a minute.")
except Exception as e:
    print(f"Error connecting to API: {e}")