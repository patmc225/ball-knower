"""
Fetch college information for NFL players.

Scrapes Pro-Football-Reference college pages to associate NFL players
with their colleges.

Note: NBA colleges are scraped directly in fetch_players.py from player list pages.

Usage:
    python fetch_colleges.py NFL players_db_nfl.json
"""

import requests
from bs4 import BeautifulSoup
from pathlib import Path
import time
import argparse
import os
from utils import fetch_with_retry, load_json, save_json
from config import NFL_BASE_URL

def scrape_schools(session, base_url):
    """Returns a list of (school_name, school_url) tuples."""
    url = f"{base_url}/schools/"
    print(f"Fetching schools from {url}")
    resp = fetch_with_retry(url, session)
    soup = BeautifulSoup(resp.text, "html.parser")
    
    table = soup.find("table", id="college_stats_table")
    if not table:
        print("Could not find college_stats_table")
        return []
        
    schools = []
    for row in table.tbody.find_all("tr"):
        if row.find("td") is None: continue
        
        # PFR: data-stat="college_name"
        cell = row.find("td", {"data-stat": "college_name"})
        if not cell: continue
        
        link = cell.find("a", href=True)
        if not link: continue
        
        name = link.text.strip()
        href = link["href"]
        schools.append((name, base_url + href))
        
    return schools

def scrape_players_from_school(school_url, session):
    """Returns a list of player IDs."""
    resp = fetch_with_retry(school_url, session)
    soup = BeautifulSoup(resp.text, "html.parser")
    
    table = soup.find("table", id="all_players") # PFR uses all_players
    if not table:
        return []
        
    player_ids = []
    if not table.tbody: return []
    
    for row in table.tbody.find_all("tr"):
        cell = row.find("td", {"data-stat": "player"})
        if not cell: continue
        
        link = cell.find("a", href=True)
        if not link: continue
        
        # link['href'] like '/players/B/BradyTo00.htm'
        pid = Path(link["href"]).stem
        player_ids.append(pid)
        
    return player_ids

def fetch_colleges(league, db_path):
    if league.upper() != 'NFL':
        print("fetch_colleges currently only supports NFL (PFR). Skipping.")
        return

    session = requests.Session()
    session.headers.update({
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
    })
    
    players = load_json(db_path)
    base_url = NFL_BASE_URL
    
    schools = scrape_schools(session, base_url)
    print(f"Found {len(schools)} schools.")
    
    total_requests = len(schools)
    start_time = time.time()
    
    for idx, (school_name, school_url) in enumerate(schools, 1):
        print(f"[{idx}/{len(schools)}] Scraping {school_name} ...", end=" ", flush=True)
        
        try:
            roster_ids = scrape_players_from_school(school_url, session)
        except Exception as e:
            print(f"Error: {e}")
            continue
            
        print(f"found {len(roster_ids)} players.")
        
        updated_count = 0
        for pid in roster_ids:
            if pid in players:
                cols = players[pid].setdefault("colleges", [])
                if school_name not in cols:
                    cols.append(school_name)
                    updated_count += 1
        
        # Calculate progress
        elapsed = time.time() - start_time
        avg_time_per_req = elapsed / idx
        remaining_reqs = total_requests - idx
        estimated_time_remaining = remaining_reqs * avg_time_per_req
        percent_complete = (idx / total_requests) * 100
        
        mins_remaining = int(estimated_time_remaining // 60)
        secs_remaining = int(estimated_time_remaining % 60)
        
        print(f"Progress: {idx}/{total_requests} ({percent_complete:.1f}%) - Est. {mins_remaining}m {secs_remaining}s remaining")
        
        # Save periodically
        if idx % 10 == 0:
            save_json(players, db_path)
        
    save_json(players, db_path)

if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument("league", choices=["NFL", "NBA"])
    parser.add_argument("db_path", help="Path to the players database JSON")
    args = parser.parse_args()
    
    fetch_colleges(args.league, args.db_path)
