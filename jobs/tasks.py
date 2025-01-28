from pathlib import Path

from celery import shared_task

from .io import get_job_file
from .io import get_job_meta
from .io import post_results
from .io import update_job_status
from .visualizations.spectrogram import make_spectrogram


@shared_task
def submit_job(job_id: int, token: str, config: dict = None):
    # the very first thing we should do is update the Job status to "running"
    update_job_status(job_id, "running", token)

    # the next thing we do is get the job information. This will tell us:
    # 1. What type of visualization we should do
    # 2. A list of files we'll need
    
    job_data = get_job_meta(job_id, token)
    if job_data is None:
        error_msg = "Could not get job information."
        update_job_status(
            job_id,
            "failed",
            token,
            info=error_msg,
        )
        raise ValueError(error_msg)
    #print(f"job data in submit job: {job_data["data"]["config"]}")
    # Next, run through the local files and download them from the SVI main system.
    # Create a directory for the job files
    print(f"Job {job_id} is running with config: {config}") # config added 44
    width = config.get("width", 1024) # debug added 44
    height = config.get("height", 768) # debug onfig added 44
    print(f"Job {job_id} dimensions: width={width}, height={height}") # config added 44
    Path("jobs/job_files").mkdir(parents=True, exist_ok=True)
    print("job data: " + str(job_data)) # debug added 44
    for f in job_data["data"]["local_files"]:
        data = get_job_file(f["id"], token, "local")

        if data is None:
            error_msg = "Could not fetch local file."
            update_job_status(
                job_id,
                "failed",
                token,
                info="Could not fetch local file.",
            )
            raise ValueError(error_msg)

        # .. store data in some way to access it later in the code,
        # .. either in memory or locally to disk
        with Path.open(f"jobs/job_files/{f['name']}", "wb") as new_file:
            new_file.write(data)

    # DO CODE TO MAKE VIZ HERE
    Path("jobs/job_results").mkdir(parents=True, exist_ok=True)
    #print(f"config from job data: {job_data['data']['config']['width']}")
   # print(f"job_data['data']: {job_data.get('data', 'data key is missing')}")
    if job_data["data"]["type"] == "spectrogram":
        try:
            figure = make_spectrogram(job_data,width, height, files_dir="jobs/job_files/") # config added 44
            figure.savefig("jobs/job_results/figure.png")
        except Exception as e:
            update_job_status(
                job_id,
                "failed",
                token,
                info=f"Could not make spectrogram: {e}",
            )
            raise
    else:
        error_msg = f"Unknown job type: {job_data['data']['type']}"
        update_job_status(
            job_id,
            "failed",
            token,
            info=error_msg,
        )
        raise ValueError(error_msg)

    # Let's say the code dumped to a local file and we want to upload that.
    # We can do either that, or have an in-memory file. Either way,
    # "results_file" will be our file contents (byte format)
    with Path.open("jobs/job_results/figure.png", "rb") as results_file:
        # post results -- we can make this call as many times as needed to get
        # results to send to the main system.
        # We can also mix JSON data and a file. It will save 2 records of
        # "JobData", one for the JSON and one for the file.
        # Remember that "json_data" should be a dictionary, and if we use a
        # file upload, to provide it a name.
        response = post_results(
            job_id,
            token,
            file_data=results_file.read(),
            file_name="figure.png",
        )

    if not response:
        error_msg = "Could not post results."
        update_job_status(job_id, "failed", token, info=error_msg)
        raise ValueError(error_msg)

    # update the job as complete
    info = {
        "results_id": response["file_ids"]["figure.png"],
    }
    update_job_status(job_id, "completed", token, info=info)
    


@shared_task
def error_handler(request, exc, _traceback):
    update_job_status(request.job_id, "failed", request.token, info=str(exc))
