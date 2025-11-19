import time
import requests

def fetch_with_retry(url, session, max_retries=5):
    """
    Fetches `url` via `session`, retrying on HTTP 429 or transient errors.
    Honors Retry-After header when present; otherwise uses exponential backoff.
    """
    for attempt in range(1, max_retries + 1):
        resp = session.get(url)
        if resp.status_code == 429:
            # Respect Retry-After or use backoff factor
            retry_after = resp.headers.get('Retry-After')
            wait = int(retry_after) if retry_after else 2 ** attempt
            print(f"Rate limited. Waiting for {wait} seconds...")
            time.sleep(wait)
            continue
        resp.raise_for_status()
        return resp
    raise Exception(f"Failed to fetch {url} after {max_retries} retries")

from bs4 import BeautifulSoup
import re

def get_player_details(url, session):
    """
    Returns a dict with:
      - jersey_number: first number link text from `/friv/numbers`
      - team: text of the link after 'Team:' label
    """
    resp = fetch_with_retry(url, session)
    soup = BeautifulSoup(resp.text, 'html.parser')





   
    # Jersey number: first uniform-number link
    jersey_number = []
    num_link = soup.find('a', href=re.compile(r'^/friv/numbers'))
    for num_link in soup.find_all('a', href=re.compile(r'^/friv/numbers')):
        jersey_number.append(num_link.text.strip()) if num_link else ''

    # Team: find the 'Team:' label and its next <a>
    teams = {"1","2"}
    teams.remove("1")
    teams.remove("2")
    table = soup.find('table', id='per_game_stats')
    items = table.find_all(attrs={'data-stat': 'team_name_abbr'})
    for item in items:
        text = item.select_one(':scope > a:only-child')
        teams.add(text.text.strip()) if text else ''

    teams = list(teams)
    return {'jersey_number': jersey_number, 'team': teams}

import json

def main():
    # Persistent session with a realistic User-Agent
    session = requests.Session()
    session.headers.update({
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
    })

    # Read existing list of players
    with open('players.json', 'r', encoding='utf-8') as f:
        players = json.load(f)

    detailed = []
    count = 0
    print(f"{len(players)} players to process")
    for p in players:
        if(count % 10 == 0): print(f"Processed {count} players, {round(count/len(players)* 100, 2)}% done")
        details = get_player_details(p['url'], session)
        # Merge details into the original dict
        p.update(details)
        detailed.append(p)
        # Small pause to stay polite
        #time.sleep(1)
        count += 1

    # Write enriched data
    with open('player_details.json', 'w', encoding='utf-8') as f:
        json.dump(detailed, f, ensure_ascii=False, indent=2)
    print(f"Saved details for {len(detailed)} players")

if __name__ == '__main__':
    main()
