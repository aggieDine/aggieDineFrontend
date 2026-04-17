import json

with open('tamu_buildings2.json', 'r') as f:
    data = json.load(f)

# Optional: Add HELD manually (it's very popular and was missing from some OSM tags probably due to being Heldenfels)
if 'HELD' not in data:
    data['HELD'] = {'latitude': 30.6152, 'longitude': -96.3397, 'name': 'Heldenfels Hall'}

# Sort alphabetically by key
data = dict(sorted(data.items()))

# Generate the CAMPUS_BUILDINGS JS
js_obj = 'const CAMPUS_BUILDINGS = {\n'
for ref, coords in data.items():
    js_obj += f'  {ref}: {{ latitude: {coords["latitude"]}, longitude: {coords["longitude"]} }},\n'
js_obj += '};'

with open('campus_buildings_code.txt', 'w') as f:
    f.write(js_obj)

# Generate BUILDINGS array JS
keys = list(data.keys())
arr_str = 'const BUILDINGS = [\n'
for i in range(0, len(keys), 10):
    chunk = keys[i:i+10]
    arr_str += '  ' + ', '.join(f"'{k}'" for k in chunk) + ',\n'
arr_str += '];'

with open('buildings_array_code.txt', 'w') as f:
    f.write(arr_str)

print('Generated JS snippets.')
