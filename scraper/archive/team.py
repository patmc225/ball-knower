import time
import json
import requests
from bs4 import BeautifulSoup
from pathlib import Path

NBA_BASE_URL = 'https://www.basketball-reference.com/teams/'
NFL_BASE_URL = 'https://www.pro-football-reference.com/teams/'
END_URL = '/players.html'
NBA_TEAMS = [
  "ATL",
  "BOS",
  "NJN",
  "CHA",
  "CHI",
  "CLE",
  "DAL",
  "DEN",
  "DET",
  "GSW",
  "HOU",
  "IND",
  "LAC",
  "LAL",
  "MEM",
  "MIA",
  "MIL",
  "MIN",
  "NOH",
  "NYK",
  "OKC",
  "ORL",
  "PHI",
  "PHO",
  "POR",
  "SAC",
  "SAS",
  "TOR",
  "UTA",
  "WAS"
]

NFL_TEAMS = [
  "ARI",
  "ATL",
  "BAL",
  "BUF",
  "CAR",
  "CHI",
  "CIN",
  "CLE",
  "DAL",
  "DEN",
  "DET",
  "GB",
  "HOU",
  "IND",
  "JAX",
  "KC",
  "LAC",
  "LAR",
  "MIA",
  "MIN",
  "NE",
  "NO",
  "NYG",
  "NYJ",
  "PHI",
  "PIT",
  "SEA",
  "SF",
  "TB",
  "TEN",
  "WAS"
]



def fetch_with_retry(url, session, max_retries=5):
    for attempt in range(1, max_retries + 1):
        resp = session.get(url)  # uses connection pooling :contentReference[oaicite:15]{index=15}
        if resp.status_code == 429:
            retry = resp.headers.get('Retry-After')
            wait = int(retry) if retry else 2 ** attempt
            print(f"Rate limited. Waiting for {wait} seconds...")
            time.sleep(wait)
            continue
        resp.raise_for_status()
        return resp
    raise Exception(f"Failed to fetch {url} after {max_retries} retries")

def extract_player_ids(html):
    soup = BeautifulSoup(html, 'html.parser')
    table = soup.find('table', id='franchise_register')  # locate roster table :contentReference[oaicite:16]{index=16}
    
    ids = []
    for row in table.find_all('tr'):
        # iterate each player row :contentReference[oaicite:17]{index=17}
        link = row.find('td')
        if(link is None): continue
        link = link.find('a')
        if(link is None): continue
        # Extract "abdelal01" from URL
        player_id = Path(link['href']).stem      # Path.stem gives filename without suffix :contentReference[oaicite:18]{index=18}
        ids.append(player_id)
    return ids

def main():
    # 1) Prepare session
    session = requests.Session()
    session.headers.update({
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
    })

    # 3) Load JSON mapping
    data_path = Path('players_by_id.json')
    players = json.loads(data_path.read_text(encoding='utf-8'))  # parse JSON :contentReference[oaicite:19]{index=19}

    # 4) Append "BOS" to each player's teams list
    for team in NFL_TEAMS:

        resp       = fetch_with_retry(BASE_URL + team + END_URL, session)
        print(BASE_URL + team + END_URL)
        roster_ids = extract_player_ids(resp.text)

        for pid in roster_ids:
            if pid in players:
                teams = players[pid].setdefault('teams', [])
                if team not in teams:
                    teams.append(team)

        # 5) Write back out
        with data_path.open('w', encoding='utf-8') as f:
            json.dump(players, f, ensure_ascii=False, indent=2)  # serialize JSON :contentReference[oaicite:20]{index=20}

        print(f"Updated teams ({team}) for {len(roster_ids)} players")
        
        time.sleep(4)

if __name__ == '__main__':
    main()
