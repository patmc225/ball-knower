#!/usr/bin/env python3
import json
import argparse
import sys

INPUT_FILE = '/Users/patrickmckeever/Desktop/NameGame/namegame/public/backend/teams.json'
OUTPUT_FILE = '/Users/patrickmckeever/Desktop/NameGame/namegame/public/backend/teams.json'


def capitalize_nfl_keys(data):
    updated = {}
    for key, team in data.items():
        # Only touch NFL entries whose key starts with "nfl_"
        if team.get('league') == 'NFL' and key.startswith('nfl_'):
            prefix, code = key.split('_', 1)
            new_key = f'{prefix}_{code.upper()}'
            team['id'] = new_key
            updated[new_key] = team
        else:
            updated[key] = team
    return updated

def main():

    # Load
    with open(INPUT_FILE, 'r') as f:
        teams = json.load(f)

    # Transform
    updated = capitalize_nfl_keys(teams)

    with open(OUTPUT_FILE, 'w') as f:
        json.dump(updated, f, indent=2, sort_keys=True)
    print(f'Wrote {len(updated)} teams to {OUTPUT_FILE}')

if __name__ == '__main__':
    main()