import json
from pathlib import Path

# Path to your input JSON
INPUT_PATH = Path("/Users/patrickmckeever/Desktop/scraper/final.json")
# Path where we’ll write the unique colleges
OUTPUT_PATH = Path("/Users/patrickmckeever/Desktop/scraper/colleges.json")

def main():
    # 1) Load the full data
    with INPUT_PATH.open("r") as f:
        data = json.load(f)

    # 2) Collect all colleges
    colleges = set()
    for item in data.values():
        # only player‐records are dicts with a "colleges" field
        if isinstance(item, dict) and "colleges" in item:
            for col in item["colleges"]:
                if col:  # skip empty strings
                    colleges.add(col)

    # 3) Sort and prepare output
    sorted_colleges = sorted(colleges)

    # 4) Write to colleges.json
    with OUTPUT_PATH.open("w") as f:
        json.dump({"colleges": sorted_colleges}, f, indent=2)
    print(f"Wrote {len(sorted_colleges)} unique colleges to {OUTPUT_PATH}")

if __name__ == "__main__":
    main()