### GBTK File Format Specification

```markdown
## GBTK File Format Specification

The `.gbtk` (Gamebook Tokens) file format is a distributable package for importing custom, thematic token sets into **Gamebook Studio**. It is a simplified subset of the `.gbs` format, designed specifically for sharing token assets.

### 1. Format Overview

A `.gbtk` file is a standard **ZIP archive** with a `.gbtk` file extension.

The internal structure of a `.gbtk` file is as follows:

```
my_fantasy_pack.gbtk
│
├── pack.json
│
└── tokens/
    ├── goblin_warrior.svg
    ├── skeleton_mage.png
    └── dragon_boss.jpg
```

### 2. File Contents

#### 2.1 `pack.json` (Required)

This is the manifest file for the token pack. It is a JSON object located at the root of the archive that contains metadata about the pack and a list of all the tokens included.

**`pack.json` Structure:**

| Field         | Type    | Description                                                     |
|---------------|---------|-----------------------------------------------------------------|
| `name`        | String  | The display name of the token pack (e.g., "Fantasy Monsters").    |
| `author`      | String  | The name of the creator or artist.                              |
| `description` | String  | A brief description of the pack's theme or contents.            |
| `version`     | String  | The version number of the pack (e.g., "1.0.0").                 |
| `tokens`      | Array   | An array of Token Objects that define each token in the pack.     |

**Token Object Structure:**

Each object within the `tokens` array has the following structure:

| Field      | Type   | Description                                                           |
|------------|--------|-----------------------------------------------------------------------|
| `name`     | String | The default name for the token as it will appear in the token menu.   |
| `fileName` | String | The exact filename of the corresponding image in the `tokens/` folder. |

**Example `pack.json`:**
```json
{
  "name": "Fantasy Monsters Pack",
  "author": "Pixelote",
  "description": "A set of common monsters for fantasy RPGs and gamebooks.",
  "version": "1.1.0",
  "tokens": [
    {
      "name": "Goblin Warrior",
      "fileName": "goblin_warrior.svg"
    },
    {
      "name": "Skeleton Mage",
      "fileName": "skeleton_mage.png"
    },
    {
      "name": "Dragon Boss",
      "fileName": "dragon_boss.jpg"
    }
  ]
}
```

---

#### 2.2 `tokens/` Directory (Required)

This directory is located at the root of the archive and contains all the actual image files for the tokens.

-   **Supported Formats**: The application supports common web image formats:
    -   **Vector**: `SVG`
    -   **Raster**: `PNG`, `JPG`/`JPEG`
-   **File Naming**: The filenames within this directory must exactly match the `fileName` values specified in the `pack.json` file.

---

### 3. Usage

-   **Creating:** An external script or tool can be used to bundle a `pack.json` file and a `tokens/` directory into a ZIP archive, which is then renamed with the `.gbtk` extension.
-   **Importing:** When a user loads a `.gbtk` file, Gamebook Studio unzips the archive, reads the `pack.json` manifest, and adds the tokens to the user's library of available custom tokens.