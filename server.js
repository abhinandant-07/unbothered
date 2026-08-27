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
            .select("*")
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

            const album =
                req.body.album;

            const release_date =
                req.body.release_date;

            const quality =
                req.body.quality;


            console.log(
                "TITLE:",
                title
            );

            console.log(
                "ARTIST:",
                artist
            );


            /* ---------------------------------
               CHECK TITLE & ARTIST
            --------------------------------- */

            if (!title || !artist) {

                return res.status(400).json({
                    error:
                        "Title and artist are required."
                });

            }


            /* ---------------------------------
               CHECK AUDIO FILE
            --------------------------------- */

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


            /* =================================
               AUDIO UPLOAD
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


            const {
                error: audioError
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


            if (audioError) {

                console.error(
                    "AUDIO UPLOAD ERROR:",
                    audioError
                );

                return res.status(400).json({
                    error:
                        "Audio upload failed: " +
                        audioError.message
                });

            }


            /* ---------------------------------
               AUDIO PUBLIC URL
            --------------------------------- */

            const {
                data: audioPublicData
            } = supabase.storage
                .from("audio1")
                .getPublicUrl(
                    audioFileName
                );


            const audioUrl =
                audioPublicData.publicUrl;


            console.log(
                "AUDIO URL:",
                audioUrl
            );


            /* =================================
               COVER IMAGE
            ================================= */

            let coverUrl = null;


            if (
                req.files.cover &&
                req.files.cover[0]
            ) {

                const coverFile =
                    req.files.cover[0];


                const coverFileName =
                    Date.now() +
                    "-" +
                    coverFile.originalname
                        .replace(/\s+/g, "-");


                console.log(
                    "Uploading cover:",
                    coverFileName
                );


                const {
                    error: coverError
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


                if (coverError) {

                    console.error(
                        "COVER UPLOAD ERROR:",
                        coverError
                    );

                    return res.status(400).json({
                        error:
                            "Cover upload failed: " +
                            coverError.message
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
               INSERT SONG INTO DATABASE
            ================================= */

            console.log(
                "Inserting song into Supabase..."
            );


            const {
                data,
                error: insertError
            } = await supabase
                .from("songs")
                .insert([
                    {
                        title: title,

                        artist: artist,

                        album: album || null,

                        release_date:
                            release_date || null,

                        quality:
                            quality || "Original",

                        audio_url:
                            audioUrl,

                        cover_url:
                            coverUrl
                    }
                ])
                .select()
                .single();


            if (insertError) {

                console.error(
                    "DATABASE INSERT ERROR:",
                    insertError
                );

                return res.status(400).json({
                    error:
                        "Database insert failed: " +
                        insertError.message
                });

            }


            console.log(
                "SONG ADDED:",
                data
            );


            /* =================================
               SUCCESS
            ================================= */

            res.json({

                success: true,

                message:
                    "Song added successfully!",

                song: data

            });


        } catch (error) {

            console.error(
                "ADD SONG SERVER ERROR:",
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


            /* ---------------------------------
               GET SONG FIRST
            --------------------------------- */

            const {
                data: song,
                error: fetchError
            } = await supabase
                .from("songs")
                .select("*")
                .eq("id", songId)
                .single();


            if (fetchError || !song) {

                console.error(
                    "FETCH SONG ERROR:",
                    fetchError
                );

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
                    "DELETE DATABASE ERROR:",
                    deleteError
                );

                return res.status(400).json({
                    error:
                        "Could not delete song: " +
                        deleteError.message
                });

            }


            console.log(
                "SONG DELETED:",
                song.title
            );


            /* =================================
               SUCCESS
            ================================= */

            res.json({

                success: true,

                message:
                    "Song deleted successfully.",

                song: song

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
    "0.0.0.0",
    () => {

        console.log(
            `Unbothered server running on port ${PORT}`
        );

    }
);