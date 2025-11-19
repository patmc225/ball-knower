import json

def normalize_player(info):
    # Only touch dicts
    if not isinstance(info, dict):
        return info
    # Remove jersey_numbers
    info.pop('jersey_numbers', None)
    # Add league
    info['league'] = 'NBA'
    return info

# 1. Load the file
with open('players_by_id.json', 'r') as f:
    data = json.load(f)

# 2. Transform
if isinstance(data, dict):
    # { "id": { ... }, ... }
    updated = {pid: normalize_player(info) for pid, info in data.items()}

elif isinstance(data, list):
    # Could be [ {...}, {...}, ... ]  or  [ [id, {...}], ... ]
    # First check for [id, dict] pairs:
    if all(isinstance(el, list) and len(el) == 2 and isinstance(el[0], str) and isinstance(el[1], dict)
           for el in data):
        updated = {}
        for pid, info in data:
            updated[pid] = normalize_player(info)

    # Next, check for list of dicts:
    elif all(isinstance(el, dict) for el in data):
        updated = [normalize_player(el) for el in data]

    else:
        raise RuntimeError("Unrecognized JSON structure in players.json")

else:
    raise RuntimeError("players.json must be a dict or a list")

# 3. Write back (you can overwrite or use a new file)
with open('players_updated.json', 'w') as f:
    json.dump(updated, f, indent=2)

print("✅ Done! Removed jersey_numbers and added league='NBA'.")
