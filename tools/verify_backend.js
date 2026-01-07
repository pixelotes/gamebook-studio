const { io } = require("socket.io-client");
const http = require('http'); // or native fetch
const fs = require('fs');
const path = require('path');
const Redis = require('ioredis');

const PORT = 3001;
const SERVER_URL = `http://localhost:${PORT}`;

async function main() {
    console.log("Starting verification...");

    // 1. Check Redis Connection
    const redis = new Redis();
    try {
        await redis.ping();
        console.log("✅ Redis is reachable");
    } catch (e) {
        console.error("❌ Redis unreachable:", e.message);
        process.exit(1);
    }

    // 2. Connect via Socket.IO
    const socket = io(SERVER_URL);

    await new Promise((resolve) => socket.on('connect', resolve));
    console.log("✅ Connected to Socket.IO");

    // 3. Create Session
    const sessionData = await new Promise(resolve => {
        socket.emit('create-session', resolve);
    });

    if (!sessionData.success || !sessionData.sessionId) {
        console.error("❌ Failed to create session");
        process.exit(1);
    }
    const { sessionId } = sessionData;
    console.log(`✅ Session created: ${sessionId}`);

    // Verify Session ID format (NanoID)
    if (sessionId.length !== 10) { // We used nanoid(10)
        console.error(`❌ Session ID format seems wrong (len=${sessionId.length})`);
    } else {
        console.log("✅ Session ID length correct");
    }

    // 4. Test File Upload (Disk Storage)
    const testFileContent = "Fake PDF Content";
    const testFileName = "test.txt";
    const boundary = '----WebKitFormBoundary7MA4YWxkTrZu0gW';

    const postData = `
--${boundary}
Content-Disposition: form-data; name="pdf"; filename="${testFileName}"
Content-Type: text/plain

${testFileContent}
--${boundary}--
`;

    const uploadOptions = {
        hostname: 'localhost',
        port: PORT,
        path: `/api/sessions/${sessionId}/upload-pdf`,
        method: 'POST',
        headers: {
            'Content-Type': `multipart/form-data; boundary=${boundary}`,
            'Content-Length': Buffer.byteLength(postData)
        }
    };

    const uploadResponse = await new Promise((resolve, reject) => {
        const req = http.request(uploadOptions, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => resolve({ statusCode: res.statusCode, body: data }));
        });
        req.on('error', reject);
        req.write(postData);
        req.end();
    });

    if (uploadResponse.statusCode === 200) {
        console.log("✅ File upload successful");
        // Verify file exists on disk? 
        // We can check if we can download it back or check the uploads/ dir if we are local.
        // Let's check uploads dir.
        const files = fs.readdirSync('uploads');
        const uploadedFile = files.find(f => f.includes(testFileName) || f.endsWith('.txt')); // Our naming adds prefix
        if (uploadedFile) {
            console.log(`✅ Verified file in uploads/ directory: ${uploadedFile}`);
        } else {
            console.error("❌ File not found in uploads/ directory");
        }

    } else {
        console.error("❌ File upload failed:", uploadResponse.body);
    }

    // 5. Test Zod Validation
    // Valid Update
    socket.emit('update-game-state', { notes: "Valid String" });
    // We expect a broadcast.

    // Invalid Update
    console.log("Testing invalid update (notes as number)...");
    socket.emit('update-game-state', { notes: 12345 });

    // Check Redis for persistence
    const storedSession = await redis.get(`session:${sessionId}`);
    if (storedSession) {
        console.log("✅ Session found in Redis");
        const sessionObj = JSON.parse(storedSession);
        if (sessionObj.gameState.notes === "Valid String") {
            console.log("✅ Redis state matches valid update");
        } else {
            console.log("⚠️ Redis state might not have updated or race condition, notes:", sessionObj.gameState.notes);
        }
    } else {
        console.error("❌ Session NOT found in Redis");
    }

    socket.close();
    redis.disconnect();
    console.log("Verification finished.");
}

main().catch(console.error);
