"""
Fetch jersey numbers for NBA players.

Scrapes Basketball-Reference jersey number pages (0-99) to associate
players with their jersey numbers.

Note: NFL numbers are handled in fetch_teams.py via uniform pages.

Usage:
    python fetch_numbers.py NBA players_db_nba.json
"""

import requests
from bs4 import BeautifulSoup
from pathlib import Path
import time
import argparse
from utils import fetch_with_retry, load_json, save_json
from config import NBA_BASE_URL, NUMS

def extract_player_ids(html):
    soup = BeautifulSoup(html, 'html.parser')
    # BR uses "numbers" for the table id in friv/numbers.fcgi
    table = soup.find('table', id='uniform_number')
    if not table:
        table = soup.find('table', id='numbers')
    
    ids = []
    if not table:
        return ids
        
    for row in table.find_all('tr'):
        link = None
        th = row.find('th')
        if th:
            link = th.find('a')
        
        if not link:
            td = row.find('td')
            if td:
                link = td.find('a')
                
        if not link: continue
        
        player_id = Path(link['href']).stem
        ids.append(player_id)
        
    return ids

def fetch_numbers(league, db_path):
    """Only for NBA - NFL numbers are handled in fetch_teams.py"""
    if league.upper() != 'NBA':
        print(f"fetch_numbers is only for NBA. Skipping for {league}.")
        return
        
    session = requests.Session()
    session.headers.update({
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
    })
    
    players = load_json(db_path)
    base_url = NBA_BASE_URL
    url_pattern = base_url + '/friv/numbers.fcgi?number='
    
    total_requests = len(NUMS)
    request_count = 0
    start_time = time.time()
    
    for num in NUMS:
        request_count += 1
        url = url_pattern + num
        
        try:
            resp = fetch_with_retry(url, session)
            roster_ids = extract_player_ids(resp.text)
            print(f"  Found {len(roster_ids)} players for #{num}")
        except Exception as e:
            print(f"Error fetching number {num}: {e}")
            continue
            
        updated_count = 0
        for pid in roster_ids:
            if pid in players:
                player = players[pid]
                nums = player.setdefault('numbers', [])
                if num not in nums:
                    nums.append(num)
                    updated_count += 1
        
        # Calculate progress
        elapsed = time.time() - start_time
        avg_time_per_req = elapsed / request_count
        remaining_reqs = total_requests - request_count
        estimated_time_remaining = remaining_reqs * avg_time_per_req
        percent_complete = (request_count / total_requests) * 100
        
        mins_remaining = int(estimated_time_remaining // 60)
        secs_remaining = int(estimated_time_remaining % 60)
        
        print(f"Progress: {request_count}/{total_requests} ({percent_complete:.1f}%) - Est. {mins_remaining}m {secs_remaining}s remaining")
        
        save_json(players, db_path)

if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument("league", choices=["NFL", "NBA"])
    parser.add_argument("db_path", help="Path to the players database JSON")
    args = parser.parse_args()
    
    fetch_numbers(args.league, args.db_path)
