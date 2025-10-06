# 📖 Gamebook Studio

**Gamebook Studio** is a modern, web-based digital tabletop for playing gamebooks and print-and-play board games. Featuring real-time multiplayer, a rich set of annotation tools, and an intuitive interface, it's designed to bring your favorite tabletop experiences into the digital realm with ease and style.

Whether you're collaborating on a complex strategy game or exploring a solo adventure, Gamebook Studio provides the tools you need in one clean, efficient workspace.

---

## ✨ Key Features

-   **Advanced PDF Viewer**: Load multiple PDFs to serve as your digital game board, map, or rulebook.
-   **Rich Annotation Toolkit**: Place tokens, draw freely, add text notes, and measure distances directly on the page.
-   **Real-Time Multiplayer**: Create or join a session and have all your actions synchronized in real-time with other players.
-   **Comprehensive Session Tools**: Manage character sheets, track resources with counters, and navigate PDFs with bookmarks.
-   **Save & Load**: Save your entire session, including annotations and character sheets, to a single file and pick up right where you left off.

---

## 🛠️ Tech Stack

This project is built with a modern, efficient, and scalable technology stack.

-   **Frontend**: Vite, React, Tailwind CSS
-   **Backend**: Node.js, Express, Socket.IO
-   **Key Libraries**:
    -   **PDF Rendering**: PDF.js
    -   **Real-time Sync**: `jsondiffpatch` for efficient state synchronization.
    -   **Data Compression**: `pako` for compressing data to ensure low latency.
    -   *File Handling**: `multer` for robust PDF uploads on the server.

---

## 🚀 Getting Started

You can run Gamebook Studio either manually on your local machine or through Docker.

### Prerequisites

-   **Node.js**: Version 20.x or higher is required to run the application with Vite.
-   **npm**: Should be included with your Node.js installation.
-   **(Optional) Docker**: Required only if you choose the Docker setup.

---

### Manual Installation & Launch

1.  **Clone the Repository**
    ```sh
    git clone [https://github.com/pixelotes/gamebook-studio.git](https://github.com/pixelotes/gamebook-studio.git)
    cd gamebook-studio
    ```

2.  **Install Dependencies**
    This single command installs both client and server dependencies.
    ```sh
    npm install
    ```

3.  **Run the Development Server**
    This command concurrently starts the backend server and the Vite frontend client.
    ```sh
    npm run dev
    ```
    - The multiplayer server will run on port `3001`.
    - The React application will be available at `http://localhost:3000`.

---

### Docker Installation & Launch

For a containerized and isolated environment, you can use Docker and Docker Compose.

1.  **Clone the Repository** (if you haven't already)
    ```sh
    git clone [https://github.com/pixelotes/gamebook-studio.git](https://github.com/pixelotes/gamebook-studio.git)
    cd gamebook-studio
    ```

2.  **Build and Run with Docker Compose**
    Use the `docker-compose.dev.yml` file to build the images and run the containers. This setup uses a single service to run both the client and server.
    ```sh
    docker-compose -f docker-compose.dev.yml up --build
    ```
    The application will be accessible at `http://localhost:3000`, with both client and server ports exposed.

---

## 📄 License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.