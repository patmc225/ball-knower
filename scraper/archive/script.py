import time
import random
import requests
from bs4 import BeautifulSoup
import re
import sys
import json

NBA_BASE_URL = 'https://www.basketball-reference.com'
NFL_BASE_URL = 'https://www.pro-football-reference.com'
NBA_LETTERS = 'abcdefghijklmnopqrstuvwxyz'
NFL_LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
BASE_URL = NFL_BASE_URL
LETTERS = NFL_LETTERS

def extract_years(text):
    """
    Extracts start and end years from a string in the format '... YYYY-YYYY ...'.
    Returns a tuple (start_year, end_year) as strings.
    Raises ValueError if no valid range is found.
    """
    match = re.search(r'(\d{4})\s*-\s*(\d{4})', text)
    if match:
        return match.group(1), match.group(2)
    raise ValueError(f"No year range found in: {text!r}")

def fetch_with_retry(url, session, max_retries=5):
    for attempt in range(1, max_retries+1):
        resp = session.get(url)
        print(f"Attempt {attempt}: {url} - Status: {resp.status_code}")
        if resp.status_code == 429:
            # Honor Retry-After or backoff
            wait = int(resp.headers.get('Retry-After', 2 ** attempt))
            print(f"Rate limited. Waiting for {wait} seconds...")
            time.sleep(wait)
            continue
        resp.raise_for_status()
        return resp
    raise Exception(f"Failed after {max_retries} retries: {url}")

def get_players_for_letter(letter, session):
    url = f"{BASE_URL}/players/{letter}/"
    resp = fetch_with_retry(url, session)
    soup = BeautifulSoup(resp.text, 'html.parser')
    rows = soup.find('div', id='div_players').find_all('p')

    players = []
    for row in rows:
        link = row.a
        try:
            start, end = extract_years(row.text)
        except ValueError as e:
            print(e, file=sys.stderr)
        players.append({
            'name': link.text,
            'url': BASE_URL + link['href'],
            'start_year': start,
            'end_year':   end
        })
        #print(f"Found player: {link.text} - {BASE_URL + link['href']}\n")
        # Random delay with jitter
        # time.sleep(random.uniform(1, 3))
    return players

def main():
    session = requests.Session()
    session.headers.update({
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 '
                      '(KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36'
    })
    # Optionally configure proxies:
    # session.proxies.update({'https': 'http://your.proxy:port'})

    all_players = []
    for L in LETTERS:
        print(f"Fetching players for letter: {L}")
        all_players.extend(get_players_for_letter(L, session))

        with open('players.json', 'w', encoding='utf-8') as f:
            json.dump(all_players, f, indent=2, ensure_ascii=False)

        print(f"Saved {len(all_players)} players for letter {L}.")
        time.sleep(4)


if __name__ == '__main__':
    main()
