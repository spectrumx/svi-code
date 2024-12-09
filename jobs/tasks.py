from pathlib import Path

from celery import shared_task

from .io import get_job_file
from .io import get_job_meta
from .io import post_results
from .io import update_job_status
from .visualizations.spectrogram import make_spectrogram


@shared_task
def submit_job(job_id: int, token: str):
    print(f"Submitting job {job_id}")

    # the very first thing we should do is update the Job status to "running"
    update_job_status(job_id, "running", token)

    # the next thing we do is get the job information. This will tell us:
    # 1. What type of visualization we should do
    # 2. A list of files we'll need
    job_data = get_job_meta(job_id, token)
    if job_data is None:
        update_job_status(
            job_id,
            "failed",
            token,
            info="Could not get job information.",
        )

    # Next, run through the local files and download them from the SVI main system.
    for f in job_data["data"]["local_files"]:
        print(f"Getting file (tasks.py): {f}")
        data = get_job_file(f["id"], token, "local")
        if data is None:
            print(f"File {f['id']} not found.")
            update_job_status(
                job_id,
                "failed",
                token,
                info="Could not fetch local file.",
            )
        # .. store data in some way to access it later in the code,
        # .. either in memory or locally to disk
        print(f"File {f['id']} downloaded successfully.")

    # DO CODE TO MAKE VIZ HERE
    figure = make_spectrogram(
        job_data["data"]["local_files"][0]["path"],
        job_data["data"]["local_files"][1]["path"],
        1024,
    )
    figure.savefig("spectrogram.png")

    # Let's say the code dumped to a local file and we want to upload that.
    # We can do either that, or have an in-memory file. Either way, "f" will be
    # our file contents (byte format)
    with Path.open("spectrogram.png").read() as results_file:
        # post results -- we can make this call as many times as needed to get
        # results to send to the main system.
        # We can also mix JSON data and a file. It will save 2 records of
        # "JobData", one for the JSON and one for the file.
        # Remember that "json_data" should be a dictionary, and if we use a
        # file upload, to provide it a name.
        success = post_results(
            job_id,
            token,
            file_data=results_file,
            file_name="spectrogram.png",
        )

    if not success:
        update_job_status(job_id, "failed", token, info="Could not post results.")

    # update the job as complete
    update_job_status(job_id, "completed", token)
