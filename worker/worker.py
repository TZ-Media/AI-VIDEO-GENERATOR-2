from flask import Flask, request, jsonify
from flask_cors import CORS

import os
import uuid
import threading
import time


# ========================================
# FLASK APP
# ========================================

app = Flask(__name__)

CORS(app)


# ========================================
# CONFIGURATION
# ========================================

PORT = int(
    os.environ.get(
        "PORT",
        8000
    )
)


# ========================================
# JOB STORAGE
# ========================================

jobs = {}


# ========================================
# HEALTH CHECK
# ========================================

@app.route(
    "/health",
    methods=["GET"]
)
def health():

    return jsonify({

        "success": True,

        "worker":
            "AI Video Worker",

        "status":
            "online",

        "message":
            "AI video worker is ready."

    })


# ========================================
# CREATE JOB
# ========================================

@app.route(
    "/generate",
    methods=["POST"]
)
def generate():

    data = request.get_json(
        silent=True
    )


    # Check request
    if not data:

        return jsonify({

            "success": False,

            "message":
                "Request body is required."

        }), 400


    # Get prompt
    prompt = data.get(
        "prompt",
        ""
    )


    # Check prompt
    if not prompt.strip():

        return jsonify({

            "success": False,

            "message":
                "Video prompt is required."

        }), 400


    # Get settings
    video_type = data.get(
        "videoType",
        "short"
    )

    duration = data.get(
        "duration",
        5
    )

    voice_language = data.get(
        "voiceLanguage",
        "english"
    )

    clip_length = data.get(
        "clipLength",
        5
    )


    # Create job ID
    job_id = (
        "job_" +
        str(uuid.uuid4())
    )


    # Create job
    job = {

        "id":
            job_id,

        "prompt":
            prompt.strip(),

        "videoType":
            video_type,

        "duration":
            duration,

        "voiceLanguage":
            voice_language,

        "clipLength":
            clip_length,

        "status":
            "queued",

        "progress":
            0,

        "message":
            "Job queued.",

        "videoUrl":
            None,

        "audioUrl":
            None,

        "finalVideoUrl":
            None,

        "createdAt":
            time.strftime(
                "%Y-%m-%dT%H:%M:%SZ",
                time.gmtime()
            )

    }


    # Save job
    jobs[job_id] = job


    # Display job information
    print("")
    print(
        "================================"
    )
    print(
        "NEW AI VIDEO JOB"
    )
    print(
        "================================"
    )
    print(
        "Job ID:",
        job_id
    )
    print(
        "Prompt:",
        prompt
    )
    print(
        "Video type:",
        video_type
    )
    print(
        "Duration:",
        duration
    )
    print(
        "Voice:",
        voice_language
    )
    print(
        "Clip length:",
        clip_length
    )
    print(
        "================================"
    )
    print("")


    # Start background job
    thread = threading.Thread(
        target=process_job,
        args=(job_id,)
    )

    thread.daemon = True

    thread.start()


    # Return job
    return jsonify({

        "success":
            True,

        "job":
            job

    })


# ========================================
# PROCESS JOB
# ========================================

def process_job(job_id):

    job = jobs.get(
        job_id
    )


    if not job:

        return


    # ------------------------------------
    # STAGE 1
    # ------------------------------------

    update_job(

        job_id,

        "processing",

        10,

        "Preparing AI video generation..."

    )

    time.sleep(5)


    # ------------------------------------
    # STAGE 2
    # ------------------------------------

    update_job(

        job_id,

        "generating_video",

        30,

        "Preparing video generation..."

    )

    time.sleep(5)


    # ------------------------------------
    # STAGE 3
    # ------------------------------------

    update_job(

        job_id,

        "generating_video",

        50,

        "AI video generation stage ready."

    )

    time.sleep(5)


    # ------------------------------------
    # STAGE 4
    # ------------------------------------

    update_job(

        job_id,

        "generating_voice",

        70,

        "Preparing voice-over generation..."

    )

    time.sleep(5)


    # ------------------------------------
    # STAGE 5
    # ------------------------------------

    update_job(

        job_id,

        "combining",

        90,

        "Preparing final video..."

    )

    time.sleep(5)


    # ------------------------------------
    # TEMPORARY COMPLETION
    # ------------------------------------

    update_job(

        job_id,

        "completed",

        100,

        "Test job completed. Real AI generation will be connected next."

    )


# ========================================
# UPDATE JOB
# ========================================

def update_job(
    job_id,
    status,
    progress,
    message
):

    job = jobs.get(
        job_id
    )


    if not job:

        return


    job["status"] = status

    job["progress"] = progress

    job["message"] = message

    job["updatedAt"] = (
        time.strftime(
            "%Y-%m-%dT%H:%M:%SZ",
            time.gmtime()
        )
    )


    print(
        "Job update:",
        job_id,
        status,
        progress,
        "%"
    )


# ========================================
# GET ALL JOBS
# ========================================

@app.route(
    "/jobs",
    methods=["GET"]
)
def get_jobs():

    return jsonify({

        "success":
            True,

        "count":
            len(jobs),

        "jobs":
            list(
                jobs.values()
            )

    })


# ========================================
# GET ONE JOB
# ========================================

@app.route(
    "/jobs/<job_id>",
    methods=["GET"]
)
def get_job(job_id):

    job = jobs.get(
        job_id
    )


    if not job:

        return jsonify({

            "success":
                False,

            "message":
                "Job not found."

        }), 404


    return jsonify({

        "success":
            True,

        "job":
            job

    })


# ========================================
# START WORKER
# ========================================

if __name__ == "__main__":

    print("")
    print(
        "================================"
    )
    print(
        "AI VIDEO WORKER"
    )
    print(
        "================================"
    )
    print(
        "Worker starting..."
    )
    print(
        "Port:",
        PORT
    )
    print(
        "================================"
    )
    print("")


    app.run(

        host="0.0.0.0",

        port=PORT,

        debug=False

    )