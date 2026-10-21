import os
import re
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

app = FastAPI(title="SkyQuant Engine", version="4.2.0")

app.add_middleware(
    CORSMiddleware, allow_origins=["*"], allow_credentials=True,
    allow_methods=["*"], allow_headers=["*"],
)

class RouteData(BaseModel):
    origin: str; destination: str; origin_iata: str; dest_iata: str; origin_country: str; dest_country: str
    airline: str; logo_url: str; departure_time: str; arrival_time: str
    origin_lat: Optional[float] = None; origin_lng: Optional[float] = None
    dest_lat: Optional[float] = None; dest_lng: Optional[float] = None

class FuelMetrics(BaseModel):
    burn_rate_kg_s: float; burn_rate_kg_hr: float; aircraft_type_assumed: str

class FlightData(BaseModel):
    icao24: str; callsign: str; longitude: float; latitude: float; altitude_m: float; velocity_ms: float
    heading_deg: float = 0.0

class FlightResponse(BaseModel):
    status: str; flight: FlightData; route: RouteData; fuel_metrics: FuelMetrics

class TelemetryResponse(BaseModel):
    flight: FlightData; fuel_metrics: FuelMetrics

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

# Comprehensive ICAO -> Clean Display Airline Name & IATA code map
AIRLINE_MASTER: Dict[str, Tuple[str, str]] = {
    "DAL": ("Delta Air Lines", "DL"), "AAL": ("American Airlines", "AA"), "UAL": ("United Airlines", "UA"),
    "SWA": ("Southwest Airlines", "WN"), "JBU": ("JetBlue Airways", "B6"), "ASA": ("Alaska Airlines", "AS"),
    "NKS": ("Spirit Airlines", "NK"), "FFT": ("Frontier Airlines", "F9"), "HAL": ("Hawaiian Airlines", "HA"),
    "ACA": ("Air Canada", "AC"), "WJA": ("WestJet", "WS"), "TSC": ("Air Transat", "TS"),
    "AMX": ("Aeroméxico", "AM"), "VOI": ("Volaris", "Y4"), "VIV": ("Viva Aerobus", "VB"),
    "CMP": ("Copa Airlines", "CM"), "AVA": ("Avianca", "AV"), "LAN": ("LATAM Airlines", "LA"),
    "TAM": ("LATAM Brasil", "JJ"), "LNE": ("LATAM Ecuador", "XL"), "LPE": ("LATAM Perú", "LP"),
    "GLO": ("GOL Linhas Aéreas", "G3"), "AZU": ("Azul Brazilian Airlines", "AD"), "ARG": ("Aerolíneas Argentinas", "AR"),
    "BAW": ("British Airways", "BA"), "VIR": ("Virgin Atlantic", "VS"), "EZY": ("easyJet", "U2"),
    "EJU": ("easyJet", "EC"), "EZS": ("easyJet", "DS"), "RYR": ("Ryanair", "FR"),
    "RUK": ("Ryanair", "RK"), "MAY": ("Malta Air", "AL"), "buzz": ("Buzz", "RR"),
    "EIN": ("Aer Lingus", "EI"), "AFR": ("Air France", "AF"), "KLM": ("KLM", "KL"),
    "KLC": ("KLM", "WA"), "TRA": ("Transavia", "HV"), "TVF": ("Transavia France", "TO"),
    "DLH": ("Lufthansa", "LH"), "CLH": ("Lufthansa", "CL"), "EWG": ("Eurowings", "EW"),
    "CFG": ("Condor", "DE"), "SWR": ("SWISS", "LX"), "AUA": ("Austrian Airlines", "OS"),
    "BEL": ("Brussels Airlines", "SN"), "IBE": ("Iberia", "IB"), "IBS": ("Iberia Express", "I2"),
    "AEA": ("Air Europa", "UX"), "VLG": ("Vueling", "VY"), "ITY": ("ITA Airways", "AZ"),
    "TAP": ("TAP Air Portugal", "TP"), "SAS": ("SAS", "SK"), "FIN": ("Finnair", "AY"),
    "NAX": ("Norwegian", "DY"), "NSZ": ("Norwegian", "D8"), "ICE": ("Icelandair", "FI"),
    "LOT": ("LOT Polish Airlines", "LO"), "WZZ": ("Wizz Air", "W6"), "WMT": ("Wizz Air", "W4"),
    "WUK": ("Wizz Air", "W9"), "AEE": ("Aegean Airlines", "A3"), "THY": ("Turkish Airlines", "TK"),
    "PGT": ("Pegasus Airlines", "PC"), "SXS": ("SunExpress", "XQ"), "BTI": ("airBaltic", "BT"),
    "ROU": ("TAROM", "RO"), "LZB": ("Bulgaria Air", "FB"), "CTN": ("Croatia Airlines", "OU"),
    "ASL": ("Air Serbia", "JU"), "EXS": ("Jet2", "LS"), "TOM": ("TUI Airways", "BY"),
    "TFL": ("TUI fly Netherlands", "OR"), "TUI": ("TUI fly", "X3"), "JAF": ("TUI fly Belgium", "TB"),
    "UAE": ("Emirates", "EK"), "ETD": ("Etihad Airways", "EY"), "QTR": ("Qatar Airways", "QR"),
    "FDB": ("flydubai", "FZ"), "ABY": ("Air Arabia", "G9"), "SVA": ("Saudia", "SV"),
    "KNE": ("flynas", "XY"), "GFG": ("Gulf Air", "GF"), "OMA": ("Oman Air", "WY"),
    "KAC": ("Kuwait Airways", "KU"), "RJA": ("Royal Jordanian", "RJ"), "MEA": ("Middle East Airlines", "ME"),
    "ELY": ("El Al", "LY"), "MSR": ("EgyptAir", "MS"), "RAM": ("Royal Air Maroc", "AT"),
    "ETH": ("Ethiopian Airlines", "ET"), "KQA": ("Kenya Airways", "KQ"), "SAA": ("South African Airways", "SA"),
    "LNK": ("Airlink", "4Z"), "MAU": ("Air Mauritius", "MK"), "RWD": ("RwandAir", "WB"),
    "SIA": ("Singapore Airlines", "SQ"), "TGW": ("Scoot", "TR"), "CPA": ("Cathay Pacific", "CX"),
    "HKE": ("HK Express", "UO"), "CRK": ("Hong Kong Airlines", "HX"), "ANA": ("All Nippon Airways", "NH"),
    "JAL": ("Japan Airlines", "JL"), "APJ": ("Peach Aviation", "MM"), "JJP": ("Jetstar Japan", "GK"),
    "KAL": ("Korean Air", "KE"), "AAR": ("Asiana Airlines", "OZ"), "JNA": ("Jin Air", "LJ"),
    "TWB": ("T'way Air", "TW"), "JJA": ("Jeju Air", "7C"), "CAL": ("China Airlines", "CI"),
    "EVA": ("EVA Air", "BR"), "SJX": ("STARLUX Airlines", "JX"), "CCA": ("Air China", "CA"),
    "CSN": ("China Southern Airlines", "CZ"), "CES": ("China Eastern Airlines", "MU"),
    "CHH": ("Hainan Airlines", "HU"), "CXA": ("XiamenAir", "MF"), "CSC": ("Sichuan Airlines", "3U"),
    "CSZ": ("Shenzhen Airlines", "ZH"), "DKH": ("Juneyao Air", "HO"), "CQH": ("Spring Airlines", "9C"),
    "AIC": ("Air India", "AI"), "AXB": ("Air India Express", "IX"), "IGO": ("IndiGo", "6E"),
    "SEJ": ("SpiceJet", "SG"), "AKJ": ("Akasa Air", "QP"), "MAS": ("Malaysia Airlines", "MH"),
    "AXM": ("AirAsia", "AK"), "XAX": ("AirAsia X", "D7"), "TAA": ("Thai AirAsia", "FD"),
    "AWQ": ("Indonesia AirAsia", "QZ"), "APG": ("Philippines AirAsia", "Z2"), "THA": ("Thai Airways", "TG"),
    "BKP": ("Bangkok Airways", "PG"), "HVN": ("Vietnam Airlines", "VN"), "VJC": ("VietJet Air", "VJ"),
    "BAV": ("Bamboo Airways", "QH"), "GIA": ("Garuda Indonesia", "GA"), "BTK": ("Batik Air", "ID"),
    "LNI": ("Lion Air", "JT"), "PAL": ("Philippine Airlines", "PR"), "CEB": ("Cebu Pacific", "5J"),
    "QFA": ("Qantas", "QF"), "QLK": ("QantasLink", "QF"), "JST": ("Jetstar", "JQ"),
    "VOZ": ("Virgin Australia", "VA"), "ANZ": ("Air New Zealand", "NZ"), "FJI": ("Fiji Airways", "FJ"),
}

# Dynamic cache populated from FR24's airline catalog at startup
FR24_AIRLINE_DB: Dict[str, Tuple[str, str]] = {}

def init_fr24_airlines():
    try:
        for a in fr_api.get_airlines():
            icao = (a.get("ICAO") or "").strip().upper()
            iata = (a.get("Code") or "").strip().upper()
            name = (a.get("Name") or "").strip()
            if icao and name:
                FR24_AIRLINE_DB[icao] = (name, iata)
    except Exception:
        pass

init_fr24_airlines()

# Metropolitan City Override Dictionary (Prevents suburban municipality names like Richmond, Mississauga, Roissy, etc.)
METRO_CITY_MAP: Dict[str, str] = {
    "YVR": "Vancouver", "YYZ": "Toronto", "YTZ": "Toronto", "YUL": "Montreal", "YYC": "Calgary",
    "YEG": "Edmonton", "YOW": "Ottawa", "YWG": "Winnipeg", "YHZ": "Halifax", "YQB": "Quebec City",
    "JFK": "New York", "LGA": "New York", "EWR": "Newark", "IAD": "Washington D.C.", "DCA": "Washington D.C.",
    "BWI": "Baltimore", "ORD": "Chicago", "MDW": "Chicago", "LAX": "Los Angeles", "BUR": "Los Angeles",
    "SNA": "Orange County", "ONT": "Ontario", "SFO": "San Francisco", "OAK": "Oakland", "SJC": "San Jose",
    "DFW": "Dallas", "DAL": "Dallas", "IAH": "Houston", "HOU": "Houston", "MIA": "Miami", "FLL": "Fort Lauderdale",
    "PBI": "West Palm Beach", "MCO": "Orlando", "SFB": "Orlando", "TPA": "Tampa", "ATL": "Atlanta",
    "BOS": "Boston", "DTW": "Detroit", "MSP": "Minneapolis", "SEA": "Seattle", "DEN": "Denver",
    "PHX": "Phoenix", "LAS": "Las Vegas", "SLC": "Salt Lake City", "SAN": "San Diego", "PDX": "Portland",
    "PHL": "Philadelphia", "CLT": "Charlotte", "RDU": "Raleigh", "BNA": "Nashville", "AUS": "Austin",
    "MSY": "New Orleans", "STL": "St. Louis", "MCI": "Kansas City", "CVG": "Cincinnati", "PIT": "Pittsburgh",
    "CLE": "Cleveland", "CMH": "Columbus", "IND": "Indianapolis", "MKE": "Milwaukee", "SAT": "San Antonio",
    "HNL": "Honolulu", "OGG": "Maui", "ANC": "Anchorage", "SJU": "San Juan",
    "MEX": "Mexico City", "NLU": "Mexico City", "CUN": "Cancún", "GDL": "Guadalajara", "MTY": "Monterrey",
    "SJD": "Los Cabos", "PVR": "Puerto Vallarta", "PTY": "Panama City", "SJO": "San José", "SAL": "San Salvador",
    "GUA": "Guatemala City", "BOG": "Bogotá", "MDE": "Medellín", "CLO": "Cali", "CTG": "Cartagena",
    "LIM": "Lima", "CUZ": "Cusco", "UIO": "Quito", "GYE": "Guayaquil", "SCL": "Santiago",
    "EZE": "Buenos Aires", "AEP": "Buenos Aires", "COR": "Córdoba", "MDZ": "Mendoza", "MVD": "Montevideo",
    "ASU": "Asunción", "VVI": "Santa Cruz", "LPB": "La Paz", "CCS": "Caracas",
    "GRU": "São Paulo", "CGH": "São Paulo", "VCP": "São Paulo", "GIG": "Rio de Janeiro", "SDU": "Rio de Janeiro",
    "BSB": "Brasília", "CNF": "Belo Horizonte", "SSA": "Salvador", "REC": "Recife", "FOR": "Fortaleza",
    "POA": "Porto Alegre", "CWB": "Curitiba", "BEL": "Belém", "FLN": "Florianópolis",
    "LHR": "London", "LGW": "London", "STN": "London", "LTN": "London", "LCY": "London", "SEN": "London",
    "MAN": "Manchester", "BHX": "Birmingham", "EDI": "Edinburgh", "GLA": "Glasgow", "BRS": "Bristol",
    "NCL": "Newcastle", "LPL": "Liverpool", "EMA": "Nottingham", "LBA": "Leeds", "BFS": "Belfast", "BHD": "Belfast",
    "DUB": "Dublin", "SNN": "Shannon", "ORK": "Cork",
    "CDG": "Paris", "ORY": "Paris", "BVA": "Paris", "NCE": "Nice", "LYS": "Lyon", "MRS": "Marseille",
    "TLS": "Toulouse", "BOD": "Bordeaux", "NTE": "Nantes", "SXB": "Strasbourg", "LIL": "Lille", "BSL": "Basel",
    "AMS": "Amsterdam", "EIN": "Eindhoven", "RTM": "Rotterdam", "BRU": "Brussels", "CRL": "Brussels", "LUX": "Luxembourg",
    "FRA": "Frankfurt", "HHN": "Frankfurt", "MUC": "Munich", "BER": "Berlin", "DUS": "Düsseldorf",
    "HAM": "Hamburg", "STR": "Stuttgart", "CGN": "Cologne", "HAJ": "Hanover", "NUE": "Nuremberg", "LEJ": "Leipzig",
    "ZRH": "Zurich", "GVA": "Geneva", "VIE": "Vienna", "SZG": "Salzburg", "INN": "Innsbruck",
    "MAD": "Madrid", "BCN": "Barcelona", "PMI": "Palma de Mallorca", "AGP": "Málaga", "ALC": "Alicante",
    "VLC": "Valencia", "SVQ": "Seville", "BIO": "Bilbao", "TFN": "Tenerife", "TFS": "Tenerife",
    "LPA": "Gran Canaria", "ACE": "Lanzarote", "FUE": "Fuerteventura", "IBZ": "Ibiza", "SCQ": "Santiago de Compostela",
    "LIS": "Lisbon", "OPO": "Porto", "FAO": "Faro", "FNC": "Madeira", "PDL": "Ponta Delgada",
    "FCO": "Rome", "CIA": "Rome", "MXP": "Milan", "LIN": "Milan", "BGY": "Milan", "VCE": "Venice",
    "TSF": "Venice", "NAP": "Naples", "BLQ": "Bologna", "FLR": "Florence", "PSA": "Pisa", "CTA": "Catania",
    "PMO": "Palermo", "BRI": "Bari", "TRN": "Turin", "VRN": "Verona", "OLB": "Olbia", "CAG": "Cagliari",
    "CPH": "Copenhagen", "BLL": "Billund", "OSL": "Oslo", "TRF": "Oslo", "BGO": "Bergen", "SVG": "Stavanger",
    "TOS": "Tromsø", "ARN": "Stockholm", "NYO": "Stockholm", "BMA": "Stockholm", "GOT": "Gothenburg",
    "MMX": "Malmö", "HEL": "Helsinki", "RVN": "Rovaniemi", "KEF": "Reykjavik", "RKV": "Reykjavik",
    "WAW": "Warsaw", "WMI": "Warsaw", "KRK": "Kraków", "GDN": "Gdańsk", "KTW": "Katowice", "WRO": "Wrocław",
    "PRG": "Prague", "BUD": "Budapest", "OTP": "Bucharest", "CLJ": "Cluj-Napoca", "SOF": "Sofia",
    "BEG": "Belgrade", "ZAG": "Zagreb", "SPU": "Split", "DBV": "Dubrovnik", "LJU": "Ljubljana",
    "TIA": "Tirana", "SKP": "Skopje", "SJJ": "Sarajevo", "PRN": "Pristina", "TGD": "Podgorica",
    "ATH": "Athens", "SKG": "Thessaloniki", "HER": "Heraklion", "RHO": "Rhodes", "CFU": "Corfu",
    "JTR": "Santorini", "JMK": "Mykonos", "CHQ": "Chania", "LCA": "Larnaca", "PFO": "Paphos", "MLA": "Malta",
    "IST": "Istanbul", "SAW": "Istanbul", "AYT": "Antalya", "ESB": "Ankara", "ADB": "Izmir", "DLM": "Dalaman", "BJV": "Bodrum",
    "RIX": "Riga", "TLL": "Tallinn", "VNO": "Vilnius",
    "DXB": "Dubai", "DWC": "Dubai", "AUH": "Abu Dhabi", "SHJ": "Sharjah", "DOH": "Doha",
    "RUH": "Riyadh", "JED": "Jeddah", "DMM": "Dammam", "MED": "Medina", "MCT": "Muscat",
    "KWI": "Kuwait City", "BAH": "Bahrain", "AMM": "Amman", "BEY": "Beirut", "TLV": "Tel Aviv", "BGW": "Baghdad",
    "CAI": "Cairo", "SPX": "Cairo", "HRG": "Hurghada", "SSH": "Sharm El Sheikh", "CMN": "Casablanca",
    "RAK": "Marrakech", "AGA": "Agadir", "TNG": "Tangier", "TUN": "Tunis", "ALG": "Algiers",
    "ADD": "Addis Ababa", "NBO": "Nairobi", "MBA": "Mombasa", "DAR": "Dar es Salaam", "ZNZ": "Zanzibar",
    "EBB": "Entebbe", "KGL": "Kigali", "LOS": "Lagos", "ABV": "Abuja", "ACC": "Accra", "DSS": "Dakar",
    "ABJ": "Abidjan", "JNB": "Johannesburg", "CPT": "Cape Town", "DUR": "Durban", "MPM": "Maputo",
    "MRU": "Mauritius", "SEZ": "Mahé", "TNR": "Antananarivo", "LUN": "Lusaka", "HRE": "Harare", "WDH": "Windhoek",
    "DEL": "New Delhi", "BOM": "Mumbai", "BLR": "Bengaluru", "MAA": "Chennai", "HYD": "Hyderabad",
    "CCU": "Kolkata", "COK": "Kochi", "AMD": "Ahmedabad", "GOI": "Goa", "GOX": "Goa", "PNQ": "Pune",
    "KHI": "Karachi", "LHE": "Lahore", "ISB": "Islamabad", "DAC": "Dhaka", "CMB": "Colombo", "KTM": "Kathmandu", "MLE": "Malé",
    "SIN": "Singapore", "KUL": "Kuala Lumpur", "SZB": "Kuala Lumpur", "PEN": "Penang", "LGK": "Langkawi",
    "BKI": "Kota Kinabalu", "KCH": "Kuching", "BKK": "Bangkok", "DMK": "Bangkok", "HKT": "Phuket",
    "CNX": "Chiang Mai", "USM": "Koh Samui", "CGK": "Jakarta", "HLP": "Jakarta", "DPS": "Bali",
    "SUB": "Surabaya", "KNO": "Medan", "MNL": "Manila", "CRK": "Clark", "CEB": "Cebu",
    "SGN": "Ho Chi Minh City", "HAN": "Hanoi", "DAD": "Da Nang", "CXR": "Nha Trang", "PQC": "Phu Quoc",
    "PNH": "Phnom Penh", "SAI": "Siem Reap", "VTE": "Vientiane", "RGN": "Yangon", "BWN": "Bandar Seri Begawan",
    "HKG": "Hong Kong", "MFM": "Macau", "TPE": "Taipei", "TSA": "Taipei", "KHH": "Kaohsiung",
    "PEK": "Beijing", "PKX": "Beijing", "PVG": "Shanghai", "SHA": "Shanghai", "CAN": "Guangzhou",
    "SZX": "Shenzhen", "CTU": "Chengdu", "TFU": "Chengdu", "CKG": "Chongqing", "XIY": "Xi'an",
    "HGH": "Hangzhou", "WUH": "Wuhan", "NKG": "Nanjing", "XMN": "Xiamen", "CSX": "Changsha",
    "TAO": "Qingdao", "CGO": "Zhengzhou", "KMG": "Kunming", "HAK": "Haikou", "SYX": "Sanya",
    "ICN": "Seoul", "GMP": "Seoul", "PUS": "Busan", "CJU": "Jeju",
    "NRT": "Tokyo", "HND": "Tokyo", "KIX": "Osaka", "ITM": "Osaka", "NGO": "Nagoya",
    "FUK": "Fukuoka", "CTS": "Sapporo", "OKA": "Okinawa",
    "SYD": "Sydney", "MEL": "Melbourne", "AVV": "Melbourne", "BNE": "Brisbane", "PER": "Perth",
    "ADL": "Adelaide", "OOL": "Gold Coast", "CNS": "Cairns", "CBR": "Canberra", "HBA": "Hobart",
    "AKL": "Auckland", "WLG": "Wellington", "CHC": "Christchurch", "ZQN": "Queenstown",
    "NAN": "Nadi", "PPT": "Tahiti", "NOU": "Nouméa", "GUM": "Guam",
}

AIRCRAFT_PHYSICS_MAP: Dict[str, Tuple[str, int, float]] = {
    "A319": ("A319", 58000, 1.0), "A320": ("A320", 64000, 1.0), "A20N": ("A320", 65000, 0.86),
    "A321": ("A321", 76000, 1.0), "A21N": ("A321", 78000, 0.86), "B737": ("B737", 58000, 1.0),
    "B738": ("B738", 65000, 1.0), "B38M": ("B738", 66000, 0.86), "B739": ("B739", 71000, 1.0),
    "B39M": ("B739", 72000, 0.86), "B752": ("B752", 92000, 1.0), "E170": ("E190", 34000, 0.85),
    "E175": ("E190", 36000, 0.88), "E190": ("E190", 43000, 1.0), "E195": ("E195", 46000, 1.0),
    "E290": ("E190", 44000, 0.88), "BCS1": ("A319", 50000, 0.85), "BCS3": ("A319", 54000, 0.88),
    "B763": ("B763", 145000, 1.0), "B764": ("B763", 158000, 1.05), "A332": ("A332", 180000, 1.0),
    "A333": ("A333", 190000, 1.0), "A338": ("A332", 182000, 0.88), "A339": ("A333", 195000, 0.88),
    "B788": ("B788", 178000, 1.0), "B789": ("B789", 198000, 1.0), "B78X": ("B789", 212000, 1.06),
    "A359": ("A359", 215000, 1.0), "A35K": ("A359", 242000, 1.12), "B772": ("B772", 220000, 1.0),
    "B77L": ("B772", 245000, 1.08), "B773": ("B773", 250000, 1.0), "B77W": ("B77W", 268000, 1.0),
    "B744": ("B744", 310000, 1.0), "B748": ("B748", 335000, 1.0), "A388": ("A388", 445000, 1.0),
}

REGIONAL_BOUNDS = [
    "72.0,34.0,-15.0,45.0",   # Europe
    "65.0,15.0,-135.0,-55.0", # North America
    "55.0,-12.0,65.0,155.0",  # Asia-Pacific
    "42.0,10.0,30.0,65.0",    # Middle East
    "15.0,-56.0,-90.0,-30.0", # Latin America
    "38.0,-48.0,-20.0,180.0", # Africa & Oceania
]

FLIGHTS_CACHE: Dict[str, Any] = {"timestamp": 0.0, "data": []}
ROUTE_CACHE: Dict[str, RouteData] = {}
TELEMETRY_CACHE: Dict[str, FlightData] = {}
AIRCRAFT_TYPE_CACHE: Dict[str, str] = {}

def clean_airline_name(raw_name: str, callsign: str = "", airline_icao: str = "") -> str:
    """Resolves full official airline name and strips parenthetical livery/operator tags."""
    prefix = (airline_icao or (callsign[:3] if len(callsign) >= 3 else "")).strip().upper()
    cleaned = re.sub(r"\s*[\(\[][^)\]]*[\)\]]", "", (raw_name or "")).strip()

    # 1. If we have a curated master name for this ICAO prefix, prefer it if cleaned is missing or just a 3-letter code
    if prefix in AIRLINE_MASTER and (not cleaned or len(cleaned) <= 3 or cleaned.upper() == prefix):
        return AIRLINE_MASTER[prefix][0]

    # 2. If cleaned is still empty or a 3-letter code, check FR24's live airline catalog
    if (not cleaned or len(cleaned) <= 3 or cleaned.upper() == prefix) and prefix in FR24_AIRLINE_DB:
        db_name = re.sub(r"\s*[\(\[][^)\]]*[\)\]]", "", FR24_AIRLINE_DB[prefix][0]).strip()
        if db_name:
            return db_name

    if prefix in AIRLINE_MASTER:
        return AIRLINE_MASTER[prefix][0]

    return cleaned or prefix or "Commercial Carrier"

def resolve_airline_iata(callsign: str, airline_icao: str = "", airline_iata: str = "") -> str:
    if airline_iata and len(airline_iata.strip()) == 2:
        return airline_iata.strip().upper()
    prefix = (airline_icao or (callsign[:3] if len(callsign) >= 3 else "")).strip().upper()
    if prefix in AIRLINE_MASTER:
        return AIRLINE_MASTER[prefix][1]
    if prefix in FR24_AIRLINE_DB and FR24_AIRLINE_DB[prefix][1]:
        return FR24_AIRLINE_DB[prefix][1]
    return callsign[:2].upper() if len(callsign) >= 2 else ""

def get_metro_city_name(adb_airport: dict, iata_code: str) -> str:
    """Intelligently resolves the true metropolitan city name for any airport IATA globally."""
    code = (iata_code or "").strip().upper()
    if code in METRO_CITY_MAP:
        return METRO_CITY_MAP[code]

    ap_info = airports.get(code, {})
    raw_city = (ap_info.get("city") or adb_airport.get("municipalityName") or "").strip()
    ap_name = (ap_info.get("name") or adb_airport.get("name") or adb_airport.get("shortName") or "").strip()

    # Many international airports in airportsdata store a suburb in `city` (e.g., Richmond for YVR),
    # while `name` starts with the real metropolitan city ("Vancouver International Airport").
    if ap_name:
        m = re.match(
            r"^([A-Za-zÀ-ÿ\s\-\.]+?)\s+(?:International|Intercontinental|Metropolitan|Regional|National|Municipal|City|Airport|Airfield|Intl|Int'l)\b",
            ap_name,
            re.IGNORECASE,
        )
        if m:
            candidate = m.group(1).strip()
            generic_words = ("general", "presidente", "king", "queen", "prince", "sultan", "sheikh", "ministro", "comodoro", "governor", "st", "saint", "san", "santa", "dom", "dr")
            if 3 <= len(candidate) <= 22 and not candidate.lower().startswith(generic_words):
                if not raw_city or candidate.lower() in ap_name.lower()[:len(candidate) + 2]:
                    return candidate.split("/")[0].split("-")[0].strip()

    fallback = raw_city or ap_name or code
    return fallback.split(",")[0].split("(")[0].split("/")[0].strip()

def calculate_bearing(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dlambda = math.radians(lon2 - lon1)
    y = math.sin(dlambda) * math.cos(phi2)
    x = math.cos(phi1) * math.sin(phi2) - math.sin(phi1) * math.cos(phi2) * math.cos(dlambda)
    return (math.degrees(math.atan2(y, x)) + 360.0) % 360.0

def haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    r = 6371.0; phi1, phi2 = math.radians(lat1), math.radians(lat2)
    a = math.sin(math.radians(lat2 - lat1) / 2.0) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(math.radians(lon2 - lon1) / 2.0) ** 2
    return 2.0 * r * math.atan2(math.sqrt(a), math.sqrt(max(0.0, 1.0 - a)))

def compute_dynamic_window_utc(orig_lat: float, orig_lon: float, curr_lat: float, curr_lon: float, dest_lat: float, dest_lon: float, velocity_ms: float) -> Tuple[str, str]:
    now_utc = datetime.now(timezone.utc); speed_kmh = max(velocity_ms * 3.6, 480.0)
    dep_dt = now_utc - timedelta(hours=(haversine_km(orig_lat, orig_lon, curr_lat, curr_lon) / speed_kmh) + 0.22)
    arr_dt = now_utc + timedelta(hours=(haversine_km(curr_lat, curr_lon, dest_lat, dest_lon) / speed_kmh) + 0.23)
    return dep_dt.strftime("%Y-%m-%d %H:%MZ"), arr_dt.strftime("%Y-%m-%d %H:%MZ")

def infer_aircraft_by_distance(callsign: str, dist_km: float) -> str:
    pool = ["E195", "A20N", "B738"] if dist_km < 1200 else ["A21N", "B38M", "A321"] if dist_km < 4200 else ["A359", "B789", "B77W"]
    return pool[sum(ord(c) for c in callsign) % len(pool)]

def calculate_dynamic_fuel_metrics(ac_code: str, velocity_ms: float, altitude_m: float) -> FuelMetrics:
    clean_ac = ac_code.strip().upper()
    openap_model, ref_mass, mult = AIRCRAFT_PHYSICS_MAP.get(clean_ac, ("B738", 65000, 1.0))
    tas, alt = max(velocity_ms, 70.0), max(altitude_m, 500.0)
    try:
        burn = float(FuelFlow(ac=openap_model).enroute(mass=ref_mass, tas=tas, alt=alt)) * mult
        if math.isnan(burn) or burn <= 0.1: raise ValueError()
    except:
        burn = ((ref_mass / 64000.0) * 0.71 * mult) * (0.85 + 0.15 * (tas / 230.0))
    return FuelMetrics(burn_rate_kg_s=round(burn, 3), burn_rate_kg_hr=round(burn * 3600.0, 2), aircraft_type_assumed=clean_ac)

def is_commercial_callsign(callsign: str) -> bool:
    cs = callsign.strip().upper()
    if not cs or cs == "N/A": return False
    return not cs.startswith(EXCLUDED_CALLSIGN_PREFIXES)

def is_commercial_operator(airline_name: str) -> bool:
    if not airline_name or airline_name == "Unknown": return True
    return not any(k in airline_name.lower() for k in EXCLUDED_OPERATOR_KEYWORDS)

def get_cached_flights():
    if time.time() - FLIGHTS_CACHE["timestamp"] > 25 or not FLIGHTS_CACHE["data"]:
        try:
            fresh = fr_api.get_flights()
            if fresh: FLIGHTS_CACHE["data"], FLIGHTS_CACHE["timestamp"] = fresh, time.time()
        except: pass
    return FLIGHTS_CACHE["data"]

def generate_query_aliases(q: str) -> List[str]:
    """Generates exact ICAO <-> IATA flight code aliases (e.g., DLH432 <-> LH432, QFA8 <-> QF8, LAN805 <-> LA805)."""
    q = q.strip().upper()
    aliases = [q]
    m_icao = re.match(r"^([A-Z]{3})(\d+[A-Z]?)$", q)
    if m_icao:
        icao_pref, num_part = m_icao.group(1), m_icao.group(2)
        iata_pref = resolve_airline_iata(q, airline_icao=icao_pref)
        if iata_pref and len(iata_pref) == 2:
            aliases.append(f"{iata_pref}{num_part}")
            # Also strip leading zeros in numeric part (e.g., DLH0432 -> LH432)
            stripped_num = num_part.lstrip("0")
            if stripped_num:
                aliases.append(f"{iata_pref}{stripped_num}")
                aliases.append(f"{icao_pref}{stripped_num}")
    return list(dict.fromkeys(aliases))

def matches_exact(f, aliases: List[str]) -> bool:
    cs = (getattr(f, "callsign", "") or "").strip().upper()
    num = (getattr(f, "number", "") or "").strip().upper()
    reg = (getattr(f, "registration", "") or "").strip().upper().replace("-", "")
    for a in aliases:
        a_clean = a.replace("-", "")
        if a in (cs, num) or (a_clean and a_clean == reg):
            return True
    return False

def find_active_target(query: str):
    q = query.strip().upper()
    if not q: return None
    aliases = generate_query_aliases(q)

    # 1. Check cached global flights with STRICT equality against exact aliases
    for f in get_cached_flights():
        if matches_exact(f, aliases):
            return f

    # 2. If query starts with a 3-letter ICAO airline prefix (e.g., DLH432, LAN805, QFA8, AXM607),
    # query FR24 specifically for that airline's active fleet
    icao_match = re.match(r"^([A-Z]{3})[0-9A-Z]+$", q)
    if icao_match:
        airline_icao = icao_match.group(1)
        try:
            for f in fr_api.get_flights(airline=airline_icao):
                if matches_exact(f, aliases):
                    return f
        except Exception:
            pass

    # 3. Query FR24's live search endpoint for the query and all its exact IATA/ICAO aliases
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        "Accept": "application/json",
        "Referer": "https://www.flightradar24.com/",
    }
    for term in aliases:
        try:
            s_res = requests.get(
                f"https://www.flightradar24.com/v1/search/web/find?query={term}&limit=18",
                headers=headers, timeout=4.0
            )
            if s_res.status_code == 200:
                for item in s_res.json().get("results", []):
                    if item.get("type") != "live":
                        continue
                    detail = item.get("detail", {})
                    cand_cs = (detail.get("callsign") or "").strip().upper()
                    cand_fl = (detail.get("flight") or "").strip().upper()
                    cand_reg = (detail.get("reg") or "").strip().upper().replace("-", "")
                    if not any(a in (cand_cs, cand_fl) or a.replace("-", "") == cand_reg for a in aliases):
                        continue

                    lat, lon = detail.get("lat"), detail.get("lon")
                    if lat is not None and lon is not None:
                        bounds = f"{lat+3.0},{lat-3.0},{lon-3.0},{lon+3.0}"
                        target_aliases = list(dict.fromkeys(aliases + ([cand_cs] if cand_cs else []) + ([cand_fl] if cand_fl else [])))
                        for bf in fr_api.get_flights(bounds=bounds):
                            if matches_exact(bf, target_aliases):
                                return bf
        except Exception:
            pass

    # 4. Regional zone sweep fallback across all continents
    for b_str in REGIONAL_BOUNDS:
        try:
            for rf in fr_api.get_flights(bounds=b_str):
                if matches_exact(rf, aliases):
                    return rf
        except Exception:
            pass

    return None

def build_route_from_fr24(target, callsign: str, curr_lat: float, curr_lon: float, velocity_ms: float) -> Optional[RouteData]:
    orig_iata = (getattr(target, "origin_airport_iata", "") or "").strip().upper()
    dest_iata = (getattr(target, "destination_airport_iata", "") or "").strip().upper()
    airline_iata = (getattr(target, "airline_iata", "") or "").strip().upper()
    airline_icao = (getattr(target, "airline_icao", "") or "").strip().upper()
    airline_name = ""
    dep_utc_str, arr_utc_str = None, None

    try:
        details = fr_api.get_flight_details(target)
        if isinstance(details, dict):
            airline_info = details.get("airline") or {}
            if isinstance(airline_info, dict):
                airline_name = airline_info.get("name") or ""
                code_info = airline_info.get("code") or {}
                airline_iata = airline_iata or (code_info.get("iata") or "").upper()
                airline_icao = airline_icao or (code_info.get("icao") or "").upper()

            airport_info = details.get("airport") or {}
            if isinstance(airport_info, dict):
                orig_obj = airport_info.get("origin") or {}
                dest_obj = airport_info.get("destination") or {}
                if not orig_iata and isinstance(orig_obj, dict):
                    orig_iata = ((orig_obj.get("code") or {}).get("iata") or "").upper()
                if not dest_iata and isinstance(dest_obj, dict):
                    dest_iata = ((dest_obj.get("code") or {}).get("iata") or "").upper()

            ac_info = details.get("aircraft") or {}
            if isinstance(ac_info, dict):
                model_code = ((ac_info.get("model") or {}).get("code") or "").strip().upper()
                if model_code:
                    AIRCRAFT_TYPE_CACHE[callsign] = model_code

            time_info = details.get("time") or {}
            if isinstance(time_info, dict):
                real_dep = (time_info.get("real") or {}).get("departure") or (time_info.get("scheduled") or {}).get("departure")
                est_arr = (time_info.get("estimated") or {}).get("arrival") or (time_info.get("scheduled") or {}).get("arrival")
                if real_dep:
                    dep_utc_str = datetime.fromtimestamp(int(real_dep), tz=timezone.utc).strftime("%Y-%m-%d %H:%MZ")
                if est_arr:
                    arr_utc_str = datetime.fromtimestamp(int(est_arr), tz=timezone.utc).strftime("%Y-%m-%d %H:%MZ")
    except Exception:
        pass

    final_airline_name = clean_airline_name(airline_name, callsign=callsign, airline_icao=airline_icao)
    if not is_commercial_operator(final_airline_name):
        return None

    if not orig_iata or not dest_iata or orig_iata in ("N/A", "") or dest_iata in ("N/A", "") or orig_iata == dest_iata:
        return None

    orig_data = airports.get(orig_iata, {})
    dest_data = airports.get(dest_iata, {})
    orig_lat, orig_lng = orig_data.get("lat"), orig_data.get("lon")
    dest_lat, dest_lng = dest_data.get("lat"), dest_data.get("lon")
    if orig_lat is None or orig_lng is None or dest_lat is None or dest_lng is None:
        return None

    calc_dep, calc_arr = compute_dynamic_window_utc(orig_lat, orig_lng, curr_lat, curr_lon, dest_lat, dest_lng, velocity_ms)
    final_iata = resolve_airline_iata(callsign, airline_icao=airline_icao, airline_iata=airline_iata)

    route = RouteData(
        origin=get_metro_city_name({}, orig_iata),
        destination=get_metro_city_name({}, dest_iata),
        origin_iata=orig_iata,
        dest_iata=dest_iata,
        origin_country=orig_data.get("country", "US"),
        dest_country=dest_data.get("country", "US"),
        airline=final_airline_name,
        logo_url=f"https://images.kiwi.com/airlines/64/{final_iata}.png" if final_iata else "",
        departure_time=dep_utc_str or calc_dep,
        arrival_time=arr_utc_str or calc_arr,
        origin_lat=orig_lat,
        origin_lng=orig_lng,
        dest_lat=dest_lat,
        dest_lng=dest_lng,
    )
    ROUTE_CACHE[callsign] = route
    return route

def fetch_and_cache_route(callsign: str, curr_lat: float, curr_lon: float, velocity_ms: float, target=None) -> Optional[RouteData]:
    if not is_commercial_callsign(callsign):
        return None

    if callsign in ROUTE_CACHE:
        cached = ROUTE_CACHE[callsign]
        cached.airline = clean_airline_name(cached.airline, callsign=callsign)
        cached.origin = get_metro_city_name({}, cached.origin_iata)
        cached.destination = get_metro_city_name({}, cached.dest_iata)
        if cached.origin_lat and cached.dest_lat:
            _, arr_utc = compute_dynamic_window_utc(cached.origin_lat, cached.origin_lng, curr_lat, curr_lon, cached.dest_lat, cached.dest_lng, velocity_ms)
            cached.arrival_time = arr_utc
            return cached

    if target is not None:
        fr_route = build_route_from_fr24(target, callsign, curr_lat, curr_lon, velocity_ms)
        if fr_route:
            return fr_route

    if RAPIDAPI_KEY:
        try:
            adb_res = requests.get(
                f"https://aerodatabox.p.rapidapi.com/flights/callsign/{callsign}",
                headers={"X-RapidAPI-Key": RAPIDAPI_KEY, "X-RapidAPI-Host": "aerodatabox.p.rapidapi.com"},
                timeout=3.5
            )
            if adb_res.status_code == 200 and adb_res.json():
                for f in adb_res.json():
                    airline = f.get("airline", {})
                    raw_airline_name = airline.get("name", "")
                    if not is_commercial_operator(raw_airline_name):
                        continue
                    orig, dest = f.get("departure", {}).get("airport", {}), f.get("arrival", {}).get("airport", {})
                    if not orig.get("iata") or not dest.get("iata") or orig.get("iata") == dest.get("iata"):
                        continue
                    orig_data, dest_data = airports.get(orig.get("iata"), {}), airports.get(dest.get("iata"), {})
                    if not orig_data.get("lat") or not dest_data.get("lat"):
                        continue

                    calc_dep, calc_arr = compute_dynamic_window_utc(orig_data.get("lat"), orig_data.get("lon"), curr_lat, curr_lon, dest_data.get("lat"), dest_data.get("lon"), velocity_ms)
                    live_arr = f.get("arrival", {}).get("runwayTime", {}).get("utc") or f.get("arrival", {}).get("revisedTime", {}).get("utc")

                    adb_ac = f.get("aircraft", {}).get("icao") or f.get("aircraft", {}).get("iata")
                    if adb_ac:
                        AIRCRAFT_TYPE_CACHE[callsign] = adb_ac.strip().upper()

                    final_iata = resolve_airline_iata(callsign, airline_icao=airline.get("icao", ""), airline_iata=airline.get("iata", ""))
                    route = RouteData(
                        origin=get_metro_city_name(orig, orig.get("iata")), destination=get_metro_city_name(dest, dest.get("iata")),
                        origin_iata=orig.get("iata"), dest_iata=dest.get("iata"),
                        origin_country=orig_data.get("country", "US"), dest_country=dest_data.get("country", "US"),
                        airline=clean_airline_name(raw_airline_name, callsign=callsign, airline_icao=airline.get("icao", "")),
                        logo_url=f"https://images.kiwi.com/airlines/64/{final_iata}.png" if final_iata else "",
                        departure_time=calc_dep, arrival_time=live_arr or calc_arr,
                        origin_lat=orig_data.get("lat"), origin_lng=orig_data.get("lon"),
                        dest_lat=dest_data.get("lat"), dest_lng=dest_data.get("lon"),
                    )
                    ROUTE_CACHE[callsign] = route
                    return route
        except Exception:
            pass
    return None

@app.get("/api/random-flight")
def get_random_flight():
    active_flights = [
        f for f in get_cached_flights()
        if getattr(f, "callsign", None)
        and is_commercial_callsign(f.callsign)
        and getattr(f, "altitude", 0) > 18000
        and getattr(f, "origin_airport_iata", "") not in ("", "N/A", None)
        and getattr(f, "destination_airport_iata", "") not in ("", "N/A", None)
    ]
    random.shuffle(active_flights)
    for target in active_flights[:12]:
        callsign = target.callsign.strip().upper()
        vel_ms = max(target.ground_speed * 0.51444, 100.0)
        route = fetch_and_cache_route(callsign, target.latitude, target.longitude, vel_ms, target=target)
        if route:
            if getattr(target, "aircraft_code", None):
                AIRCRAFT_TYPE_CACHE[callsign] = target.aircraft_code.strip().upper()
            hdg = float(getattr(target, "heading", None) or calculate_bearing(target.latitude, target.longitude, route.dest_lat, route.dest_lng))
            TELEMETRY_CACHE[callsign] = FlightData(
                icao24=target.registration or getattr(target, "id", "N/A"),
                callsign=callsign, longitude=target.longitude, latitude=target.latitude,
                altitude_m=max(target.altitude * 0.3048, 1000.0), velocity_ms=vel_ms, heading_deg=hdg
            )
            return {"callsign": callsign}
    raise HTTPException(status_code=404, detail="No active commercial flights found.")

@app.get("/api/flight/{callsign}", response_model=FlightResponse)
def get_flight_data(callsign: str):
    q = callsign.strip().upper()
    if not is_commercial_callsign(q):
        raise HTTPException(status_code=404, detail="Flight not found.")

    target = find_active_target(q)
    if not target or getattr(target, "on_ground", 0) == 1 or getattr(target, "altitude", 0) <= 100:
        raise HTTPException(status_code=404, detail="Flight not found.")

    resolved_cs = (getattr(target, "callsign", "") or q).strip().upper()
    if not is_commercial_callsign(resolved_cs):
        raise HTTPException(status_code=404, detail="Flight not found.")

    if getattr(target, "aircraft_code", None):
        AIRCRAFT_TYPE_CACHE[resolved_cs] = target.aircraft_code.strip().upper()

    vel_ms = max(target.ground_speed * 0.51444, 70.0)
    route_info = fetch_and_cache_route(resolved_cs, target.latitude, target.longitude, vel_ms, target=target)
    if not route_info:
        raise HTTPException(status_code=404, detail="Flight not found.")

    raw_hdg = getattr(target, "heading", None)
    hdg = float(raw_hdg) if raw_hdg is not None else calculate_bearing(target.latitude, target.longitude, route_info.dest_lat, route_info.dest_lng)

    flight_obj = FlightData(
        icao24=getattr(target, "registration", None) or getattr(target, "id", "N/A"),
        callsign=resolved_cs,
        longitude=target.longitude,
        latitude=target.latitude,
        altitude_m=max(target.altitude * 0.3048, 500.0),
        velocity_ms=vel_ms,
        heading_deg=hdg,
    )
    TELEMETRY_CACHE[resolved_cs] = flight_obj

    ac_type = AIRCRAFT_TYPE_CACHE.get(resolved_cs) or infer_aircraft_by_distance(
        resolved_cs, haversine_km(route_info.origin_lat, route_info.origin_lng, route_info.dest_lat, route_info.dest_lng)
    )
    AIRCRAFT_TYPE_CACHE[resolved_cs] = ac_type

    return FlightResponse(
        status="Success",
        flight=flight_obj,
        route=route_info,
        fuel_metrics=calculate_dynamic_fuel_metrics(ac_type, flight_obj.velocity_ms, flight_obj.altitude_m)
    )

@app.get("/api/telemetry/{callsign}", response_model=TelemetryResponse)
def get_live_telemetry(callsign: str):
    target = find_active_target(callsign)
    if target:
        cs = (getattr(target, "callsign", "") or callsign).strip().upper()
        raw_hdg = getattr(target, "heading", None)
        prev_hdg = TELEMETRY_CACHE[cs].heading_deg if cs in TELEMETRY_CACHE else 0.0
        flight_obj = FlightData(
            icao24=getattr(target, "registration", None) or getattr(target, "id", "N/A"),
            callsign=cs, longitude=target.longitude, latitude=target.latitude,
            altitude_m=max(target.altitude * 0.3048, 500.0), velocity_ms=max(target.ground_speed * 0.51444, 70.0),
            heading_deg=float(raw_hdg) if raw_hdg is not None else prev_hdg,
        )
        TELEMETRY_CACHE[cs] = flight_obj
    elif callsign.strip().upper() in TELEMETRY_CACHE:
        cs = callsign.strip().upper()
        flight_obj = TELEMETRY_CACHE[cs]
    else:
        raise HTTPException(status_code=404, detail="Signal lost.")

    route_info = ROUTE_CACHE.get(cs)
    ac_type = AIRCRAFT_TYPE_CACHE.get(cs) or (
        infer_aircraft_by_distance(cs, haversine_km(route_info.origin_lat, route_info.origin_lng, route_info.dest_lat, route_info.dest_lng))
        if route_info else "A320"
    )
    return TelemetryResponse(
        flight=flight_obj,
        fuel_metrics=calculate_dynamic_fuel_metrics(ac_type, flight_obj.velocity_ms, flight_obj.altitude_m)
    )