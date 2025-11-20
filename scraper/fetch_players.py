"""
Fetch player lists from Sports Reference websites.

Scrapes player index pages (A-Z) from Basketball-Reference and Pro-Football-Reference.
For NBA, also extracts college information directly from player list pages.

Usage:
    python fetch_players.py NFL
    python fetch_players.py NBA
"""

import requests
from bs4 import BeautifulSoup
from pathlib import Path
import time
import argparse
import re
from utils import fetch_with_retry, save_json, load_json
from config import NFL_BASE_URL, NBA_BASE_URL, NFL_LETTERS, NBA_LETTERS

def extract_years(text):
    """
    Extracts start and end years from a string in the format '... YYYY-YYYY ...'.
    Returns a tuple (start_year, end_year) as strings.
    """
    match = re.search(r'(\d{4})\s*-\s*(\d{4})', text)
    if match:
        return match.group(1), match.group(2)
    return None, None

def get_players_for_letter(base_url, letter, session, league):
    url = f"{base_url}/players/{letter}/"
    try:
        resp = fetch_with_retry(url, session)
    except Exception as e:
        print(f"Error fetching {url}: {e}")
        return []

    soup = BeautifulSoup(resp.text, 'html.parser')
    
    # Try finding the table first (BBR style - for NBA)
    table = soup.find('table', id='players')
    if table:
        rows = table.tbody.find_all('tr')
        players = []
        for row in rows:
            # Name is in th (header cell) usually on BBR
            th = row.find('th')
            if not th: continue
            
            link = th.find('a')
            if not link: continue
            
            start_year = None
            end_year = None
            
            # Try to get years from data-stat cells if possible
            min_cell = row.find('td', {'data-stat': 'year_min'})
            max_cell = row.find('td', {'data-stat': 'year_max'})
            
            if min_cell and max_cell:
                start_year = min_cell.text.strip()
                end_year = max_cell.text.strip()
            else:
                s, e = extract_years(row.text)
                start_year, end_year = s, e
                
            if not start_year:
                continue
            
            # EXTRACT COLLEGES FOR NBA
            colleges = []
            if league.upper() == 'NBA':
                col_cell = row.find('td', {'data-stat': 'colleges'})
                if col_cell:
                    # It contains links to colleges usually
                    links = col_cell.find_all('a')
                    if links:
                        colleges = [l.text.strip() for l in links]
                    else:
                        # Maybe just text if no links?
                        txt = col_cell.get_text(strip=True)
                        if txt:
                            colleges = [txt]

            players.append({
                'name': link.text,
                'url': base_url + link['href'],
                'start_year': start_year,
                'end_year': end_year,
                'colleges': colleges
            })
        return players

    # Fallback to PFR style (div_players) - for NFL
    div = soup.find('div', id='div_players')
    if div:
        rows = div.find_all('p')
        players = []
        for row in rows:
            link = row.a
            if not link: continue
            
            start, end = extract_years(row.text)
            if not start: continue
            
            players.append({
                'name': link.text,
                'url': base_url + link['href'],
                'start_year': start,
                'end_year': end,
                'colleges': []
            })
        return players

    print(f"No player list found for {url}")
    return []

def fetch_players(league, output_path=None):
    session = requests.Session()
    session.headers.update({
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36'
    })
    
    if league.upper() == 'NFL':
        base_url = NFL_BASE_URL
        letters = NFL_LETTERS
    elif league.upper() == 'NBA':
        base_url = NBA_BASE_URL
        letters = NBA_LETTERS
    else:
        raise ValueError("League must be NFL or NBA")

    if output_path is None:
        output_path = f'players_db_{league.lower()}.json'

    # Load existing DB to resume or start fresh
    all_players_db = load_json(output_path)
    if not isinstance(all_players_db, dict):
        all_players_db = {}
        
    print(f"Starting scrape for {league} players...")
    
    total_requests = len(letters)
    start_time = time.time()
    
    for idx, letter in enumerate(letters, 1):
        print(f"Fetching players for letter: {letter}")
        new_players_list = get_players_for_letter(base_url, letter, session, league)
        
        # Process list into DB format
        for p in new_players_list:
            url = p['url']
            pid = Path(url).stem
            
            if pid not in all_players_db:
                all_players_db[pid] = {}
                
            # Update fields
            all_players_db[pid]['name'] = p['name']
            all_players_db[pid]['url'] = p['url']
            all_players_db[pid]['start_year'] = p.get('start_year')
            all_players_db[pid]['end_year'] = p.get('end_year')
            all_players_db[pid]['league'] = league.upper()
            all_players_db[pid]['id'] = pid
            
            # Initialize lists if not present
            all_players_db[pid].setdefault('teams', [])
            all_players_db[pid].setdefault('numbers', [])
            all_players_db[pid].setdefault('colleges', [])
            
            # Add colleges from list if present (for NBA - scraped in Step 1)
            if 'colleges' in p and p['colleges']:
                 for c in p['colleges']:
                     if c not in all_players_db[pid]['colleges']:
                         all_players_db[pid]['colleges'].append(c)
        
        # Calculate progress
        elapsed = time.time() - start_time
        avg_time_per_req = elapsed / idx
        remaining_reqs = total_requests - idx
        estimated_time_remaining = remaining_reqs * avg_time_per_req
        percent_complete = (idx / total_requests) * 100
        
        mins_remaining = int(estimated_time_remaining // 60)
        secs_remaining = int(estimated_time_remaining % 60)
        
        print(f"Processed {len(new_players_list)} players. Total in DB: {len(all_players_db)}")
        print(f"Progress: {idx}/{total_requests} ({percent_complete:.1f}%) - Est. {mins_remaining}m {secs_remaining}s remaining")
        
        # Save incrementally
        save_json(all_players_db, output_path)

    print(f"Completed. Saved {len(all_players_db)} players to {output_path}")

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description="Scrape players list from Reference sites")
    parser.add_argument("league", choices=["NFL", "NBA"], help="League to scrape")
    args = parser.parse_args()
    
    fetch_players(args.league)
