const express = require("express");
const cors = require("cors");
const path = require("path");

const app = express();

const PORT = process.env.PORT || 3000;
const WORKER_URL = process.env.WORKER_URL || "";

let projects = [];

app.use(cors());
app.use(express.json());

app.use(express.static(path.join(__dirname, "..", "frontend")));

app.get("/api/health", function(req, res) {
res.json({
success: true,
workerConfigured: WORKER_URL !== ""
});
});

app.get("/api/worker-health", async function(req, res) {
if (!WORKER_URL) {
return res.status(503).json({
success: false,
message: "WORKER_URL is not configured"
});
}

try {
    const response = await fetch(WORKER_URL + "/health");
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
    status: "starting",
    progress: 0
};

projects.push(project);

try {
    const response = await fetch(WORKER_URL + "/generate", {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            prompt: project.prompt
        })
    });

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
    project.status = data.status || "generating";
    project.progress = 10;

    res.status(202).json({
        success: true,
        project: project
    });
} catch (error) {
    project.status = "failed";

    res.status(503).json({
        success: false,
        project: project,
        error: error.message
    });
}

});

app.get("/api/projects//status", async function(req, res) {
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
        WORKER_URL + "/status/" + project.workerJobId
    );

    const data = await response.json();

    project.status = data.status || project.status;

    if (data.status === "generating") {
        project.progress = 50;
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
    }

    res.json({
        success: true,
        project: project
    });
} catch (error) {
    res.status(503).json({
        success: false,
        message: "Cannot contact Kaggle worker",
        error: error.message
    });
}

});

app.get("/api/projects/", function(req, res) {
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

app.get("/api/projects", function(req, res) {
res.json({
success: true,
projects: projects
});
});

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

app.listen(PORT, function() {
console.log(
"AI Video Generator running on port " + PORT
);
});
