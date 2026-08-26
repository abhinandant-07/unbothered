const express = require("express");
const cors = require("cors");
const path = require("path");
const fs = require("fs");
const multer = require("multer");

const db = require("./database");

const app = express();

const PORT = process.env.PORT || 3000;

// ==========================================
// MIDDLEWARE
// ==========================================

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve frontend
app.use(express.static(__dirname));


// ==========================================
// LOCAL UPLOADS
// ==========================================

const uploadsPath = path.join(__dirname, "uploads");

if (!fs.existsSync(uploadsPath)) {
    fs.mkdirSync(uploadsPath);
}

const storage = multer.diskStorage({

    destination: function (req, file, cb) {
        cb(null, uploadsPath);
    },

    filename: function (req, file, cb) {

        const extension =
            path.extname(file.originalname);

        const filename =
            Date.now() +
            "-" +
            Math.random()
                .toString(36)
                .substring(2, 8) +
            extension;

        cb(null, filename);
    }
});

const upload = multer({
    storage: storage
});

app.use(
    "/uploads",
    express.static(uploadsPath)
);


// ==========================================
// HEALTH CHECK
// ==========================================

app.get("/api/health", (req, res) => {

    res.json({
        status: "ok",
        app: "Unbothered",
        message: "Unbothered server is running!"
    });

});


// ==========================================
// GET SONGS FROM SUPABASE
// ==========================================

app.get("/api/songs", async (req, res) => {

    try {

        const supabaseUrl =
            process.env.SUPABASE_URL;

        const supabaseKey =
            process.env.SUPABASE_ANON_KEY;


        // Check environment variables
        if (!supabaseUrl || !supabaseKey) {

            console.error(
                "Supabase environment variables are missing"
            );

            return res.status(500).json({

                error:
                    "Supabase environment variables are missing"

            });
        }


        // Request songs from Supabase
        const response = await fetch(

            `${supabaseUrl}/rest/v1/songs?select=*`,

            {
                method: "GET",

                headers: {

                    "apikey":
                        supabaseKey,

                    "Authorization":
                        `Bearer ${supabaseKey}`,

                    "Content-Type":
                        "application/json"
                }
            }

        );


        // Read Supabase response
        const data =
            await response.json();


        // Supabase error
        if (!response.ok) {

            console.error(
                "Supabase error:",
                data
            );

            return res.status(
                response.status
            ).json({

                error:
                    "Supabase error",

                details:
                    data

            });
        }


        // ==========================================
        // IMPORTANT:
        // Convert Supabase column names
        // to the names expected by index.html
        //
        // audio_url -> audio
        // cover_url -> cover
        // ==========================================

        const songs =
            data.map(song => ({

                id:
                    song.id,

                title:
                    song.title,

                artist:
                    song.artist,

                album:
                    song.album || null,

                cover:
                    song.cover_url || null,

                audio:
                    song.audio_url,

                quality:
                    song.quality || "Original",

                release_date:
                    song.release_date || null

            }));


        console.log(
            "Songs fetched:",
            songs.length
        );


        // Send songs to frontend
        res.json(songs);

    }

    catch (error) {

        console.error(
            "Songs API error:",
            error
        );

        res.status(500).json({

            error:
                "Failed to fetch songs",

            details:
                error.message

        });

    }

});


// ==========================================
// ADD SONG
// ==========================================

app.post(

    "/api/songs",

    upload.fields([

        {
            name: "audio",
            maxCount: 1
        },

        {
            name: "cover",
            maxCount: 1
        }

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


            // Check title
            if (!title || !artist) {

                return res.status(400).json({

                    error:
                        "Song title and artist are required."

                });

            }


            // Check audio
            if (
                !req.files ||
                !req.files.audio
            ) {

                return res.status(400).json({

                    error:
                        "Audio file is required."

                });

            }


            const audioFile =
                req.files.audio[0];


            // Cover is optional
            const coverFile =
                req.files.cover
                    ? req.files.cover[0]
                    : null;


            // Audio path
            const audioPath =
                "/uploads/" +
                audioFile.filename;


            // Cover path
            const coverPath =
                coverFile
                    ? "/uploads/" +
                      coverFile.filename
                    : null;


            // Save to local database
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

                    VALUES
                    (?, ?, ?, ?, ?, ?, ?)

                `).run(

                    title,

                    artist,

                    album || null,

                    coverPath,

                    audioPath,

                    quality ||
                        "Original",

                    release_date ||
                        null

                );


            console.log(
                "Song added:",
                title
            );


            res.json({

                success:
                    true,

                message:
                    "Song added successfully!",

                songId:
                    result.lastInsertRowid,

                audio:
                    audioPath,

                cover:
                    coverPath

            });

        }

        catch (error) {

            console.error(
                "Add song error:",
                error
            );

            res.status(500).json({

                error:
                    "Failed to add song.",

                details:
                    error.message

            });

        }

    }

);


// ==========================================
// START SERVER
// ==========================================

app.listen(

    PORT,

    "0.0.0.0",

    () => {

        console.log(
            `Unbothered server running on port ${PORT}`
        );

    }

);