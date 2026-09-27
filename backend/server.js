```javascript
const express = require("express");
const cors = require("cors");
const path = require("path");

const app = express();

const PORT = process.env.PORT || 3000;
const WORKER_URL = (process.env.WORKER_URL || "").replace(/\/+$/, "");

let projects = [];

app.use(cors());
app.use(express.json());

app.use(express.static(path.join(__dirname, "..", "frontend")));

// ------------------------------------------------------------
// Render backend health
// ------------------------------------------------------------

app.get("/api/health", function(req, res) {
    res.json({
        success: true,
        service: "TZ Media AI Video Generator",
        workerConfigured: WORKER_URL !== ""
    });
});

// ------------------------------------------------------------
// Kaggle worker health
// ------------------------------------------------------------

app.get("/api/worker-health", async function(req, res) {
    if (!WORKER_URL) {
        return res.status(503).json({
            success: false,
            message: "WORKER_URL is not configured"
        });
    }

    try {
        const response = await fetch(
            WORKER_URL + "/health"
        );

        const data = await response.json();

        res.status(response.status).json({
            success: response.ok,
            worker: data
        });

    } catch (error) {
        res.status(503).json({
            success: false,
            message: "Cannot connect to Kaggle worker",
            error: error.message
        });
    }
});

// ------------------------------------------------------------
// Create video generation job
// ------------------------------------------------------------

app.post("/api/generate", async function(req, res) {
    const prompt = req.body.prompt || "";

    if (!prompt.trim()) {
        return res.status(400).json({
            success: false,
            message: "Video prompt is required"
        });
    }

    if (!WORKER_URL) {
        return res.status(503).json({
            success: false,
            message: "WORKER_URL is not configured"
        });
    }

    const project = {
        id: "video_" + Date.now(),
        prompt: prompt.trim(),
        videoType: req.body.videoType || "short",
        duration: req.body.duration || 5,
        voiceLanguage: req.body.voiceLanguage || "english",
        clipLength: req.body.clipLength || 8,

        // Current safe Wan2.1 test configuration
        width: 320,
        height: 480,
        frames: 17,
        seed: Number.isInteger(req.body.seed)
            ? req.body.seed
            : 42,

        status: "starting",
        progress: 0,
        workerJobId: null,
        videoUrl: null
    };

    projects.push(project);

    try {
        const response = await fetch(
            WORKER_URL + "/generate",
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    prompt: project.prompt,
                    width: project.width,
                    height: project.height,
                    frames: project.frames,
                    seed: project.seed
                })
            }
        );

        const data = await response.json();

        if (!response.ok || !data.job_id) {
            project.status = "failed";

            return res.status(502).json({
                success: false,
                project: project,
                worker: data
            });
        }

        project.workerJobId = data.job_id;
        project.status = data.status || "queued";
        project.progress = 10;

        return res.status(202).json({
            success: true,
            project: project
        });

    } catch (error) {
        project.status = "failed";

        return res.status(503).json({
            success: false,
            project: project,
            error: error.message
        });
    }
});

// ------------------------------------------------------------
// Check project status
// ------------------------------------------------------------

app.get("/api/projects/:id/status", async function(req, res) {
    const project = projects.find(function(item) {
        return item.id === req.params.id;
    });

    if (!project) {
        return res.status(404).json({
            success: false,
            message: "Project not found"
        });
    }

    if (!project.workerJobId) {
        return res.json({
            success: true,
            project: project
        });
    }

    try {
        const response = await fetch(
            WORKER_URL +
            "/status/" +
            project.workerJobId
        );

        const data = await response.json();

        project.status = data.status || project.status;

        if (data.status === "queued") {
            project.progress = 10;
        }

        if (data.status === "loading_model") {
            project.progress = 20;
        }

        if (data.status === "generating") {
            project.progress = 50;
        }

        if (data.status === "encoding") {
            project.progress = 90;
        }

        if (data.status === "completed") {
            project.progress = 100;

            project.videoUrl =
                WORKER_URL +
                "/video/" +
                project.workerJobId;
        }

        if (data.status === "failed") {
            project.progress = 0;
            project.error = data.error || "Video generation failed";
        }

        return res.json({
            success: true,
            project: project,
            worker: data
        });

    } catch (error) {
        return res.status(503).json({
            success: false,
            message: "Cannot contact Kaggle worker",
            error: error.message
        });
    }
});

// ------------------------------------------------------------
// Get one project
// ------------------------------------------------------------

app.get("/api/projects/:id", function(req, res) {
    const project = projects.find(function(item) {
        return item.id === req.params.id;
    });

    if (!project) {
        return res.status(404).json({
            success: false,
            message: "Project not found"
        });
    }

    res.json({
        success: true,
        project: project
    });
});

// ------------------------------------------------------------
// Get all projects
// ------------------------------------------------------------

app.get("/api/projects", function(req, res) {
    res.json({
        success: true,
        projects: projects
    });
});

// ------------------------------------------------------------
// Frontend
// ------------------------------------------------------------

app.get("/", function(req, res) {
    res.sendFile(
        path.join(
            __dirname,
            "..",
            "frontend",
            "index.html"
        )
    );
});

// ------------------------------------------------------------
// Start server
// ------------------------------------------------------------

app.listen(PORT, function() {
    console.log(
        "AI Video Generator running on port " + PORT
    );

    console.log(
        "WORKER_URL configured: " +
        (WORKER_URL !== "")
    );
});
```
