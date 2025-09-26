# Gamebook Studio

A digital tabletop companion for playing gamebooks and print-and-play board games, featuring real-time multiplayer and a rich set of annotation tools.



## ✨ Key Features

* **Advanced PDF Viewer**: Load and render multiple PDF files which serve as your digital game board.
* **Rich Annotation Toolkit**:
    * **Game Tokens**: Place and move tokens with a wide variety of shapes and colors. Includes a live preview for accurate placement.
    * **Drawing & Shapes**: A freehand drawing tool with selectable line widths and a rectangle tool with a live preview.
    * **Text Tool**: Add text notes directly onto the PDF with selectable font sizes.
    * **Versatile Eraser**: A smart eraser that removes any object type, including tokens, drawings, rectangles, and text.
    * **Pointer & Ruler**: A temporary pointer to highlight areas for others in real-time and a ruler to measure distances in pixels.
* **Layer Management**: Annotations are organized into distinct layers (Tokens, Drawings, Text) that can be individually toggled or cleared.
* **Comprehensive Session Tools**:
    * **Character Sheets**: Create and manage multiple character sheets using various templates.
    * **Counters & Notes**: Keep track of game resources with customizable counters and maintain session notes in a dedicated panel.
    * **Bookmark Navigation**: Quickly jump to sections using the PDF's native bookmarks.
* **Real-Time Multiplayer**:
    * **Live Collaboration**: Create or join a session to have all actions synchronized in real-time with other players.
    * **Efficient Sync**: Uses `jsondiffpatch` to send only small "delta" updates, and `pako` to compress layer data, ensuring low latency.
    * **Data Integrity**: Employs state versioning and CRC32 checksums to ensure all players' game states are consistent.
* **Modern UI/UX**:
    * **Dark Mode**: A sleek, eye-friendly dark theme for comfortable long sessions.
    * **Floating Dice Roller**: A convenient, draggable dice roller with support for complex expressions.
    * **Save/Load**: Save your entire session state, including all annotations and character sheets, to a JSON file and load it back later.

---

## 🛠️ Tech Stack

* **Frontend**: React, Tailwind CSS, PDF.js, Socket.IO Client
* **Backend**: Node.js, Express, Socket.IO
* **Key Libraries**:
    * `lucide-react` for icons
    * `jsondiffpatch` for efficient state synchronization
    * `pako` for real-time data compression
    * `multer` for PDF uploads

---

## 🚀 Getting Started

To get a local copy up and running, follow these simple steps.

### Prerequisites

* Node.js (v16 or later)
* npm

### Installation & Launch

1.  **Clone the repository:**
    ```sh
    git clone <your-repo-url>
    cd <your-repo-directory>
    ```

2.  **Install dependencies:**
    (This project uses a single `package.json` for both client and server dependencies).
    ```sh
    npm install
    ```

3.  **Run the backend server:**
    The server handles multiplayer sessions and PDF uploads.
    ```sh
    npm run server
    ```
    You should see the message: `Multiplayer server running on port 3001`.

4.  **Run the React frontend:**
    Open a new terminal window in the same directory.
    ```sh
    npm run start
    ```

5.  **[Optional] Run both server and client:**
    Open a new terminal window in the same directory.
    ```sh
    npm run dev
    ```

6.  **Open the application:**
    Navigate to `http://localhost:3000` in your web browser.

---

## 🔮 Future Enhancements

The current application is robust, but there are several exciting possibilities for future development:

* **User Authentication**: Implement user accounts for private, secure sessions and administrative controls for session hosts.
* **Optimistic Client Updates**: Make the UI feel even faster by applying changes locally before receiving confirmation from the server.
* **In-App Chat**: Add a chat panel for players to communicate within the session.
* **Action Log**: A running log of all major actions (dice rolls, token movements) to keep track of the game's progress.