require("dotenv").config();

const express = require("express");
const cors = require("cors");
const path = require("path");
const { createClient } = require("@supabase/supabase-js");
const multer = require("multer");

const app = express();

const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

const upload = multer({
    storage: multer.memoryStorage()
});


/* =========================================
   SUPABASE
========================================= */

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_ANON_KEY
);


/* =========================================
   HEALTH CHECK
========================================= */

app.get("/api/health", (req, res) => {

    res.json({
        status: "ok",
        app: "Unbothered",
        message: "Unbothered server is running!"
    });

});


/* =========================================
   GET ALL SONGS
========================================= */

app.get("/api/songs", async (req, res) => {

    try {

        const { data, error } = await supabase
            .from("songs")
            .select("id,title,artist,audio_url,cover_url")
            .order("id", {
                ascending: false
            });


        if (error) {

            console.error(
                "GET SONGS ERROR:",
                error
            );

            return res.status(500).json({
                error: error.message
            });

        }


        res.json(data);

    } catch (error) {

        console.error(
            "SERVER ERROR:",
            error
        );

        res.status(500).json({
            error: error.message
        });

    }

});


/* =========================================
   ADD SONG
========================================= */

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

            console.log(
                "ADD SONG REQUEST RECEIVED"
            );


            const title =
                req.body.title;

            const artist =
                req.body.artist;


            if (!title || !artist) {

                return res.status(400).json({
                    error:
                        "Title and artist are required."
                });

            }


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
                req.files.cover[0];


            /* =================================
               AUDIO FILE NAME
            ================================= */

            const audioFileName =
                Date.now() +
                "-" +
                audioFile.originalname
                    .replace(/\s+/g, "-");


            console.log(
                "Uploading audio:",
                audioFileName
            );


            /* =================================
               UPLOAD AUDIO
            ================================= */

            const {
                error: audioUploadError
            } = await supabase.storage
                .from("audio1")
                .upload(
                    audioFileName,
                    audioFile.buffer,
                    {
                        contentType:
                            audioFile.mimetype,
                        upsert: false
                    }
                );


            if (audioUploadError) {

                console.error(
                    "AUDIO UPLOAD ERROR:",
                    audioUploadError
                );

                return res.status(500).json({
                    error:
                        audioUploadError.message
                });

            }


            const {
                data: audioPublicData
            } = supabase.storage
                .from("audio1")
                .getPublicUrl(
                    audioFileName
                );


            const audioUrl =
                audioPublicData.publicUrl;


            /* =================================
               COVER IMAGE
            ================================= */

            let coverUrl = null;


            if (coverFile) {

                const coverFileName =
                    Date.now() +
                    "-" +
                    coverFile.originalname
                        .replace(/\s+/g, "-");


                const {
                    error: coverUploadError
                } = await supabase.storage
                    .from("audio1")
                    .upload(
                        coverFileName,
                        coverFile.buffer,
                        {
                            contentType:
                                coverFile.mimetype,
                            upsert: false
                        }
                    );


                if (coverUploadError) {

                    console.error(
                        "COVER UPLOAD ERROR:",
                        coverUploadError
                    );

                    return res.status(500).json({
                        error:
                            coverUploadError.message
                    });

                }


                const {
                    data: coverPublicData
                } = supabase.storage
                    .from("audio1")
                    .getPublicUrl(
                        coverFileName
                    );


                coverUrl =
                    coverPublicData.publicUrl;

            }


            /* =================================
               INSERT SONG
            ================================= */

            const {
                data,
                error
            } = await supabase
                .from("songs")
                .insert({
                    title: title,
                    artist: artist,
                    audio_url: audioUrl,
                    cover_url: coverUrl
                })
                .select(
                    "id,title,artist,audio_url,cover_url"
                );


            if (error) {

                console.error(
                    "INSERT SONG ERROR:",
                    error
                );

                return res.status(500).json({
                    error: error.message
                });

            }


            const newSong =
                data && data.length > 0
                    ? data[0]
                    : null;


            console.log(
                "SONG ADDED:",
                newSong
            );


            res.status(201).json({
                success: true,
                message:
                    "Song added successfully.",
                song: newSong
            });


        } catch (error) {

            console.error(
                "ADD SONG SERVER ERROR:",
                error
            );

            res.status(500).json({
                error: error.message
            });

        }

    }
);


/* =========================================
   EDIT SONG
========================================= */

app.put(
    "/api/songs/:id",

    async (req, res) => {

        try {

            const songId =
                req.params.id;

            const title =
                req.body.title;

            const artist =
                req.body.artist;


            console.log(
                "EDIT SONG REQUEST:",
                songId
            );

            console.log(
                "NEW TITLE:",
                title
            );

            console.log(
                "NEW ARTIST:",
                artist
            );


            if (!title || !artist) {

                return res.status(400).json({
                    error:
                        "Title and artist are required."
                });

            }


            /* =================================
               UPDATE ONLY REAL COLUMNS
            ================================= */

            const {
                data,
                error
            } = await supabase
                .from("songs")
                .update({
                    title: title,
                    artist: artist
                })
                .eq("id", songId)
                .select(
                    "id,title,artist,audio_url,cover_url"
                );


            if (error) {

                console.error(
                    "EDIT SONG DATABASE ERROR:",
                    error
                );

                return res.status(500).json({
                    error:
                        "Could not update song: " +
                        error.message
                });

            }


            if (!data || data.length === 0) {

                return res.status(404).json({
                    error:
                        "Song not found or could not be updated."
                });

            }


            const updatedSong =
                data[0];


            console.log(
                "SONG UPDATED:",
                updatedSong
            );


            res.json({
                success: true,
                message:
                    "Song updated successfully.",
                song: updatedSong
            });


        } catch (error) {

            console.error(
                "EDIT SONG SERVER ERROR:",
                error
            );

            res.status(500).json({
                error:
                    "Could not update song: " +
                    error.message
            });

        }

    }
);


/* =========================================
   DELETE SONG
========================================= */

app.delete(
    "/api/songs/:id",

    async (req, res) => {

        try {

            const songId =
                req.params.id;


            console.log(
                "DELETE SONG REQUEST:",
                songId
            );


            /* =================================
               FIND SONG
            ================================= */

            const {
                data: songData,
                error: findError
            } = await supabase
                .from("songs")
                .select(
                    "id,title,artist,audio_url,cover_url"
                )
                .eq("id", songId)
                .limit(1);


            if (findError) {

                console.error(
                    "FIND SONG ERROR:",
                    findError
                );

                return res.status(500).json({
                    error:
                        findError.message
                });

            }


            if (
                !songData ||
                songData.length === 0
            ) {

                return res.status(404).json({
                    error:
                        "Song not found."
                });

            }


            /* =================================
               DELETE DATABASE RECORD
            ================================= */

            const {
                error: deleteError
            } = await supabase
                .from("songs")
                .delete()
                .eq("id", songId);


            if (deleteError) {

                console.error(
                    "DELETE SONG DATABASE ERROR:",
                    deleteError
                );

                return res.status(500).json({
                    error:
                        deleteError.message
                });

            }


            console.log(
                "SONG DELETED:",
                songData[0]
            );


            res.json({
                success: true,
                message:
                    "Song deleted successfully."
            });


        } catch (error) {

            console.error(
                "DELETE SONG SERVER ERROR:",
                error
            );

            res.status(500).json({
                error:
                    error.message
            });

        }

    }
);


/* =========================================
   START SERVER
========================================= */

app.listen(
    PORT,
    () => {

        console.log(
            `Unbothered server running on port ${PORT}`
        );

    }
);