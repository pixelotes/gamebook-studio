## GBS File Format Specification

The `.gbs` file format is the standard file format for saving and loading game sessions in **Gamebook Studio**. It is a compressed archive that contains all the necessary information to restore a game session, including PDF files, annotations, character sheets, and other game state data.

### 1. Format Overview

A `.gbs` file is a standard **ZIP archive** with a `.gbs` file extension. This format allows for easy packaging of all session-related assets into a single, portable file.

The internal structure of a `.gbs` file is as follows:

```
- / (root)
  - game.json
  - session.json
  - /pdfs
    - example_book_1.pdf
    - example_book_2.pdf
    - ...
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

**Example `game.json`:**
```json
{
  "name": "The Warlock of Firetop Mountain",
  "year": "1982",
  "author": "Steve Jackson and Ian Livingstone",
  "description": "A classic fantasy gamebook adventure.",
  "players": "1",
  "length": "1-2 hours"
}
```

#### 2.2 `session.json`

This file contains the complete state of the game session. It is a JSON object with the following fields:

| Field            | Type    | Description                                                                                                                                                                                                                                     |
|------------------|---------|-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| `pdfs`           | Array   | An array of objects, where each object represents a PDF file used in the session. See [PDF Object Structure](#221-pdf-object-structure) for more details.                                                                                        |
| `activePdfId`    | String  | The ID of the PDF that is currently active in the primary viewing pane.                                                                                                                                                                         |
| `secondaryPdfId` | String  | The ID of the PDF in the secondary viewing pane (if in dual-pane mode).                                                                                                                                                                         |
| `isDualPaneMode` | Boolean | A boolean flag indicating whether the application is in dual-pane mode.                                                                                                                                                                           |
| `characters`     | Array   | An array of character sheet objects.                                                                                                                                                                                                            |
| `notes`          | String  | A string containing the game notes.                                                                                                                                                                                                             |
| `counters`       | Array   | An array of counter objects.                                                                                                                                                                                                                    |
| `version`        | Number  | The version of the game state, used for multiplayer synchronization.                                                                                                                                                                            |

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
| `bookmarks`   | Array   | An array of bookmark objects, representing the PDF's table of contents.     |

#### 2.3 `pdfs/` directory

This directory contains the actual PDF files used in the game session. The filenames in this directory correspond to the `fileName` field in the `session.json` `pdfs` array.

### 3. Usage

-   **Exporting:** When a user exports a session as a `.gbs` file, the application gathers all the necessary data, creates the `game.json` and `session.json` files, and packages them along with the PDF files into a ZIP archive.
-   **Importing:** When a user loads a `.gbs` file, the application unzips the archive, reads the JSON files to restore the game state and metadata, and loads the PDF files from the `pdfs` directory.