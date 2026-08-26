const express = require("express");
const cors = require("cors");
const path = require("path");
const fs = require("fs");
const multer = require("multer");

const db = require("./database");

const app = express();

// Render provides PORT; local computer uses 3000
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

const uploadsPath = path.join(__dirname, "uploads");

if (!fs.existsSync(uploadsPath)) {
    fs.mkdirSync(uploadsPath);
}

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, uploadsPath);
    },

    filename: function (req, file, cb) {
        const extension = path.extname(file.originalname);

        const filename =
            Date.now() +
            "-" +
            Math.random().toString(36).substring(2, 8) +
            extension;

        cb(null, filename);
    }
});

const upload = multer({
    storage: storage
});

app.use("/uploads", express.static(uploadsPath));

app.get("/api/health", (req, res) => {
    res.json({
        status: "ok",
        app: "Unbothered",
        message: "Unbothered server is running!"
    });
});

// Get all songs
app.get("/api/songs", (req, res) => {

    const songs = db.prepare(`
        SELECT *
        FROM songs
        ORDER BY created_at DESC
    `).all();

    res.json(songs);
});

// Add a song
app.post(
    "/api/songs",
    upload.fields([
        { name: "audio", maxCount: 1 },
        { name: "cover", maxCount: 1 }
    ]),
    (req, res) => {

        try {

            const {
                title,
                artist,
                album,
                release_date,
                quality
            } = req.body;

            if (!title || !artist) {
                return res.status(400).json({
                    error: "Song title and artist are required."
                });
            }

            if (!req.files || !req.files.audio) {
                return res.status(400).json({
                    error: "Audio file is required."
                });
            }

            const audioFile = req.files.audio[0];

            const coverFile =
                req.files.cover
                    ? req.files.cover[0]
                    : null;

            const audioPath =
                "/uploads/" + audioFile.filename;

            const coverPath =
                coverFile
                    ? "/uploads/" + coverFile.filename
                    : null;

            const result = db.prepare(`
                INSERT INTO songs
                (
                    title,
                    artist,
                    album,
                    cover,
                    audio,
                    quality,
                    release_date
                )
                VALUES (?, ?, ?, ?, ?, ?, ?)
            `).run(
                title,
                artist,
                album || null,
                coverPath,
                audioPath,
                quality || "Original",
                release_date || null
            );

            res.json({
                success: true,
                message: "Song added successfully!",
                songId: result.lastInsertRowid
            });

        } catch (error) {

            console.error(error);

            res.status(500).json({
                error: "Failed to add song."
            });
        }
    }
);

// IMPORTANT: Render needs 0.0.0.0 and its assigned PORT
app.listen(PORT, "0.0.0.0", () => {

    console.log(
        `Unbothered server running on port ${PORT}`
    );

});