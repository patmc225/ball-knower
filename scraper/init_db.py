"""
Initialize database from player list JSON files.

Converts player list (array of player objects) to database format
(dictionary keyed by player ID). Extracts player IDs from URLs
and preserves all player attributes including colleges from NBA scrape.

Usage:
    python init_db.py NFL players_nfl.json players_db_nfl.json
    python init_db.py NBA players_nba.json players_db_nba.json
"""

import json
import argparse
from pathlib import Path
from utils import load_json, save_json

def init_db(league, input_list_path, db_path):
    """
    Convert player list to database format.
    
    Args:
        league: 'NFL' or 'NBA'
        input_list_path: Path to players list JSON (array format)
        db_path: Output path for database JSON (dict format)
        
    Database Format:
        {
            "player_id": {
                "id": "player_id",
                "name": "Player Name",
                "url": "https://...",
                "league": "NFL" | "NBA",
                "start_year": "YYYY",
                "end_year": "YYYY",
                "teams": [],
                "numbers": [],
                "colleges": []
            }
        }
    """
    players_list = load_json(input_list_path)
    if not players_list:
        print(f"No players found in {input_list_path}")
        return

    # Load existing DB or start new
    db = load_json(db_path)
    
    print(f"Processing {len(players_list)} players from {input_list_path}...")
    
    new_count = 0
    for p in players_list:
        # Extract ID from URL
        # PFR: /players/A/AlleJo00.htm -> AlleJo00
        # BR: /players/a/abdelal01.html -> abdelal01
        url = p['url']
        pid = Path(url).stem
        
        if pid not in db:
            db[pid] = {}
            new_count += 1
            
        # Update fields
        db[pid]['name'] = p['name']
        db[pid]['url'] = p['url']
        db[pid]['start_year'] = p.get('start_year')
        db[pid]['end_year'] = p.get('end_year')
        db[pid]['league'] = league.upper()
        db[pid]['id'] = pid
        
        # Initialize lists if not present
        db[pid].setdefault('teams', [])
        db[pid].setdefault('numbers', [])
        db[pid].setdefault('colleges', [])
        
        # Add colleges from list if present (for NBA - scraped in Step 1)
        if 'colleges' in p and p['colleges']:
             for c in p['colleges']:
                 if c not in db[pid]['colleges']:
                     db[pid]['colleges'].append(c)
        
    print(f"Added {new_count} new players. Total in DB: {len(db)}")
    save_json(db, db_path)

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description="Initialize player database from list")
    parser.add_argument("league", choices=["NFL", "NBA"], help="League")
    parser.add_argument("input_list_path", help="Path to players list JSON")
    parser.add_argument("db_path", help="Path to output DB JSON")
    args = parser.parse_args()
    
    init_db(args.league, args.input_list_path, args.db_path)
