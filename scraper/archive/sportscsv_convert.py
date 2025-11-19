#!/usr/bin/env python3
import csv
import json
from pathlib import Path

INPUT_CSV = Path("sports.csv")
OUTPUT_JSON = Path("college_csv.json")

def main():
    seen = set()
    records = []

    with INPUT_CSV.open(newline="", encoding="utf-8") as f_csv:
        reader = csv.DictReader(f_csv)
        for row in reader:
            uid = row["unitid"]
            if uid in seen:
                continue
            seen.add(uid)

            # pick only the fields we need
            records.append({
                "unitid": uid,
                "institution_name": row["institution_name"],
                "city_txt": row["city_txt"],
                "state_cd": row["state_cd"],
                "classification_name": row["classification_name"]
            })

    # write out as JSON array
    with OUTPUT_JSON.open("w", encoding="utf-8") as f_json:
        json.dump(records, f_json, indent=2)

    print(f"Wrote {len(records)} unique records to {OUTPUT_JSON}")

if __name__ == "__main__":
    main()