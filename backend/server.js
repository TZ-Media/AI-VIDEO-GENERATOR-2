const express = require("express");
const cors = require("cors");
const path = require("path");

const app = express();

const PORT = process.env.PORT || 3000;
const WORKER_URL = process.env.WORKER_URL || "";

let projects = [];

app.use(cors());
app.use(express.json());


// ============================================================
// HEALTH CHECK
// ============================================================

app.get("/api/health", (req, res) => {
    res.json({
        status: "online",
        service: "TZ Media AI Video Generator",
        workerConfigured: WORKER_URL !== ""
    });
});


// ============================================================
// WORKER HEALTH
// ============================================================

app.get("/api/worker-health", async (req, res) => {
    try {
        if (!WORKER_URL) {
            return res.status(500).json({
                status: "error",
                message: "WORKER_URL is not configured"
            });
        }

        const response = await fetch(WORKER_URL + "/health");

        const data = await response.json();

        res.json(data);

    } catch (error) {
        res.status(500).json({
            status: "error",
            message: "Could not connect to Kaggle worker",
            error: error.message
        });
    }
});


// ============================================================
// GENERATE VIDEO
// ============================================================

app.post("/api/generate", async (req, res) => {

    try {

        const prompt = req.body.prompt;

        if (!prompt || prompt.trim() === "") {
            return res.status(400).json({
                error: "Prompt is required"
            });
        }

        if (!WORKER_URL) {
            return res.status(500).json({
                error: "WORKER_URL is not configured"
            });
        }

        const projectId = "project_" + Date.now();

        const project = {
            id: projectId,
            prompt: prompt,
            status: "queued",
            progress: 0,
            videoUrl: null,
            workerJobId: null,
            createdAt: new Date().toISOString()
        };

        projects.push(project);

        // Safe test settings for the current Wan2.1 worker.
        const workerRequest = {
            prompt: prompt,
            width: 320,
            height: 480,
            frames: 17,
            seed: 42
        };

        const workerResponse = await fetch(
            WORKER_URL + "/generate",
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify(workerRequest)
            }
        );

        if (!workerResponse.ok) {

            const errorText = await workerResponse.text();

            project.status = "failed";

            return res.status(500).json({
                error: "Kaggle worker rejected the request",
                details: errorText
            });
        }

        const workerData = await workerResponse.json();

        project.workerJobId =
            workerData.job_id ||
            workerData.id ||
            null;

        project.status = "loading_model";

        res.json({
            success: true,
            projectId: projectId,
            workerJobId: project.workerJobId,
            status: project.status
        });

    } catch (error) {

        console.error("Generate error:", error);

        res.status(500).json({
            error: "Video generation failed",
            details: error.message
        });
    }
});


// ============================================================
// PROJECT STATUS
// ============================================================

app.get("/api/projects/:id/status", async (req, res) => {

    try {

        const project = projects.find(
            p => p.id === req.params.id
        );

        if (!project) {
            return res.status(404).json({
                error: "Project not found"
            });
        }

        if (!project.workerJobId) {
            return res.json({
                projectId: project.id,
                status: project.status,
                progress: project.progress
            });
        }

        const workerResponse = await fetch(
            WORKER_URL +
            "/status/" +
            project.workerJobId
        );

        if (!workerResponse.ok) {

            return res.status(500).json({
                error: "Could not get worker status"
            });
        }

        const workerData = await workerResponse.json();

        const workerStatus = workerData.status;

        if (workerStatus === "queued") {
            project.status = "queued";
            project.progress = 5;
        }

        else if (workerStatus === "loading_model") {
            project.status = "loading_model";
            project.progress = 15;
        }

        else if (workerStatus === "generating") {
            project.status = "generating";
            project.progress = 60;
        }

        else if (workerStatus === "encoding") {
            project.status = "encoding";
            project.progress = 90;
        }

        else if (workerStatus === "completed") {

            project.status = "completed";
            project.progress = 100;

            project.videoUrl =
                WORKER_URL +
                "/video/" +
                project.workerJobId;
        }

        else if (workerStatus === "failed") {

            project.status = "failed";
            project.progress = 0;
        }

        res.json({
            projectId: project.id,
            workerJobId: project.workerJobId,
            status: project.status,
            progress: project.progress,
            videoUrl: project.videoUrl,
            worker: workerData
        });

    } catch (error) {

        console.error("Status error:", error);

        res.status(500).json({
            error: "Could not check project status",
            details: error.message
        });
    }
});


// ============================================================
// GET PROJECT
// ============================================================

app.get("/api/projects/:id", (req, res) => {

    const project = projects.find(
        p => p.id === req.params.id
    );

    if (!project) {
        return res.status(404).json({
            error: "Project not found"
        });
    }

    res.json(project);
});


// ============================================================
// GET ALL PROJECTS
// ============================================================

app.get("/api/projects", (req, res) => {

    res.json(projects);
});


// ============================================================
// FRONTEND
// ============================================================

const frontendPath = path.join(
    __dirname,
    "../frontend"
);

app.use(express.static(frontendPath));


// ============================================================
// FRONTEND FALLBACK
// ============================================================

app.get("*", (req, res) => {

    res.sendFile(
        path.join(frontendPath, "index.html")
    );
});


// ============================================================
// START SERVER
// ============================================================

app.listen(PORT, () => {

    console.log(
        "Server running on port " + PORT
    );

    console.log(
        "Worker URL:",
        WORKER_URL || "NOT CONFIGURED"
    );
});
