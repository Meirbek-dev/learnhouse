
import json
import sys
import os

def sort_json_file(input_filepath, output_filepath=None):
    try:
        with open(input_filepath, 'r', encoding='utf-8') as f:
            data = json.load(f)

        sorted_data_string = json.dumps(data, indent=4, sort_keys=True, ensure_ascii=False)

        if output_filepath is None:
            output_filepath = input_filepath
            print(f"Sorting and overwriting: {input_filepath}")
        else:
            print(f"Sorting {input_filepath} and saving to: {output_filepath}")

        with open(output_filepath, 'w', encoding='utf-8') as f:
            f.write(sorted_data_string)

        print("Sorting complete.")

    except FileNotFoundError:
        print(f"Error: Input file not found at {input_filepath}")
    except json.JSONDecodeError:
        print(f"Error: Could not decode JSON from {input_filepath}. Please ensure it's a valid JSON file.")
    except Exception as e:
        print(f"An unexpected error occurred: {e}")

if __name__ == "__main__":
    if len(sys.argv) < 2 or len(sys.argv) > 3:
        print("Usage: python sort_json.py <input_filepath> [output_filepath]")
        print("If output_filepath is not provided, the input file will be overwritten.")
    else:
        input_file = sys.argv[1]
        output_file = sys.argv[2] if len(sys.argv) == 3 else None
        sort_json_file(input_file, output_file)
