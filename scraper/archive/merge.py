#!/usr/bin/env python3
import json
import sys
from pathlib import Path

def load_json(path):
    with open(path, 'r') as f:
        return json.load(f)

def save_json(data, path):
    with open(path, 'w') as f:
        json.dump(data, f, indent=2)
        print(f"→ Written merged data to {path}")

def merge_lists(a, b):
    """Return a + any items in b not already in a, preserving order."""
    seen = set(a)
    out = list(a)
    for item in b:
        if item not in seen:
            seen.add(item)
            out.append(item)
    return out

def merge_player_records(base, other):
    """Merge two player dicts: union their list-fields."""
    merged = dict(base)  # shallow copy
    for field in ("teams","colleges","numbers"):
        a = base.get(field, [])
        b = other.get(field, [])
        merged[field] = merge_lists(a, b)
    # you could add sanity checks here for name/url mismatches, etc.
    return merged

def main():

    data1 = load_json("nfl_full.json")
    data2 = load_json("/Users/patrickmckeever/Desktop/NameGame/namegame/build/backend/players_new.json")
    out_path = Path("final.json")

    for pid, rec2 in data2.items():
        if pid not in data1:
            data1[pid] = rec2
        else:
            data1[pid] = merge_player_records(data1[pid], rec2)

    save_json(data1, out_path)

if __name__ == "__main__":
    main()