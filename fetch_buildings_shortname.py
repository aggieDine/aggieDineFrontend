import urllib.request
import json
import time

query = """
[out:json];
area["name"="Texas A&M University"]->.searchArea;
(
  way["building"](area.searchArea);
  relation["building"](area.searchArea);
);
out center;
"""

url = 'https://overpass-api.de/api/interpreter'
req = urllib.request.Request(url, data=query.encode('utf-8'))
try:
    with urllib.request.urlopen(req) as response:
        content = response.read()
        data = json.loads(content.decode('utf-8'))
        
        buildings = {}
        for element in data['elements']:
            tags = element.get('tags', {})
            name = tags.get('name')
            short_name = tags.get('short_name')
            alt_name = tags.get('alt_name')
            ref = tags.get('ref')
            
            # Find a 4-5 letter all-caps code
            code = None
            if short_name and short_name.isupper() and 2 <= len(short_name) <= 5:
                code = short_name
            elif alt_name and alt_name.isupper() and 2 <= len(alt_name) <= 5:
                code = alt_name
                
            if not code:
                continue
                
            lat = element.get('center', {}).get('lat', element.get('lat'))
            lon = element.get('center', {}).get('lon', element.get('lon'))
            
            if lat and lon:
                buildings[code] = {'latitude': lat, 'longitude': lon, 'name': name}
                
        print(f'Found {len(buildings)} buildings with codes.')
        with open('tamu_buildings2.json', 'w') as f:
            json.dump(buildings, f, indent=2)
except Exception as e:
    print('Failed:', e)
