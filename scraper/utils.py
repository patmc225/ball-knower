"""
Utility functions for NameGame scraper.

Provides common functionality for HTTP requests, JSON I/O, and rate limiting.
"""

import json
import time
import requests
from pathlib import Path

def load_json(path):
    """
    Load JSON data from a file.
    
    Args:
        path: Path to JSON file (string or Path object)
        
    Returns:
        Parsed JSON data (dict or list), or empty dict if file doesn't exist
    """
    path = Path(path)
    if not path.exists():
        return {}
    with path.open('r', encoding='utf-8') as f:
        return json.load(f)

def save_json(data, path):
    """
    Save data to JSON file with pretty formatting.
    
    Args:
        data: Data to serialize (dict or list)
        path: Output path (string or Path object)
    """
    path = Path(path)
    with path.open('w', encoding='utf-8') as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
    print(f"Saved data to {path}")

def fetch_with_retry(url, session, max_retries=5):
    """
    Fetch URL with automatic retry on failure and rate limiting.
    
    Enforces 3.1-second delay before each request to maintain 20 req/min limit.
    Handles HTTP 429 (rate limit) responses with exponential backoff.
    
    Args:
        url: URL to fetch
        session: requests.Session object
        max_retries: Maximum number of retry attempts (default: 5)
        
    Returns:
        requests.Response object
        
    Raises:
        Exception: If all retry attempts fail
        
    Rate Limiting:
        - Waits 3.1 seconds before each request (20 requests/minute)
        - Honors Retry-After header on 429 responses
        - Uses exponential backoff on other failures
    """
    # Rate limiting: 20 requests per minute = 1 request every 3 seconds.
    # Use 3.1 seconds to be safe.
    time.sleep(3.1)
    
    for attempt in range(1, max_retries + 1):
        try:
            # Print every request for transparency
            print(f"Requesting: {url}")
            
            resp = session.get(url)
            
            # Handle rate limiting
            if resp.status_code == 429:
                retry = resp.headers.get('Retry-After')
                wait = int(retry) if retry else 2 ** attempt
                print(f"Rate limited. Waiting for {wait} seconds...")
                time.sleep(wait)
                continue
                
            resp.raise_for_status()
            return resp
            
        except requests.exceptions.RequestException as e:
            print(f"Request failed: {e}")
            if attempt == max_retries:
                raise
            time.sleep(2 ** attempt)
            
    raise Exception(f"Failed to fetch {url} after {max_retries} retries")
