"""
Merge NFL and NBA player databases into final output.

Combines the two league-specific databases into a single unified database.
Handles potential ID collisions (though rare due to different ID schemes).

Usage:
    python merge_final.py players_db_nfl.json players_db_nba.json output.json
"""

import json
import argparse
from pathlib import Path
from utils import load_json, save_json

def merge_final(nfl_path, nba_path, output_path):
    nfl_data = load_json(nfl_path)
    nba_data = load_json(nba_path)
    
    print(f"Loaded {len(nfl_data)} NFL players")
    print(f"Loaded {len(nba_data)} NBA players")
    
    # Merge dictionaries
    # Assuming IDs don't collide. If they do, we might have an issue.
    # PFR: Capital letters (usually)
    # BR: Lowercase letters (usually)
    # But let's check for collisions just in case.
    
    merged = {}
    collisions = 0
    
    for pid, data in nfl_data.items():
        merged[pid] = data
        
    for pid, data in nba_data.items():
        if pid in merged:
            print(f"Collision detected for ID {pid}: {data['name']} vs {merged[pid]['name']}")
            collisions += 1
            # Append suffix? or just let it be (if they are the same player?)
            # Unlikely to be same player ID across sports unless it's a very simple ID schema.
            # PFR/BR IDs are name-based (e.g. lnamfi01).
            # If same name and same count, could collide.
            # We can prefix ID with league if needed.
            # But the existing system seems to expect IDs as keys.
            # I'll overwrite for now or maybe skip?
            # Let's assume they are distinct enough or prefix if safe.
            # Actually, `nfl_full.json` has keys like "AaitIs00".
            # NBA keys are like "abdelal01".
            # Seems distinct casing.
        merged[pid] = data
        
    print(f"Total merged players: {len(merged)}")
    if collisions > 0:
        print(f"Warning: {collisions} ID collisions occurred.")
        
    save_json(merged, output_path)

if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument("--nfl", default="players_db_nfl.json", help="Path to NFL DB")
    parser.add_argument("--nba", default="players_db_nba.json", help="Path to NBA DB")
    parser.add_argument("--output", default="../public/backend/players_new.json", help="Output path")
    args = parser.parse_args()
    
    merge_final(args.nfl, args.nba, args.output)

