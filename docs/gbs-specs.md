## GBS File Format Specification

The `.gbs` file format is the standard file format for saving and loading game sessions in **Gamebook Studio**. It is a compressed archive that contains all the necessary information to restore a game session, including PDF files, custom tokens, annotations, character sheets, and other game state data.

### 1. Format Overview

A `.gbs` file is a standard **ZIP archive** with a `.gbs` file extension. This format allows for easy packaging of all session-related assets into a single, portable file.

The internal structure of a `.gbs` file is as follows:

```
my_game_session.gbs
│
├── game.json
├── session.json
│
├── pdfs/
│   ├── gamebook.pdf
│   └── rules_reference.pdf
│
└── tokens/  (Optional)
    ├── player_character.svg
    └── enemy_orc.png
```

### 2. File Contents

#### 2.1 `game.json`

This file contains metadata about the game itself. It is a JSON object with the following fields:

| Field         | Type   | Description                                     |
|---------------|--------|-------------------------------------------------|
| `name`        | String | The name of the game.                             |
| `year`        | String | The year the game was published.                  |
| `author`      | String | The author or creator of the game.                |
| `description` | String | A brief description of the game.                  |
| `players`     | String | The recommended number of players (e.g., "1-4").  |
| `length`      | String | The estimated playing time (e.g., "2-3 hours").   |

---

#### 2.2 `session.json`

This file contains the complete state of the game session. It is a JSON object with the following fields:

| Field            | Type    | Description                                                                     |
|------------------|---------|---------------------------------------------------------------------------------|
| `pdfs`           | Array   | An array of PDF Objects used in the session.                                    |
| `activePdfId`    | String  | The ID of the PDF in the primary viewing pane.                                  |
| `secondaryPdfId` | String  | The ID of the PDF in the secondary viewing pane (if in dual-pane mode).         |
| `isDualPaneMode` | Boolean | A flag indicating if the application is in dual-pane mode.                      |
| `characters`     | Array   | An array of character sheet objects.                                            |
| `notes`          | String  | A string containing the game notes.                                             |
| `counters`       | Array   | An array of counter objects.                                                    |
| `version`        | Number  | The version of the game state, for multiplayer synchronization.                 |
| `customTokens`   | Array   | (Optional) An array of Custom Token Objects included in the session.              |

##### 2.2.1 PDF Object Structure

Each object in the `pdfs` array has the following structure:

| Field         | Type    | Description                                                                 |
|---------------|---------|-----------------------------------------------------------------------------|
| `id`          | String  | A unique identifier for the PDF.                                            |
| `fileName`    | String  | The original filename of the PDF.                                           |
| `currentPage` | Number  | The page number that was being viewed.                                      |
| `scale`       | Number  | The zoom level of the PDF.                                                  |
| `pageLayers`  | Object  | An object containing the annotation data for each page.                     |
| `totalPages`  | Number  | The total number of pages in the PDF.                                       |
| `bookmarks`   | Array   | An array of bookmark objects from the PDF's table of contents.              |

##### 2.2.2 Custom Token Object Structure

Each object in the `customTokens` array has the following structure:

| Field      | Type   | Description                                                         |
|------------|--------|---------------------------------------------------------------------|
| `name`     | String | The display name for the token in the token selection menu.         |
| `fileName` | String | The exact filename of the corresponding image in the `tokens/` folder. |

---

#### 2.3 `pdfs/` Directory

This directory contains the actual PDF files used in the game session. The filenames in this directory correspond to the `fileName` field in the `session.json` `pdfs` array.

#### 2.4 `tokens/` Directory (Optional)

This directory is only included if the session contains custom tokens. It holds the image files (e.g., `.svg`, `.png`, `.jpg`) for each custom token listed in the `customTokens` array of `session.json`.

---

### 3. Usage

-   **Exporting:** The application gathers all session data, creates the `game.json` and `session.json` files, and packages them along with any PDF and custom token image files into a ZIP archive with a `.gbs` extension.
-   **Importing:** The application unzips the `.gbs` file, reads the JSON files to restore the game state and metadata, and loads the PDFs and custom tokens from their respective directories.