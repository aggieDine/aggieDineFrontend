import urllib.request
import json
import time

query = """
[out:json];
area["name"="Texas A&M University"]->.searchArea;
(
  way["building"]["ref"](area.searchArea);
  relation["building"]["ref"](area.searchArea);
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
            ref = element.get('tags', {}).get('ref')
            if not ref:
                continue
                
            lat = element.get('center', {}).get('lat', element.get('lat'))
            lon = element.get('center', {}).get('lon', element.get('lon'))
            
            if lat and lon:
                buildings[ref] = {'latitude': lat, 'longitude': lon}
                
        print(f'Found {len(buildings)} buildings with codes.')
        with open('tamu_buildings.json', 'w') as f:
            json.dump(buildings, f, indent=2)
except Exception as e:
    print('Failed:', e)
