import os
import json
import zipfile
import sys
from pathlib import Path

def get_input(prompt, default=None):
    """Gets user input with an optional default value."""
    if default:
        return input(f"{prompt} [{default}]: ") or default
    return input(f"{prompt}: ")

def validate_pack_data(pack_data, tokens_dir=None, archive_file_list=None):
    """
    Validates the pack.json schema and checks for file existence with verbose output.
    Can check against a local directory (tokens_dir) or a list of files from an archive.
    """
    print("\n🔍 Validating 'pack.json' data...")
    errors = []
    
    # 1. Check for required top-level keys and their types
    required_keys = {
        "name": str, "author": str, "description": str, 
        "version": str, "tokens": list
    }
    schema_correct = True
    for key, expected_type in required_keys.items():
        if key not in pack_data:
            errors.append(f"Missing required key: '{key}'")
            schema_correct = False
        elif not isinstance(pack_data[key], expected_type):
            errors.append(f"Key '{key}' has incorrect type. Expected {expected_type.__name__}, found {type(pack_data[key]).__name__}.")
            schema_correct = False
    
    if schema_correct:
        print(" ✓ Schema and data types are correct.")

    if "tokens" in pack_data and isinstance(pack_data["tokens"], list):
        # 2. Check each token entry
        print(" ✓ Checking token entries...")
        all_tokens_found = True
        for i, token in enumerate(pack_data["tokens"]):
            token_valid = True
            if not isinstance(token, dict):
                errors.append(f"Token entry at index {i} is not a valid object.")
                token_valid = False
                all_tokens_found = False
                continue
            
            if "name" not in token or not isinstance(token["name"], str):
                errors.append(f"Token entry at index {i} is missing a valid 'name' string.")
                token_valid = False
                all_tokens_found = False
            
            if "fileName" not in token or not isinstance(token["fileName"], str):
                errors.append(f"Token entry at index {i} is missing a valid 'fileName' string.")
                token_valid = False
                all_tokens_found = False
            elif tokens_dir:
                # Validate against a local directory
                if (tokens_dir / token["fileName"]).is_file():
                    print(f"   ✓ Token '{token['fileName']}' exists.")
                else:
                    errors.append(f"Token file '{token['fileName']}' listed in pack.json does not exist in the 'tokens' directory.")
                    all_tokens_found = False
            elif archive_file_list:
                # Validate against a list of files in an archive
                expected_path = f'tokens/{token["fileName"]}'
                if expected_path in archive_file_list:
                    print(f"   ✓ Token '{token['fileName']}' exists in archive.")
                else:
                    errors.append(f"Token file '{token['fileName']}' listed in pack.json does not exist in the archive's 'tokens/' directory.")
                    all_tokens_found = False
        
        if all_tokens_found and len(pack_data["tokens"]) > 0:
            print(" ✓ All token files were found.")

    if errors:
        print("\nValidation failed with the following errors:")
        for error in errors:
            print(f" - {error}")
        return False
        
    print(" ✓ Validation successful!")
    return True


def create_pack_interactively(pack_dir):
    """Creates pack.json data by asking the user questions."""
    print("No 'pack.json' found. Let's create one interactively.")
    
    pack_data = {
        "name": get_input("Enter the pack name"),
        "author": get_input("Enter the author's name"),
        "description": get_input("Enter a brief description"),
        "version": get_input("Enter a version number", "1.0.0"),
        "tokens": []
    }

    tokens_dir = Path(pack_dir) / 'tokens'
    if not tokens_dir.is_dir():
        print(f"Error: A 'tokens' sub-directory was not found in '{pack_dir}'.")
        return None

    print("\nNow, let's name the tokens found in the 'tokens' directory:")
    
    image_files = sorted([f for f in tokens_dir.iterdir() if f.is_file() and f.suffix.lower() in ['.svg', '.png', '.jpg', '.jpeg']])

    if not image_files:
        print("Warning: No token images found in the 'tokens' directory.")
        return pack_data

    for image_path in image_files:
        # Suggest a default name based on the filename without extension
        default_name = image_path.stem.replace('_', ' ').replace('-', ' ').title()
        token_name = get_input(f"Enter a name for '{image_path.name}'", default_name)
        
        pack_data["tokens"].append({
            "name": token_name,
            "fileName": image_path.name
        })
        
    return pack_data

def create_gbtk_archive(pack_dir, pack_data):
    """Creates a .gbtk ZIP archive from the directory and pack data."""
    pack_dir_path = Path(pack_dir)
    # Sanitize the pack name for use as a filename
    sanitized_name = "".join(c for c in pack_data.get("name", "untitled_pack") if c.isalnum() or c in (' ', '_')).rstrip()
    archive_path = pack_dir_path.parent / f"{sanitized_name.lower().replace(' ', '_')}.gbtk"
    tokens_dir = pack_dir_path / 'tokens'

    print(f"\nCreating archive at: {archive_path}")

    try:
        with zipfile.ZipFile(archive_path, 'w', zipfile.ZIP_DEFLATED) as zf:
            # 1. Write the pack.json to the root of the archive
            pack_json_str = json.dumps(pack_data, indent=2)
            zf.writestr('pack.json', pack_json_str)
            print(" ✓ Added 'pack.json'")

            # 2. Add all files from the tokens directory
            if tokens_dir.is_dir():
                for token_file in tokens_dir.iterdir():
                    if token_file.is_file():
                        arcname = f"tokens/{token_file.name}"
                        zf.write(token_file, arcname)
                        print(f" ✓ Added '{arcname}'")
            else:
                 print("Warning: 'tokens' directory not found. The archive will not contain any tokens.")


    except Exception as e:
        print(f"\nAn error occurred while creating the archive: {e}")
        return False
        
    print("\n🎉 Token pack created successfully!")
    return True

def validate_gbtk_archive(file_path):
    """Validates an existing .gbtk file with verbose output."""
    print(f"--- 🕵️  Validating Token Pack: {file_path} ---")
    file_path = Path(file_path)
    if not file_path.is_file():
        print(f"Error: File not found at '{file_path}'")
        return

    if not zipfile.is_zipfile(file_path):
        print("Error: The provided file is not a valid ZIP archive.")
        return

    with zipfile.ZipFile(file_path, 'r') as zf:
        archive_files = zf.namelist()
        
        # Check for essential files/directories
        if 'pack.json' in archive_files:
            print(" ✓ Found 'pack.json' at the root.")
        else:
            print("Validation failed: Missing 'pack.json' at the root of the archive.")
            return
            
        has_tokens_dir = any(f.startswith('tokens/') for f in archive_files)
        if has_tokens_dir:
             print(" ✓ Found 'tokens/' directory.")
        else:
            print("Warning: The archive does not contain a 'tokens/' directory.")
        
        # Read and validate pack.json
        try:
            with zf.open('pack.json') as pack_file:
                pack_data = json.load(pack_file)
        except json.JSONDecodeError as e:
            print(f"Validation failed: 'pack.json' is not a valid JSON file. {e}")
            return
        except Exception as e:
            print(f"Validation failed: Could not read 'pack.json'. {e}")
            return

        if validate_pack_data(pack_data, archive_file_list=archive_files):
            print("\n--- ✅ Validation Complete: The token pack appears to be valid. ---")
        else:
            print("\n--- ❌ Validation Complete: The token pack has issues (see errors above). ---")


def main():
    """Main function to run the script."""
    if len(sys.argv) < 2:
        print("Usage:")
        print("  Create: python create_gbtk.py <directory_path>")
        print("  Validate: python create_gbtk.py --validate <file_path.gbtk>")
        sys.exit(1)

    if sys.argv[1] == '--validate':
        if len(sys.argv) != 3:
            print("Usage: python create_gbtk.py --validate <file_path.gbtk>")
            sys.exit(1)
        validate_gbtk_archive(sys.argv[2])
        return

    # Default to creation mode
    pack_dir = sys.argv[1]
    if not os.path.isdir(pack_dir):
        print(f"Error: The directory '{pack_dir}' does not exist.")
        sys.exit(1)
        
    pack_json_path = Path(pack_dir) / 'pack.json'
    pack_data = None
    tokens_dir = Path(pack_dir) / 'tokens'

    if not tokens_dir.is_dir():
        print(f"Error: A 'tokens' sub-directory must exist inside '{pack_dir}'.")
        sys.exit(1)

    if pack_json_path.exists():
        print(f"Found 'pack.json' at '{pack_json_path}'. Reading metadata.")
        try:
            with open(pack_json_path, 'r', encoding='utf-8') as f:
                pack_data = json.load(f)
        except json.JSONDecodeError as e:
            print(f"Error: 'pack.json' is not a valid JSON file. {e}")
            sys.exit(1)
        except Exception as e:
            print(f"Error reading 'pack.json': {e}")
            sys.exit(1)
    else:
        pack_data = create_pack_interactively(pack_dir)

    if pack_data and validate_pack_data(pack_data, tokens_dir=tokens_dir):
        create_gbtk_archive(pack_dir, pack_data)
    else:
        print("\nAborted due to validation errors or missing data.")


if __name__ == "__main__":
    main()