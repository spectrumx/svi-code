from celery import shared_task
from .io import (
    update_job_status,
    get_job_meta,
    get_job_file,
    post_results
)


@shared_task
def submit_job(job_id: int, token: str):
    print(f"Submitting job {job_id}")
    update_job_status(job_id, 'running', token)

    print(f"Getting job information")
    job_data = get_job_meta(job_id, token)
    if job_data is None:
        update_job_status(job_id, 'failed', token, info='Could not get job information.')
    print(job_data)

    print("Fetching file data...")
    for f in job_data['data']['local_files']:
        data = get_job_file(f['id'], token, 'local')
        if data is None:
            update_job_status(job_id, 'failed', token, info='Could not fetch local file.')
        #.. store data in some way to access it later in the code,
        #.. either in memory or locally to disk

    # DO CODE TO MAKE VIZ HERE

    print(f"Submitting results")
    # submit JSON data
    f = open('spectrumx_visualization_platform/media/data.csv', 'r').read()
    success = post_results(job_id, token, json_data={'header': '1,2,3', 'data': 'a,b,c'}, file_data=f, file_name='results.csv')
    if not success:
        update_job_status(job_id, 'failed', token, info='Could not post results.')
    # update the job as complete
    update_job_status(job_id, 'completed', token)



