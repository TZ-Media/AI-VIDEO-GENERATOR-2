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

app.get("/api/health", function (req, res) {
res.json({
success: true,
message: "AI Video Generator API is running!",
worker: WORKER_URL
});
});

app.get("/api/worker-health", async function (req, res) {
try {
const response = await fetch(WORKER_URL + "/health");
const data = await response.json();

```
    res.json({
        success: true,
        worker: data
    });
} catch (error) {
    console.error("Worker health error:", error.message);

    res.status(503).json({
        success: false,
        message: "Wan2.1 worker is not reachable.",
        error: error.message
    });
}
```

});

app.post("/api/generate", async function (req, res) {
const prompt = req.body.prompt;

```
if (!prompt || !prompt.trim()) {
    return res.status(400).json({
        success: false,
        message: "Video prompt is required."
    });
}

const project = {
    id: "video_" + Date.now(),
    prompt: prompt.trim(),
    videoType: req.body.videoType || "short",
    duration: req.body.duration || 5,
    voiceLanguage: req.body.voiceLanguage || "english",
    clipLength: req.body.clipLength || 5,
    status: "generating",
    progress: 10,
    message: "Sending prompt to Wan2.1...",
    createdAt: new Date().toISOString()
};

projects.push(project);

console.log("New video request:", project.id);
console.log("Prompt:", project.prompt);

try {
    project.message = "Wan2.1 is generating the video...";
    project.progress = 20;

    const response = await fetch(
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

    const data = await response.json();

    console.log("Wan2.1 response:", data);

    if (!response.ok) {
        project.status = "failed";
        project.progress = 0;
        project.message =
            data.error ||
            data.message ||
            "Wan2.1 generation failed.";

        return res.status(500).json({
            success: false,
            project: project
        });
    }

    if (data.status !== "completed") {
        project.status = "failed";
        project.progress = 0;
        project.message =
            "Wan2.1 returned an unexpected response.";

        return res.status(500).json({
            success: false,
            project: project,
            worker: data
        });
    }

    project.status = "completed";
    project.progress = 100;
    project.message = "Video generated successfully.";
    project.filename = data.filename;

    project.videoUrl =
        WORKER_URL + data.video_url;

    project.updatedAt =
        new Date().toISOString();

    return res.json({
        success: true,
        project: project,
        video: {
            filename: data.filename,
            url: project.videoUrl
        }
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

    return res.status(503).json({
        success: false,
        project: project,
        error: error.message
    });
}
```

});

app.get("/api/projects", function (req, res) {
res.json({
success: true,
count: projects.length,
projects: projects
});
});

app.get("/api/projects/:id", function (req, res) {
const project = projects.find(function (item) {
return item.id === req.params.id;
});

```
if (!project) {
    return res.status(404).json({
        success: false,
        message: "Project not found."
    });
}

res.json({
    success: true,
    project: project
});
```

});

app.post("/api/projects/:id/status", function (req, res) {
const project = projects.find(function (item) {
return item.id === req.params.id;
});

```
if (!project) {
    return res.status(404).json({
        success: false,
        message: "Project not found."
    });
}

if (req.body.status) {
    project.status = req.body.status;
}

if (req.body.progress !== undefined) {
    project.progress = Number(req.body.progress);
}

if (req.body.message) {
    project.message = req.body.message;
}

project.updatedAt =
    new Date().toISOString();

res.json({
    success: true,
    project: project
});
```

});

app.listen(PORT, function () {
console.log("================================");
console.log("AI VIDEO GENERATOR BACKEND");
console.log("================================");
console.log("Server running on port " + PORT);
console.log("Wan2.1 Worker: " + WORKER_URL);
console.log("================================");
});
