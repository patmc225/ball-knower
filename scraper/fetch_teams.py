"""
Fetch team affiliations and jersey numbers for NFL/NBA players.

NFL: Iterates through each team's uniform pages (numbers 0-99) to capture
     player IDs, teams, jersey numbers, and years seen.
     
NBA: Scrapes team roster pages to get team affiliations.

Usage:
    python fetch_teams.py NFL players_db_nfl.json
    python fetch_teams.py NBA players_db_nba.json
"""

import requests
from bs4 import BeautifulSoup
from pathlib import Path
import time
import argparse
import os
from utils import fetch_with_retry, load_json, save_json
from config import (
    NFL_BASE_URL, NBA_BASE_URL,
    NBA_TEAMS, NUMS
)

def get_active_teams_nfl(session, base_url):
    """
    Scrape the main /teams/ page and return a list of
    (abbr, full_name) for each active NFL franchise.
    """
    url = f"{base_url}/teams/"
    print(f"Fetching active NFL teams from {url}")
    resp = fetch_with_retry(url, session)
    soup = BeautifulSoup(resp.text, "html.parser")
    
    # Find the "Active Franchises" section:
    table = soup.find("table", id="teams_active")
    teams = []
    if not table:
        print("Could not find table id='teams_active'")
        return []
        
    for row in table.tbody.find_all("tr"):
        th = row.find("th")
        if not th: continue
        
        link = th.find("a", href=True)
        if not link:
            continue
        # e.g. link['href'] = '/teams/crd/'
        abbr = os.path.basename(os.path.dirname(link["href"]))
        full_name = link.text.strip()
        teams.append((abbr, full_name))
        
    return teams

def extract_player_data_uniform(html, team_code):
    """
    Extract player ID, years, and number from a uniform page.
    Returns a list of dicts: {id, start_year, end_year, number, team_code}
    """
    soup = BeautifulSoup(html, 'html.parser')
    
    # Try finding any table
    tables = soup.find_all('table')
    target_table = None
    for t in tables:
        # Check headers
        headers = [th.get_text(strip=True).lower() for th in t.find_all('th')]
        if 'player' in headers and 'from' in headers and 'to' in headers:
            target_table = t
            break
            
    if not target_table:
        return []
        
    players_found = []
    
    rows = target_table.find_all('tr')
    
    for row in rows:
        # Skip rows that don't have data cells we expect
        cells = row.find_all(['td', 'th'])
        if not cells: continue
        
        # find the anchor with href to player
        link = row.find('a', href=True)
        if not link or '/players/' not in link['href']:
            continue
            
        pid = Path(link['href']).stem # e.g. BradSa00
        
        text_cells = [c.get_text(strip=True) for c in cells]
        
        # Find the first cell that looks like a year (4 digits)
        start_year = None
        end_year = None
        
        for txt in text_cells:
            if txt.isdigit() and len(txt) == 4:
                if not start_year:
                    start_year = txt
                elif not end_year:
                    end_year = txt
                    break
                    
        if not start_year:
             # Fallback
             continue
        if not end_year:
            end_year = start_year # Played 1 year
            
        players_found.append({
            'id': pid,
            'start_year': start_year,
            'end_year': end_year
        })
        
    return players_found

def fetch_teams_nfl(db_path, players):
    session = requests.Session()
    session.headers.update({
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
    })
    
    base_url = NFL_BASE_URL
    prefix = "nfl_"
    
    # Dynamically fetch teams
    teams = get_active_teams_nfl(session, base_url)
    print(f"Found {len(teams)} active NFL teams.")
    
    # Calculate total requests: teams * numbers
    total_requests = len(teams) * len(NUMS)
    request_count = 0
    start_time = time.time()
    
    for team_idx, (abbr, full_name) in enumerate(teams, 1):
        print(f"\n=== Processing {full_name} ({abbr}) - Team {team_idx}/{len(teams)} ===")
        team_code_upper = abbr.upper()
        team_code = f"{prefix}{team_code_upper}"
        
        total_updates = 0
        
        for num in NUMS:
            request_count += 1
            url = f"{base_url}/players/uniform.cgi?team={abbr.lower()}&number={num}"
            
            try:
                resp = fetch_with_retry(url, session)
                extracted_data = extract_player_data_uniform(resp.text, team_code)
                if extracted_data:
                    print(f"  Found {len(extracted_data)} players for #{num}")
            except Exception as e:
                print(f"Error fetching {url}: {e}")
                continue
            
            if not extracted_data:
                continue
                
            for item in extracted_data:
                pid = item['id']
                
                if pid not in players:
                    players[pid] = {
                        'id': pid,
                        'league': 'NFL',
                        'teams': [],
                        'numbers': [],
                    }
                
                p = players[pid]
                
                # Update Team
                if team_code not in p.setdefault('teams', []):
                    p['teams'].append(team_code)
                    
                # Update Number
                if num not in p.setdefault('numbers', []):
                    p['numbers'].append(num)
                    
                # Update Years (if the player already has a record from Step 1)
                # Otherwise these stay empty until we scrape
                current_start = p.get('start_year')
                current_end = p.get('end_year')
                
                new_start = item['start_year']
                new_end = item['end_year']
                
                if not current_start or (new_start < current_start):
                    p['start_year'] = new_start
                if not current_end or (new_end > current_end):
                    p['end_year'] = new_end
                    
                total_updates += 1
            
        # Calculate progress
        elapsed = time.time() - start_time
        avg_time_per_req = elapsed / request_count
        remaining_reqs = total_requests - request_count
        estimated_time_remaining = remaining_reqs * avg_time_per_req
        percent_complete = (request_count / total_requests) * 100
        
        mins_remaining = int(estimated_time_remaining // 60)
        secs_remaining = int(estimated_time_remaining % 60)
        
        print(f"Updated {total_updates} entries for {full_name}.")
        print(f"Progress: {request_count}/{total_requests} ({percent_complete:.1f}%) - Est. {mins_remaining}m {secs_remaining}s remaining")
        
        save_json(players, db_path)

def fetch_teams_nba(db_path, players):
    session = requests.Session()
    session.headers.update({
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
    })
    
    base_url = NBA_BASE_URL
    teams = NBA_TEAMS
    prefix = "nba_"
    
    total_requests = len(teams)
    start_time = time.time()
        
    for idx, team in enumerate(teams, 1):
        url = f"{base_url}/teams/{team}/players.html"
        print(f"Fetching {url}...")
        
        try:
            resp = fetch_with_retry(url, session)
            roster_ids = extract_player_ids_pfr(resp.text)
            print(f"  Found {len(roster_ids)} players on roster page")
        except Exception as e:
            print(f"Error fetching {team}: {e}")
            continue
            
        updated_count = 0
        team_code = f"{prefix}{team}"
        
        for pid in roster_ids:
            if pid in players:
                player = players[pid]
                player_teams = player.setdefault('teams', [])
                if team_code not in player_teams:
                    player_teams.append(team_code)
                    updated_count += 1
        
        # Calculate progress
        elapsed = time.time() - start_time
        avg_time_per_req = elapsed / idx
        remaining_reqs = total_requests - idx
        estimated_time_remaining = remaining_reqs * avg_time_per_req
        percent_complete = (idx / total_requests) * 100
        
        mins_remaining = int(estimated_time_remaining // 60)
        secs_remaining = int(estimated_time_remaining % 60)
        
        print(f"Updated {updated_count} players for team {team} ({len(roster_ids)} found on page)")
        print(f"Progress: {idx}/{total_requests} ({percent_complete:.1f}%) - Est. {mins_remaining}m {secs_remaining}s remaining")
        
        save_json(players, db_path)

# Helper for NBA reuse
def extract_player_ids_pfr(html, table_id=None):
    soup = BeautifulSoup(html, 'html.parser')
    if table_id:
        table = soup.find('table', id=table_id)
    else:
        table = None
    if not table:
        table = soup.find('table', id='franchise_register')
    if not table:
        table = soup.find('table', id='roster')
    
    ids = []
    if not table: return ids
    for row in table.find_all('tr'):
        player_cell = row.find(attrs={"data-stat": "player"})
        link = player_cell.find('a') if player_cell else None
        if not link:
            cells = row.find_all(['th', 'td'])
            if cells: link = cells[0].find('a')
        if not link: continue
        ids.append(Path(link['href']).stem)
    return ids

def fetch_teams(league, db_path):
    players = load_json(db_path)
    print(f"Loaded {len(players)} players from {db_path}")
    
    if league.upper() == 'NFL':
        fetch_teams_nfl(db_path, players)
    elif league.upper() == 'NBA':
        fetch_teams_nba(db_path, players)
    else:
        raise ValueError("League must be NFL or NBA")

if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument("league", choices=["NFL", "NBA"])
    parser.add_argument("db_path", help="Path to the players database JSON (dict by ID)")
    args = parser.parse_args()
    
    fetch_teams(args.league, args.db_path)
