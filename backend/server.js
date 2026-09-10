const express = require("express");
const cors = require("cors");
const path = require("path");

const app = express();

const PORT = process.env.PORT || 3000;

// Python AI Worker
const WORKER_URL =
    process.env.WORKER_URL || "http://localhost:8000";

// Store video projects in memory
const projects = [];

// Middleware
app.use(express.json());
app.use(cors());

// Serve frontend
app.use(
    express.static(
        path.join(__dirname, "..", "frontend")
    )
);


// ========================================
// HEALTH CHECK
// ========================================

app.get("/api/health", (req, res) => {

    res.json({

        success: true,

        message:
            "AI Video Generator API is running!",

        worker:
            WORKER_URL

    });

});


// ========================================
// WORKER HEALTH CHECK
// ========================================

app.get("/api/worker-health", async (req, res) => {

    try {

        const response =
            await fetch(
                `${WORKER_URL}/health`
            );

        const data =
            await response.json();

        res.json({

            success: true,

            worker: data

        });

    } catch (error) {

        console.error(
            "Worker health error:",
            error.message
        );

        res.status(503).json({

            success: false,

            message:
                "AI worker is not reachable.",

            error:
                error.message

        });

    }

});


// ========================================
// CREATE VIDEO PROJECT
// ========================================

app.post("/api/generate", async (req, res) => {

    const {

        prompt,

        videoType,

        duration,

        voiceLanguage,

        clipLength

    } = req.body;


    // Check prompt
    if (
        !prompt ||
        !prompt.trim()
    ) {

        return res.status(400).json({

            success: false,

            message:
                "Video prompt is required."

        });

    }


    // Create project
    const project = {

        id:
            "video_" +
            Date.now(),

        prompt:
            prompt.trim(),

        videoType:
            videoType || "short",

        duration:
            duration || 5,

        voiceLanguage:
            voiceLanguage || "english",

        clipLength:
            clipLength || 5,

        status:
            "queued",

        progress:
            0,

        message:
            "Sending job to AI worker...",

        createdAt:
            new Date().toISOString()

    };


    // Save project
    projects.push(project);


    console.log("");
    console.log(
        "================================"
    );
    console.log(
        "New video generation request"
    );
    console.log(
        "================================"
    );
    console.log(
        "Project ID:",
        project.id
    );
    console.log(
        "Prompt:",
        project.prompt
    );
    console.log(
        "Video type:",
        project.videoType
    );
    console.log(
        "Duration:",
        project.duration
    );
    console.log(
        "Voice:",
        project.voiceLanguage
    );
    console.log(
        "Clip length:",
        project.clipLength
    );
    console.log(
        "================================"
    );
    console.log("");


    try {

        // Send job to Python worker
        const workerResponse =
            await fetch(
                `${WORKER_URL}/generate`,
                {

                    method: "POST",

                    headers: {

                        "Content-Type":
                            "application/json"

                    },

                    body:
                        JSON.stringify({

                            prompt:
                                project.prompt,

                            videoType:
                                project.videoType,

                            duration:
                                project.duration,

                            voiceLanguage:
                                project.voiceLanguage,

                            clipLength:
                                project.clipLength

                        })

                }
            );


        const workerData =
            await workerResponse.json();


        // Worker returned an error
        if (!workerResponse.ok) {

            project.status =
                "failed";

            project.progress =
                0;

            project.message =
                workerData.message ||
                "AI worker rejected the job.";

            project.updatedAt =
                new Date().toISOString();


            return res.status(500).json({

                success: false,

                project: project,

                message:
                    project.message

            });

        }


        // Worker accepted job
        if (
            workerData.success
        ) {

            project.workerJobId =
                workerData.job.id;

            project.status =
                workerData.job.status ||
                "queued";

            project.progress =
                0;

            project.message =
                "AI worker accepted the video job.";

            project.updatedAt =
                new Date().toISOString();

        }


        console.log(
            "Worker response:",
            workerData
        );


        // Return project
        res.json({

            success: true,

            project: project,

            worker:
                workerData.job

        });


    } catch (error) {

        console.error(
            "Error connecting to AI worker:",
            error.message
        );


        project.status =
            "failed";

        project.progress =
            0;

        project.message =
            "Could not connect to AI worker.";

        project.updatedAt =
            new Date().toISOString();


        res.status(503).json({

            success: false,

            project: project,

            message:
                "AI worker is not reachable.",

            error:
                error.message

        });

    }

});


// ========================================
// GET ALL PROJECTS
// ========================================

app.get(
    "/api/projects",
    (req, res) => {

        res.json({

            success: true,

            count:
                projects.length,

            projects:
                projects

        });

    }
);


// ========================================
// GET ONE PROJECT
// ========================================

app.get(
    "/api/projects/:id",
    (req, res) => {

        const projectId =
            req.params.id;


        const project =
            projects.find(
                function (item) {

                    return (
                        item.id ===
                        projectId
                    );

                }
            );


        if (!project) {

            return res.status(404).json({

                success: false,

                message:
                    "Project not found."

            });

        }


        res.json({

            success: true,

            project:
                project

        });

    }
);


// ========================================
// MANUAL STATUS UPDATE
// ========================================

app.post(
    "/api/projects/:id/status",
    (req, res) => {

        const projectId =
            req.params.id;


        const {

            status,

            progress,

            message

        } = req.body;


        const project =
            projects.find(
                function (item) {

                    return (
                        item.id ===
                        projectId
                    );

                }
            );


        if (!project) {

            return res.status(404).json({

                success: false,

                message:
                    "Project not found."

            });

        }


        if (status) {

            project.status =
                status;

        }


        if (
            progress !== undefined
        ) {

            project.progress =
                Number(progress);

        }


        if (message) {

            project.message =
                message;

        }


        project.updatedAt =
            new Date().toISOString();


        console.log(
            "Manual project update:",
            project
        );


        res.json({

            success: true,

            project:
                project

        });

    }
);


// ========================================
// START SERVER
// ========================================

app.listen(
    PORT,
    () => {

        console.log("");
        console.log(
            "================================"
        );
        console.log(
            "AI VIDEO GENERATOR BACKEND"
        );
        console.log(
            "================================"
        );
        console.log(
            `Server running on port ${PORT}`
        );
        console.log(
            `AI Worker: ${WORKER_URL}`
        );
        console.log(
            "================================"
        );
        console.log("");

    }
);