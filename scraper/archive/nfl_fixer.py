import json

INPUT_FILE = 'players_new.json'
OUTPUT_FILE = '/Users/patrickmckeever/Desktop/NameGame/namegame/public/backend/players_new.json'

def should_keep(player):
    """
    Return True if this player should be kept in the output.
    We drop only NFL players with end_year < 1960.
    """
    if player.get('league') == 'NFL':
        try:
            end_year = int(player.get('end_year', 0))
        except ValueError:
            end_year = 0
        return end_year >= 1960
    # keep all non-NFL (e.g. NBA) entries
    return True

def rename_teams(player):
    """
    For NFL players, uppercase the part after 'nfl_'.
    """
    if player.get('league') != 'NFL':
        return

    new_teams = []
    for team in player.get('teams', []):
        if team.startswith('nfl_'):
            prefix, code = team.split('_', 1)
            new_teams.append(f'{prefix}_{code.upper()}')
        else:
            new_teams.append(team)
    player['teams'] = new_teams

def main():
    # Load JSON
    with open(INPUT_FILE, 'r') as f:
        data = json.load(f)

    filtered = {}
    for pid, player in data.items():
        if not should_keep(player):
            # drop this player
            continue

        # rename teams if NFL
        rename_teams(player)

        # keep this entry
        filtered[pid] = player

    # Write filtered data
    with open(OUTPUT_FILE, 'w') as f:
        json.dump(filtered, f, indent=2, sort_keys=True)
    print(f'Wrote {len(filtered)} players to {OUTPUT_FILE}')

if __name__ == '__main__':
    main()