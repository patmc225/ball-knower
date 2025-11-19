import time
import json
import requests
from bs4 import BeautifulSoup
from pathlib import Path
import re

# Constants
NUMS = [
  "00", "0", "1", "2", "3", "4", "5", "6", "7", "8", "9",
  "10", "11", "12", "13", "14", "15", "16", "17", "18", "19",
  "20", "21", "22", "23", "24", "25", "26", "27", "28", "29",
  "30", "31", "32", "33", "34", "35", "36", "37", "38", "39",
  "40", "41", "42", "43", "44", "45", "46", "47", "48", "49",
  "50", "51", "52", "53", "54", "55", "56", "57", "58", "59",
  "60", "61", "62", "63", "64", "65", "66", "67", "68", "69",
  "70", "71", "72", "73", "74", "75", "76", "77", "78", "79",
  "80", "81", "82", "83", "84", "85", "86", "87", "88", "89",
  "90", "91", "92", "93", "94", "95", "96", "97", "98", "99"
]

BASE_URL    = 'https://www.basketball-reference.com'
NUM_URL     = BASE_URL + '/friv/numbers.fcgi?number='
DATA_PATH   = Path('players_by_id.json')
NFL_URL =  'https://www.pro-football-reference.com/players/uniform.cgi?number='

def fetch_with_retry(url, session, max_retries=5):
    """
    GET with retry/backoff on HTTP 429, honoring Retry-After.
    """
    for attempt in range(1, max_retries + 1):
        resp = session.get(url)
        if resp.status_code == 429:
            retry = resp.headers.get('Retry-After')
            wait  = int(retry) if retry else 2 ** attempt
            print(f"Rate limited. Waiting for {wait} seconds...")
            time.sleep(wait)
            continue
        resp.raise_for_status()
        return resp
    raise Exception(f"Failed to fetch {url} after {max_retries} retries")

def extract_player_ids(html):
    """
    Returns all player IDs (e.g. 'abdelal01') found on the jersey-number page.
    """
    soup = BeautifulSoup(html, 'html.parser')
    table = soup.find('table', id='uniform_number')  # locate roster table :contentReference[oaicite:16]{index=16}
    
    ids = []
    if(table is None): return ids
    for row in table.find_all('tr'):     # iterate each player row :contentReference[oaicite:17]{index=17}
        link = row.find('th').find('a')
        # Extract "abdelal01" from URL
        if(link is None): continue
        player_id = Path(link['href']).stem      # Path.stem gives filename without suffix :contentReference[oaicite:18]{index=18}
        ids.append(player_id)
    return ids

def main():
    # 1) Load existing data
    players = json.loads(DATA_PATH.read_text(encoding='utf-8'))

    # 2) Prepare HTTP session
    session = requests.Session()
    session.headers.update({
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
    })

    for num in NUMS:
        #if(int(num) < 74): continue
        #if(num == "5"): break
        # 3) Fetch and parse jersey‐23 page
        jersey_num  = num
        print(NFL_URL + num)
        resp       = fetch_with_retry(NFL_URL + num, session)
        roster_ids = extract_player_ids(resp.text)
        #print(roster_ids)

        # 4) Update each player’s jersey_numbers list
        for pid in roster_ids:
            if pid in players:
                nums = players[pid].setdefault('numbers', [])
                if num not in nums:
                    nums.append(num)

    
        # 5) Write back to JSON
        with DATA_PATH.open('w', encoding='utf-8') as f:
            json.dump(players, f, ensure_ascii=False, indent=2)

        print(f"Appended jersey number {jersey_num} to {len(roster_ids)} players.")

        time.sleep(4)

if __name__ == '__main__':
    main()
