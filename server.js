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

app.use(express.static(__dirname));


// ==========================================
// LOCAL UPLOAD SETUP
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

app.use(
    "/uploads",
    express.static(uploadsPath)
);


// ==========================================
// SUPABASE CONFIGURATION
// ==========================================

const SUPABASE_URL =
    process.env.SUPABASE_URL;

const SUPABASE_ANON_KEY =
    process.env.SUPABASE_ANON_KEY;

const SUPABASE_SERVICE_ROLE_KEY =
    process.env.SUPABASE_SERVICE_ROLE_KEY;


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

        if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {

            return res.status(500).json({
                error:
                    "Supabase environment variables are missing"
            });

        }

        const response = await fetch(
            `${SUPABASE_URL}/rest/v1/songs?select=*`,
            {
                method: "GET",

                headers: {
                    "apikey":
                        SUPABASE_ANON_KEY,

                    "Authorization":
                        `Bearer ${SUPABASE_ANON_KEY}`,

                    "Content-Type":
                        "application/json"
                }
            }
        );

        const data =
            await response.json();

        if (!response.ok) {

            console.error(
                "Supabase songs error:",
                data
            );

            return res.status(response.status).json({
                error: "Supabase error",
                details: data
            });
        }

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

        res.json(songs);

    } catch (error) {

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
// ADMIN ADD SONG
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

    async (req, res) => {

        try {

            // ------------------------------------------
            // CHECK SUPABASE SERVICE KEY
            // ------------------------------------------

            if (
                !SUPABASE_URL ||
                !SUPABASE_SERVICE_ROLE_KEY
            ) {

                return res.status(500).json({
                    error:
                        "Supabase service configuration is missing."
                });
            }


            // ------------------------------------------
            // FORM DATA
            // ------------------------------------------

            const {
                title,
                artist,
                album,
                release_date,
                quality
            } = req.body;


            if (!title || !artist) {

                return res.status(400).json({
                    error:
                        "Song title and artist are required."
                });
            }


            // ------------------------------------------
            // AUDIO FILE
            // ------------------------------------------

            if (
                !req.files ||
                !req.files.audio ||
                !req.files.audio[0]
            ) {

                return res.status(400).json({
                    error:
                        "Audio file is required."
                });
            }


            const audioFile =
                req.files.audio[0];


            const coverFile =
                req.files.cover &&
                req.files.cover[0]
                    ? req.files.cover[0]
                    : null;


            // ------------------------------------------
            // CREATE UNIQUE FILE NAMES
            // ------------------------------------------

            const audioExtension =
                path.extname(
                    audioFile.originalname
                );

            const audioFileName =
                Date.now() +
                "-" +
                Math.random()
                    .toString(36)
                    .substring(2, 8) +
                audioExtension;


            let coverFileName = null;

            if (coverFile) {

                const coverExtension =
                    path.extname(
                        coverFile.originalname
                    );

                coverFileName =
                    Date.now() +
                    "-" +
                    Math.random()
                        .toString(36)
                        .substring(2, 8) +
                    coverExtension;
            }


            // ------------------------------------------
            // UPLOAD AUDIO TO SUPABASE
            // ------------------------------------------

            const audioBuffer =
                fs.readFileSync(
                    audioFile.path
                );

            const audioUploadResponse =
                await fetch(

                    `${SUPABASE_URL}/storage/v1/object/audio1/${encodeURIComponent(audioFileName)}`,

                    {
                        method: "POST",

                        headers: {
                            "Authorization":
                                `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,

                            "apikey":
                                SUPABASE_SERVICE_ROLE_KEY,

                            "Content-Type":
                                audioFile.mimetype ||
                                "audio/mpeg",

                            "x-upsert":
                                "true"
                        },

                        body:
                            audioBuffer
                    }
                );


            if (!audioUploadResponse.ok) {

                const errorText =
                    await audioUploadResponse.text();

                console.error(
                    "Audio upload failed:",
                    errorText
                );

                return res.status(500).json({
                    error:
                        "Audio upload to Supabase failed.",
                    details:
                        errorText
                });
            }


            // ------------------------------------------
            // AUDIO PUBLIC URL
            // ------------------------------------------

            const audioUrl =
                `${SUPABASE_URL}/storage/v1/object/public/audio1/${encodeURIComponent(audioFileName)}`;


            // ------------------------------------------
            // UPLOAD COVER IF PROVIDED
            // ------------------------------------------

            let coverUrl = null;

            if (coverFile) {

                const coverBuffer =
                    fs.readFileSync(
                        coverFile.path
                    );

                const coverUploadResponse =
                    await fetch(

                        `${SUPABASE_URL}/storage/v1/object/audio1/${encodeURIComponent(coverFileName)}`,

                        {
                            method: "POST",

                            headers: {
                                "Authorization":
                                    `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,

                                "apikey":
                                    SUPABASE_SERVICE_ROLE_KEY,

                                "Content-Type":
                                    coverFile.mimetype ||
                                    "image/jpeg",

                                "x-upsert":
                                    "true"
                            },

                            body:
                                coverBuffer
                        }
                    );


                if (!coverUploadResponse.ok) {

                    const errorText =
                        await coverUploadResponse.text();

                    console.error(
                        "Cover upload failed:",
                        errorText
                    );

                    return res.status(500).json({
                        error:
                            "Cover upload to Supabase failed.",
                        details:
                            errorText
                    });
                }


                coverUrl =
                    `${SUPABASE_URL}/storage/v1/object/public/audio1/${encodeURIComponent(coverFileName)}`;
            }


            // ------------------------------------------
            // INSERT SONG INTO SUPABASE TABLE
            // ------------------------------------------

            const insertResponse =
                await fetch(
                    `${SUPABASE_URL}/rest/v1/songs`,
                    {
                        method: "POST",

                        headers: {
                            "apikey":
                                SUPABASE_SERVICE_ROLE_KEY,

                            "Authorization":
                                `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,

                            "Content-Type":
                                "application/json",

                            "Prefer":
                                "return=representation"
                        },

                        body:
                            JSON.stringify({

                                title:
                                    title,

                                artist:
                                    artist,

                                album:
                                    album || null,

                                audio_url:
                                    audioUrl,

                                cover_url:
                                    coverUrl,

                                quality:
                                    quality ||
                                    "Original",

                                release_date:
                                    release_date ||
                                    null
                            })
                    }
                );


            const insertData =
                await insertResponse.json();


            if (!insertResponse.ok) {

                console.error(
                    "Song database insert failed:",
                    insertData
                );

                return res.status(
                    insertResponse.status
                ).json({

                    error:
                        "Could not add song to Supabase.",

                    details:
                        insertData

                });
            }


            // ------------------------------------------
            // DELETE TEMPORARY LOCAL FILES
            // ------------------------------------------

            try {

                if (fs.existsSync(audioFile.path)) {
                    fs.unlinkSync(audioFile.path);
                }

                if (
                    coverFile &&
                    fs.existsSync(coverFile.path)
                ) {
                    fs.unlinkSync(coverFile.path);
                }

            } catch (cleanupError) {

                console.error(
                    "Temporary file cleanup error:",
                    cleanupError
                );
            }


            // ------------------------------------------
            // SUCCESS
            // ------------------------------------------

            console.log(
                `Song added to Supabase: ${title}`
            );

            res.json({

                success:
                    true,

                message:
                    "Song added successfully!",

                song:
                    insertData[0] || null
            });

        } catch (error) {

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