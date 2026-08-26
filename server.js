const express = require("express");
const cors = require("cors");
const path = require("path");
const fs = require("fs");
const multer = require("multer");

const db = require("./database");

const app = express();

// Render provides PORT
const PORT = process.env.PORT || 3000;

// Supabase configuration
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY;

app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

/* =========================================
   LOCAL UPLOADS
========================================= */

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

/* =========================================
   HEALTH
========================================= */

app.get("/api/health", (req, res) => {
    res.json({
        status: "ok",
        app: "Unbothered",
        message: "Unbothered server is running!"
    });
});

/* =========================================
   GET SONGS FROM SUPABASE
========================================= */

app.get("/api/songs", async (req, res) => {

    try {

        // Make sure Supabase environment variables exist
        if (!SUPABASE_URL || !SUPABASE_KEY) {

            console.error(
                "Supabase environment variables are missing."
            );

            return res.status(500).json({
                error: "Supabase configuration is missing."
            });
        }

        const url =
            `${SUPABASE_URL}/rest/v1/songs` +
            `?select=id,title,artist,audio_url,cover_url` +
            `&order=id.desc`;

        const response = await fetch(url, {
            method: "GET",

            headers: {
                "apikey": SUPABASE_KEY,
                "Authorization": `Bearer ${SUPABASE_KEY}`,
                "Content-Type": "application/json"
            }
        });

        const data = await response.json();

        if (!response.ok) {

            console.error(
                "Supabase error:",
                data
            );

            return res.status(response.status).json({
                error: "Could not load songs from Supabase.",
                details: data
            });
        }

        /*
           Convert Supabase column names
           
           audio_url -> audio
           cover_url -> cover

           because index.html expects:
           song.audio
           song.cover
        */

        const songs = data.map(song => {

            return {
                id: song.id,

                title: song.title || "Unknown Song",

                artist: song.artist || "Unknown Artist",

                album: null,

                quality: "Original",

                audio: song.audio_url,

                cover: song.cover_url || null
            };

        });

        console.log(
            `Loaded ${songs.length} song(s) from Supabase.`
        );

        res.json(songs);

    } catch (error) {

        console.error(
            "Supabase connection error:",
            error
        );

        res.status(500).json({
            error: "Failed to connect to Supabase."
        });
    }

});

/* =========================================
   ADD SONG
   CURRENT LOCAL ADMIN UPLOAD
========================================= */

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

            const audioFile =
                req.files.audio[0];

            const coverFile =
                req.files.cover
                    ? req.files.cover[0]
                    : null;

            const audioPath =
                "/uploads/" +
                audioFile.filename;

            const coverPath =
                coverFile
                    ? "/uploads/" +
                      coverFile.filename
                    : null;

            const result =
                db.prepare(`
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

/* =========================================
   START SERVER
========================================= */

app.listen(PORT, "0.0.0.0", () => {

    console.log(
        `Unbothered server running on port ${PORT}`
    );

});