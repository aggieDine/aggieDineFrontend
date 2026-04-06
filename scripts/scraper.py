from curl_cffi import requests
import firebase_admin
from firebase_admin import credentials
from firebase_admin import firestore
import json

# ---------------------------------------------------------
# 1. CONFIGURATION
# ---------------------------------------------------------
URL = "https://apiv4.dineoncampus.com/sites/5751fd4290975b60e0489534/locations-public"

PARAMS = {
    "for_map": "true",
    "with_address": "true",
    "with_buildings": "true"
}

# ---------------------------------------------------------
# 2. FETCH DATA
# ---------------------------------------------------------
def fetch_data():
    print(f"--- Fetching Data from API ---")
    try:
        response = requests.get(URL, params=PARAMS, impersonate="firefox")
        if response.status_code == 200:
            return response.json()
        else:
            print(f"❌ API Failed: {response.status_code}")
            return None
    except Exception as e:
        print(f"❌ Error fetching data: {e}")
        return None

# ---------------------------------------------------------
# 3. PARSE DATA (Updated with your specific keys)
# ---------------------------------------------------------
def parse_data(api_data):
    clean_locations = []
    
    # Get the buildings list (we know from your log that 'buildings' is the key)
    raw_buildings = api_data.get('buildings', [])
    print(f"--- Found {len(raw_buildings)} Building Groups ---")

    for building in raw_buildings:
        # 1. Get Building Name (Your log showed 'buildingName')
        group_name = building.get('buildingName', 'General')
        
        # 2. Iterate through locations in this building
        locations = building.get('locations', [])
        
        for loc in locations:
            # --- EXTRACT COORDINATES ---
            # Your log showed coordinates are inside 'address' using keys 'lat'/'lon'
            address_obj = loc.get('address', {})
            
            # Try getting 'lat'/'lon' (as seen in your log)
            lat = address_obj.get('lat')
            lng = address_obj.get('lon')

            # Fallback: Sometimes they use 'coordinates' list [-96.33, 30.61]
            # if lat is None:
            #     coords_list = address_obj.get('coordinates') # [long, lat]
            #     if coords_list and len(coords_list) >= 2:
            #         lng = coords_list[0]
            #         lat = coords_list[1]

            # Skip if we still don't have valid numbers
            if lat is None or lng is None:
                continue

            # --- EXTRACT STATUS ---
            status_obj = loc.get('status', {})
            if isinstance(status_obj, dict):
                is_open = status_obj.get('label', '').lower() == 'open'
                message = status_obj.get('message', '')
            else:
                is_open = str(status_obj).lower() == 'open'
                message = ""

            # --- BUILD FINAL OBJECT ---
            entry = {
                "id": loc.get('id'),
                "name": loc.get('name'), # e.g., "The Commons Dining Hall"
                "category": group_name,  # e.g., "Dining Halls"
                "coordinates": {
                    "latitude": float(lat),
                    "longitude": float(lng)
                },
                "status": {
                    "isOpen": is_open,
                    "message": message
                },
                "description": loc.get('shortDescription', ''),
                "address": address_obj.get('street', '') # Added street address useful for UI
            }
            clean_locations.append(entry)

    print(f"--- Parsing Complete. Prepared {len(clean_locations)} locations for upload. ---")
    return clean_locations

# ---------------------------------------------------------
# 4. UPLOAD TO FIREBASE
# ---------------------------------------------------------
def upload_to_firebase(data):
    if not data:
        print("⚠️ No data to upload.")
        return

    # Initialize Firebase
    if not firebase_admin._apps:
        try:
            cred = credentials.Certificate("serviceAccountKey.json")
            firebase_admin.initialize_app(cred)
        except Exception as e:
            print(f"❌ Firebase Auth Error: {e}")
            return

    db = firestore.client()
    collection_ref = db.collection("dining_halls")

    print(f"--- Uploading to Firestore ---")
    
    batch = db.batch()
    counter = 0

    for location in data:
        doc_ref = collection_ref.document(location["id"])
        batch.set(doc_ref, location)
        counter += 1

        if counter >= 400:
            batch.commit()
            batch = db.batch()
            counter = 0
    
    if counter > 0:
        batch.commit()
        
    print("✅ Upload Complete! Check your Firebase Console.")

# ---------------------------------------------------------
# MAIN
# ---------------------------------------------------------
if __name__ == "__main__":
    raw_data = fetch_data()
    if raw_data:
        clean_list = parse_data(raw_data)
        upload_to_firebase(clean_list)