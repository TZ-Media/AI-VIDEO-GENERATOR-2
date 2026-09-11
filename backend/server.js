const express = require("express");
const cors = require("cors");
const path = require("path");

const app = express();

const PORT = process.env.PORT || 3000;

const WORKER_URL = process.env.WORKER_URL;

if (WORKER_URL) {
console.log("Kaggle worker URL configured.");
} else {
console.warn("WARNING: WORKER_URL is not configured.");
}

const projects = [];

app.use(cors());

app.use(express.json());

app.use(
express.static(
path.join(__dirname, "..", "frontend")
)
);

// ============================================================
// HEALTH CHECK
// ============================================================

app.get("/api/health", function(req, res) {

```
res.json({
    success: true,
    message: "AI Video Generator API is running!",
    workerConfigured: !!WORKER_URL
});
```

});

// ============================================================
// KAGGLE WORKER HEALTH
// ============================================================

app.get("/api/worker-health", async function(req, res) {

```
if (!WORKER_URL) {

    return res.status(503).json({
        success: false,
        message: "WORKER_URL is not configured."
    });

}

try {

    const response = await fetch(
        WORKER_URL + "/health"
    );

    const data = await response.json();

    if (!response.ok) {

        return res.status(503).json({
            success: false,
            message: "Kaggle worker returned an error.",
            worker: data
        });

    }

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
        message: "Kaggle Wan2.1 worker is not reachable.",
        error: error.message
    });

}
```

});

// ============================================================
// CREATE VIDEO GENERATION JOB
// ============================================================

app.post("/api/generate", async function(req, res) {

```
const prompt = req.body.prompt;
const videoType = req.body.videoType;
const duration = req.body.duration;
const voiceLanguage = req.body.voiceLanguage;
const clipLength = req.body.clipLength;


// --------------------------------------------------------
// CHECK PROMPT
// --------------------------------------------------------

if (!prompt || !prompt.trim()) {

    return res.status(400).json({
        success: false,
        message: "Video prompt is required."
    });

}


// --------------------------------------------------------
// CHECK WORKER
// --------------------------------------------------------

if (!WORKER_URL) {

    return res.status(503).json({
        success: false,
        message: "Kaggle worker is not configured."
    });

}


// --------------------------------------------------------
// CREATE PROJECT
// --------------------------------------------------------

const project = {

    id: "video_" + Date.now(),

    prompt: prompt.trim(),

    videoType: videoType || "short",

    duration: duration || 5,

    voiceLanguage: voiceLanguage || "english",

    clipLength: clipLength || 8,

    status: "starting",

    progress: 0,

    message: "Sending request to Kaggle Wan2.1...",

    createdAt: new Date().toISOString()

};


projects.push(project);


console.log("");
console.log("================================");
console.log("NEW VIDEO GENERATION REQUEST");
console.log("================================");
console.log("Project ID:", project.id);
console.log("Prompt:", project.prompt);
console.log("Video type:", project.videoType);
console.log("Duration:", project.duration);
console.log("Voice:", project.voiceLanguage);
console.log("Clip length:", project.clipLength);
console.log("================================");
console.log("");


// --------------------------------------------------------
// SEND JOB TO KAGGLE
// --------------------------------------------------------

try {

    const workerResponse = await fetch(
        WORKER_URL + "/generate",
        {
            method: "POST",

            headers: {
                "Content-Type": "application/json"
            },

            body: JSON.stringify({
                prompt: project.prompt
            })
        }
    );


    const workerData =
        await workerResponse.json();


    console.log(
        "Kaggle response:",
        workerData
    );


    // ----------------------------------------------------
    // WORKER ERROR
    // ----------------------------------------------------

    if (!workerResponse.ok) {

        project.status = "failed";

        project.progress = 0;

        project.message =
            workerData.error ||
            workerData.message ||
            "Kaggle Wan2.1 rejected the request.";

        project.updatedAt =
            new Date().toISOString();


        return res.status(502).json({

            success: false,

            project: project,

            message: project.message

        });

    }


    // ----------------------------------------------------
    // JOB ACCEPTED
    // ----------------------------------------------------

    if (workerData.job_id) {

        project.workerJobId =
            workerData.job_id;

        project.status =
            workerData.status || "generating";

        project.progress = 10;

        project.message =
            "Kaggle Wan2.1 is generating the video.";

        project.statusUrl =
            WORKER_URL +
            "/status/" +
            workerData.job_id;

        project.workerVideoUrl =
            WORKER_URL +
            "/video/" +
            workerData.job_id;

        project.updatedAt =
            new Date().toISOString();


        return res.status(202).json({

            success: true,

            message:
                "Video generation started.",

            project: project

        });

    }


    // ----------------------------------------------------
    // UNEXPECTED RESPONSE
    // ----------------------------------------------------

    project.status = "failed";

    project.progress = 0;

    project.message =
        "Kaggle returned an unexpected response.";

    project.updatedAt =
        new Date().toISOString();


    return res.status(502).json({

        success: false,

        project: project,

        worker: workerData,

        message: project.message

    });


} catch (error) {

    console.error(
        "Kaggle connection error:",
        error.message
    );


    project.status = "failed";

    project.progress = 0;

    project.message =
        "Could not connect to Kaggle Wan2.1.";

    project.updatedAt =
        new Date().toISOString();


    return res.status(503).json({

        success: false,

        project: project,

        message: project.message,

        error: error.message

    });

}
```

});

// ============================================================
// CHECK PROJECT / KAGGLE JOB STATUS
// ============================================================

app.get(
"/api/projects/:id/status",
async function(req, res) {

```
    const projectId =
        req.params.id;


    const project =
        projects.find(function(item) {

            return item.id === projectId;

        });


    if (!project) {

        return res.status(404).json({

            success: false,

            message: "Project not found."

        });

    }


    // ----------------------------------------------------
    // NO WORKER JOB YET
    // ----------------------------------------------------

    if (!project.workerJobId) {

        return res.json({

            success: true,

            project: project

        });

    }


    // ----------------------------------------------------
    // CHECK KAGGLE
    // ----------------------------------------------------

    try {

        const response =
            await fetch(
                WORKER_URL +
                "/status/" +
                project.workerJobId
            );


        const data =
            await response.json();


        if (!response.ok) {

            project.status = "failed";

            project.message =
                data.error ||
                data.message ||
                "Kaggle status request failed.";

            project.updatedAt =
                new Date().toISOString();


            return res.status(502).json({

                success: false,

                project: project,

                worker: data

            });

        }


        // ------------------------------------------------
        // UPDATE STATUS
        // ------------------------------------------------

        if (data.status) {

            project.status =
                data.status;

        }


        // ------------------------------------------------
        // GENERATING
        // ------------------------------------------------

        if (
            data.status === "generating"
        ) {

            if (project.progress < 20) {

                project.progress = 20;

            }

            project.message =
                "Wan2.1 is generating the video.";

        }


        // ------------------------------------------------
        // COMPLETED
        // ------------------------------------------------

        if (
            data.status === "completed"
        ) {

            project.status =
                "completed";

            project.progress =
                100;

            project.message =
                "Video generated successfully.";

            project.videoUrl =
                WORKER_URL +
                "/video/" +
                project.workerJobId;

            project.workerVideoUrl =
                project.videoUrl;

            project.updatedAt =
                new Date().toISOString();

        }


        // ------------------------------------------------
        // FAILED
        // ------------------------------------------------

        if (
            data.status === "failed"
        ) {

            project.status =
                "failed";

            project.progress =
                0;

            project.message =
                data.error ||
                data.message ||
                "Wan2.1 generation failed.";

            project.updatedAt =
                new Date().toISOString();

        }


        return res.json({

            success: true,

            project: project,

            worker: data

        });


    } catch (error) {

        console.error(
            "Status check error:",
            error.message
        );


        return res.status(503).json({

            success: false,

            message:
                "Could not contact Kaggle worker.",

            error:
                error.message,

            project:
                project

        });

    }

}
```

);

// ============================================================
// GET ALL PROJECTS
// ============================================================

app.get(
"/api/projects",
function(req, res) {

```
    res.json({

        success: true,

        count:
            projects.length,

        projects:
            projects

    });

}
```

);

// ============================================================
// GET ONE PROJECT
// ============================================================

app.get(
"/api/projects/:id",
function(req, res) {

```
    const projectId =
        req.params.id;


    const project =
        projects.find(function(item) {

            return item.id === projectId;

        });


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
```

);

// ============================================================
// ROOT
// ============================================================

app.get(
"/",
function(req, res) {

```
    res.sendFile(
        path.join(
            __dirname,
            "..",
            "frontend",
            "index.html"
        )
    );

}
```

);

// ============================================================
// START SERVER
// ============================================================

app.listen(
PORT,
function() {

```
    console.log("");
    console.log("================================");
    console.log("AI VIDEO GENERATOR BACKEND");
    console.log("================================");

    console.log(
        "Server running on port " + PORT
    );

    console.log(
        "Kaggle worker configured:",
        !!WORKER_URL
    );

    console.log("================================");
    console.log("");

}
```

);
