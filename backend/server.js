const express = require("express");
const cors = require("cors");
const path = require("path");

const app = express();

const PORT = process.env.PORT || 3000;

const WORKER_URL =
process.env.WORKER_URL ||
"https://submitted-oops-nitrogen-alliance.trycloudflare.com";

const projects = [];

app.use(express.json());
app.use(cors());

app.use(
express.static(
path.join(__dirname, "..", "frontend")
)
);

/* =========================
API HEALTH
========================= */

app.get("/api/health", function (req, res) {

```
res.json({
    success: true,
    message: "AI Video Generator API is running!",
    worker: WORKER_URL
});
```

});

/* =========================
WORKER HEALTH
========================= */

app.get("/api/worker-health", async function (req, res) {

```
try {

    const response = await fetch(
        WORKER_URL + "/health"
    );

    const data = await response.json();

    if (!response.ok) {

        return res.status(503).json({
            success: false,
            message: "Wan2.1 worker returned an error.",
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
        message: "Wan2.1 worker is not reachable.",
        error: error.message
    });

}
```

});

/* =========================
GENERATE VIDEO
========================= */

app.post("/api/generate", async function (req, res) {

```
const prompt = req.body.prompt;
const videoType = req.body.videoType;
const duration = req.body.duration;
const voiceLanguage = req.body.voiceLanguage;
const clipLength = req.body.clipLength;

if (!prompt || !prompt.trim()) {

    return res.status(400).json({
        success: false,
        message: "Video prompt is required."
    });

}

const project = {

    id: "video_" + Date.now(),

    prompt: prompt.trim(),

    videoType: videoType || "short",

    duration: duration || 5,

    voiceLanguage:
        voiceLanguage || "english",

    clipLength:
        clipLength || 5,

    status: "generating",

    progress: 10,

    message:
        "Sending prompt to Wan2.1...",

    createdAt:
        new Date().toISOString()

};

projects.push(project);

console.log("");
console.log("================================");
console.log("NEW VIDEO GENERATION REQUEST");
console.log("================================");

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
    "Worker:",
    WORKER_URL
);

console.log("================================");
console.log("");

try {

    project.message =
        "Wan2.1 is generating the video...";

    project.progress = 20;

    const workerResponse =
        await fetch(
            WORKER_URL + "/generate",
            {
                method: "POST",

                headers: {
                    "Content-Type":
                        "application/json"
                },

                body: JSON.stringify({
                    prompt:
                        project.prompt
                })
            }
        );

    const workerData =
        await workerResponse.json();

    console.log(
        "Wan2.1 response:",
        workerData
    );

    if (!workerResponse.ok) {

        project.status = "failed";

        project.progress = 0;

        project.message =
            workerData.error ||
            workerData.message ||
            "Wan2.1 generation failed.";

        project.updatedAt =
            new Date().toISOString();

        return res.status(500).json({

            success: false,

            project: project,

            message:
                project.message

        });

    }

    if (
        workerData.status ===
        "completed"
    ) {

        project.status =
            "completed";

        project.progress = 100;

        project.message =
            "Video generated successfully.";

        project.filename =
            workerData.filename;

        project.workerVideoUrl =
            WORKER_URL +
            workerData.video_url;

        project.videoUrl =
            project.workerVideoUrl;

        project.updatedAt =
            new Date().toISOString();

        console.log("");
        console.log(
            "VIDEO GENERATION COMPLETED"
        );

        console.log(
            "Project:",
            project.id
        );

        console.log(
            "Video:",
            project.videoUrl
        );

        console.log("");

        return res.json({

            success: true,

            project: project,

            video: {

                filename:
                    workerData.filename,

                url:
                    project.videoUrl

            }

        });

    }

    project.status = "failed";

    project.progress = 0;

    project.message =
        "Wan2.1 returned an unexpected response.";

    project.updatedAt =
        new Date().toISOString();

    return res.status(500).json({

        success: false,

        project: project,

        worker: workerData,

        message:
            project.message

    });

} catch (error) {

    console.error(
        "Wan2.1 connection error:",
        error.message
    );

    project.status = "failed";

    project.progress = 0;

    project.message =
        "Could not connect to Wan2.1.";

    project.updatedAt =
        new Date().toISOString();

    return res.status(503).json({

        success: false,

        project: project,

        message:
            "Could not connect to Wan2.1 worker.",

        error:
            error.message

    });

}
```

});

/* =========================
PROJECT LIST
========================= */

app.get(
"/api/projects",
function (req, res) {

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

/* =========================
GET ONE PROJECT
========================= */

app.get(
"/api/projects/:id",
function (req, res) {

```
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
```

);

/* =========================
UPDATE PROJECT STATUS
========================= */

app.post(
"/api/projects/:id/status",
function (req, res) {

```
    const projectId =
        req.params.id;

    const status =
        req.body.status;

    const progress =
        req.body.progress;

    const message =
        req.body.message;

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
        progress !==
        undefined
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

    res.json({

        success: true,

        project:
            project

    });

}
```

);

/* =========================
START SERVER
========================= */

app.listen(
PORT,
function () {

```
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
        "Server running on port " +
        PORT
    );

    console.log(
        "Wan2.1 Worker: " +
        WORKER_URL
    );

    console.log(
        "================================"
    );

    console.log("");

}
```

);
