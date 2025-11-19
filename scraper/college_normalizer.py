"""
Normalize college names in the player database.

Uses colleges_grouped.json mapping to convert variant college names
to their canonical forms (e.g., "UNC" -> "North Carolina").

Usage:
    python college_normalizer.py players_new.json
"""

import json
from pathlib import Path
import argparse
from utils import load_json, save_json

# Default grouped colleges path relative to scraper dir
GROUPED_COLLEGES_PATH = Path(__file__).parent / "colleges_grouped.json"

def build_canonical_map(grouped):
    """
    From { key: [canon, alt1, alt2, ...], ... }
    build { alt1: canon, alt2: canon, ... }
    """
    mapping = {}
    for variants in grouped.values():
        if len(variants) > 1:
            canon = variants[0]
            for alt in variants[1:]:
                mapping[alt] = canon
    return mapping

def normalize_players(col_map, players):
    """
    For each player dict with a 'colleges' list,
    replace any college in col_map with its canonical name.
    """
    count = 0
    for pid, record in players.items():
        if isinstance(record, dict) and "colleges" in record:
            new_cols = []
            changed = False
            for col in record["colleges"]:
                # map variant → canonical, or leave unchanged
                canonical = col_map.get(col, col)
                if canonical != col:
                    changed = True
                new_cols.append(canonical)
            
            if changed:
                # dedupe, preserve order
                seen = set()
                record["colleges"] = [c for c in new_cols if not (c in seen or seen.add(c))]
                count += 1
    return count

def run_normalization(input_path, output_path=None):
    if not output_path:
        output_path = input_path
        
    if not GROUPED_COLLEGES_PATH.exists():
        print(f"Error: {GROUPED_COLLEGES_PATH} not found. Cannot normalize.")
        return

    grouped = load_json(GROUPED_COLLEGES_PATH)
    col_map = build_canonical_map(grouped)
    
    players = load_json(input_path)
    print(f"Normalizing colleges for {len(players)} players...")
    
    changed_count = normalize_players(col_map, players)
    print(f"Normalized colleges for {changed_count} players.")
    
    save_json(players, output_path)

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", required=True, help="Path to players JSON to normalize")
    parser.add_argument("--output", help="Path to save normalized JSON (defaults to input)")
    args = parser.parse_args()
    
    run_normalization(args.input, args.output)
