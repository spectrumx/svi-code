# Job Submission

The following describes how to submit a job to the SpectrumX Visualization Platform.

## Job Submission via Function Call

There is a function call available to submit a job. This function call is available in `jobs.submission.request_job_submission`.

It takes in the following arguments:

- `visualization_type`: The type of visualization to submit. This can be `waterfall`, `heatmap`, `scatterplot`, or any other string that would map to a visualization type within the celery worker.
- `owner`: The user submitting the job. Needs to be a valid user object.
- `local_files`: A list of local files to submit with the job.

**Note:** At the moment, only local files are supported.

### Example:

```python
from jobs.submission import request_job_submission

request_job_submission(
    visualization_type="waterfall",
    owner=user,
    local_files=["data.csv"],
)
```

## Job Execution

When a job is submitted, it is assigned to a celery worker. The worker will then execute the job. The function that is called is `jobs.tasks.submit_job`.

This function takes in two arguments:

- `job_id`: The ID of the job to execute.
- `token`: The token of the user submitting the job.

Inside this function, the following should theoretically happen:

```python
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
    data = get_job_file(f["id"], token, "local")
    if data is None:
        update_job_status(
            job_id,
            "failed",
            token,
            info="Could not fetch local file.",
        )
    # .. store data in some way to access it later in the code,
    # .. either in memory or locally to disk

# DO CODE TO MAKE VIZ HERE

# Let's say the code dumped to a local file and we want to upload that.
# We can do either that, or have an in-memory file. Either way, "f" will be
# our file contents (byte format)
with Path.open("spectrumx_visualization_platform/media/data.csv").read() as f:
    # post results -- we can make this call as many times as needed to get
    # results to send to the main system.
    # We can also mix JSON data and a file. It will save 2 records of
    # "JobData", one for the JSON and one for the file.
    # Remember that "json_data" should be a dictionary, and if we use a
    # file upload, to provide it a name.
    success = post_results(
        job_id,
        token,
        json_data={"header": "1,2,3", "data": "a,b,c"},
        file_data=f,
        file_name="results.csv",
    )

if not success:
    update_job_status(job_id, "failed", token, info="Could not post results.")

# update the job as complete
update_job_status(job_id, "completed", token)
```

This essentially follows the flow of:

1. Update the job status to "running"
2. Get the job information
3. Download the files
4. Execute the visualization code (based on the `visualization_type`)
5. Upload the results
6. Update the job status to "completed"

Once the job status is completed, the user is safe to assume that the job has been completed and the results are available.
