import json
from pathlib import Path

# Load your existing list of players
players = json.loads(Path('players.json').read_text(encoding='utf-8'))

# Build a dict keyed by player_id (e.g. "abdelal01")
by_id = {}
for p in players:
    # extract "abdelal01" from ".../abdelal01.html"
    player_id = Path(p['url']).stem
    # optionally add the id into each record
    p['id'] = player_id
    by_id[player_id] = p

    p['colleges'] = []
    by_id['colleges'] = []
    p['teams'] = []
    by_id['teams'] = []
    p['numbers'] = []
    by_id['numbers'] = []
    p['league'] = "NFL"
    by_id['league'] = "NFL"

# Write out the new structure
Path('players_by_id.json').write_text(
    json.dumps(by_id, ensure_ascii=False, indent=2),
    encoding='utf-8'
)
print(f"Re-wrote {len(by_id)} players into players_by_id.json")
