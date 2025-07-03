# Job System Troubleshooting Guide

This document outlines the improvements made to handle large spectrogram tasks and prevent worker deaths, timeouts, and memory issues.

## Issues Addressed

### 1. Memory and Time Limits
- **Problem**: Celery workers were timing out after 5-6 minutes, insufficient for large spectrograms
- **Solution**:
  - Increased soft time limit to 10 minutes (configurable via `CELERY_TASK_SOFT_TIME_LIMIT`)
  - Added 5-minute grace period for hard time limit
  - Implemented memory monitoring and estimation

### 2. Worker Death Handling
- **Problem**: When workers died, jobs remained in "running" state indefinitely
- **Solution**:
  - Added signal handlers for graceful shutdown
  - Implemented periodic cleanup task (`cleanup_stale_jobs`)
  - **Zombie job detection** - automatically detects jobs that appear running but aren't on workers
  - Enhanced error handling with automatic retries

### 3. Frontend Polling Issues
- **Problem**: Frontend continued polling indefinitely for dead jobs
- **Solution**:
  - Added maximum poll attempts (120 attempts = 10 minutes)
  - Implemented stale job detection (1 hour timeout)
  - Better error messages and status handling

### 4. Memory Management
- **Problem**: Large datasets caused memory exhaustion
- **Solution**:
  - Memory usage monitoring at each stage
  - Memory requirement estimation before processing
  - **Memory warnings instead of job rejection** - jobs proceed with warnings
  - **Real-time memory safeguarding** - monitors memory during execution
  - Chunked processing for large datasets (>500MB)
  - Worker memory limits (1GB per child process)

## Configuration

### Environment Variables

```bash
# Celery timeouts (in seconds)
CELERY_TASK_SOFT_TIME_LIMIT=600   # 10 minutes
CELERY_TASK_TIME_LIMIT=900        # 15 minutes

# Memory limits (in bytes)
CELERY_WORKER_MAX_MEMORY_PER_CHILD=1073741824  # 1GB

# Job monitoring
JOB_MAX_POLL_ATTEMPTS=120         # 10 minutes at 5s intervals
JOB_POLL_INTERVAL=5               # 5 seconds
JOB_STALE_TIMEOUT=3600            # 1 hour

# Memory safeguarding
MEMORY_SAFEGUARD_THRESHOLD=95.0   # 95% memory usage threshold
```

### Celery Configuration

The system now uses separate queues for different job types:
- `default`: Regular jobs
- `large_jobs`: Large spectrogram jobs

Workers are configured with:
- Concurrency: 2 processes
- Memory limit: 1GB per child process
- Automatic retries with exponential backoff

## Memory Safeguarding System

### How It Works

The system now includes **real-time memory monitoring** during task execution:

1. **Background Monitoring**: A daemon thread monitors memory usage every 5 seconds
2. **Threshold Detection**: When memory usage exceeds 95% (configurable), the system takes action
3. **Graceful Termination**: Updates job status and forces process termination to prevent system crash
4. **Automatic Retries**: Memory-related errors trigger automatic retries (up to 2 attempts)

### Memory Thresholds

- **Warning Level** (>85%): Logs warnings but continues processing
- **Critical Level** (>95%): Forces task termination and worker restart
- **Configurable**: Threshold can be adjusted via `MEMORY_SAFEGUARD_THRESHOLD`

### What Happens When Memory Threshold is Exceeded

1. **Immediate Action**:
   - Logs critical memory usage error
   - Updates job status to "failed" with memory error details
   - Forces process termination using `os._exit(1)`

2. **Worker Behavior**:
   - Worker process is killed
   - Celery automatically restarts the worker
   - Task is lost (not automatically retried)

3. **User Experience**:
   - Job status shows "failed" with memory error message
   - Frontend displays appropriate error message
   - User can retry with different parameters

### Memory Monitoring Features

- **Real-time monitoring**: Checks memory every 5 seconds during task execution
- **Thread-safe**: Uses daemon threads that don't block task completion
- **Graceful cleanup**: Properly stops monitoring on task completion or failure
- **Detailed logging**: Records memory usage at key processing stages

## Memory Warning System

### How It Works

Instead of rejecting jobs that might use high memory, the system now:

1. **Estimates memory requirements** before processing
2. **Logs warnings** for high memory usage (>80% of available)
3. **Updates job status** with memory warning information
4. **Allows jobs to proceed** with appropriate warnings
5. **Shows warnings in the frontend** to inform users

### Memory Thresholds

- **Low usage** (<60% of available): Info log
- **Moderate usage** (60-80% of available): Info log
- **High usage** (>80% of available): Warning log + frontend alert

### Frontend Integration

Memory warnings appear as:
- Warning alerts in the job status display
- Informative messages about potential performance impact
- Suggestions for reducing memory usage

## Monitoring and Debugging

### Memory Monitoring

The system now logs memory usage at key stages:
```python
log_memory_usage("job_start", job_id)
log_memory_usage("after_sds_download", job_id)
log_memory_usage("before_spectrogram", job_id)
log_memory_usage("after_spectrogram", job_id)
log_memory_usage("job_complete", job_id)
```

### Memory Estimation

Before processing, the system estimates memory requirements:
```python
memory_estimate = estimate_memory_requirements(file_paths, config)
# Returns: file_size_mb, estimated_processing_mb, total_estimated_mb
```

### Chunked Processing

For datasets larger than 500MB, the system automatically uses chunked processing:
- Splits data into manageable chunks
- Processes each chunk separately
- Combines results for final spectrogram

## Management Commands

### Cleanup Stale Jobs

```bash
# Dry run to see what would be cleaned up
python manage.py cleanup_stale_jobs --dry-run

# Clean up jobs older than 1 hour (default)
python manage.py cleanup_stale_jobs

# Clean up jobs older than 2 hours
python manage.py cleanup_stale_jobs --timeout-hours=2
```

## Frontend Improvements

### Enhanced Polling

The frontend now includes:
- Maximum poll attempts (prevents infinite polling)
- Stale job detection
- Better error messages and status handling
- Poll attempt counting
- Memory warning display

### Configuration

```typescript
const POLL_INTERVAL = 5000; // 5 seconds
const MAX_POLL_ATTEMPTS = 120; // 10 minutes
const STALE_JOB_TIMEOUT = 60 * 60 * 1000; // 1 hour
```

## Zombie Job Detection System

### How It Works

The system now includes **automatic zombie job detection** to identify jobs that appear to be running but have actually lost their worker connection:

1. **Real-time Detection**: Every time `get_job_metadata` is called, the system checks if the job is actually running on a worker
2. **Worker Inspection**: Uses Celery's inspection API to check active tasks on all workers
3. **Automatic Cleanup**: If a zombie is detected, the job is immediately marked as failed
4. **Periodic Monitoring**: Background task runs every 2 minutes to check for zombies

### Detection Logic

A job is considered a "zombie" if:
- Status is "running" or "submitted"
- Not found in any worker's active task list
- The job task name matches `jobs.tasks.submit_job`
- The job ID matches the task arguments

### What Happens When a Zombie is Detected

1. **Immediate Action**:
   - Job status is updated to "failed"
   - A status update is created with zombie detection reason
   - Logs the detection for monitoring

2. **User Experience**:
   - Job status shows "failed" with zombie detection message
   - Frontend displays appropriate error message
   - User can retry the job

### Management Commands

```bash
# Check for zombie jobs (dry run)
python manage.py cleanup_zombie_jobs --dry-run

# Clean up zombie jobs
python manage.py cleanup_zombie_jobs

# Check for zombie jobs older than 10 minutes
python manage.py cleanup_zombie_jobs --min-age-minutes=10
```

### Configuration

The zombie detection runs:
- **On every metadata request**: Real-time detection when frontend polls
- **Every 2 minutes**: Periodic background cleanup task
- **Manually**: Via management command

### Monitoring

Look for these log patterns:

```bash
# Zombie detection
"Job X: Detected as zombie - status 'running' but not running on any worker"
"Job X: Marked as failed due to zombie detection"
"Checking X jobs for zombie detection"
"Marked zombie job X as failed"
"Cleaned up X zombie jobs"

# Memory warnings (not errors)
"Job X: High memory usage expected - Estimated: 800.0MB, Available: 1000.0MB, Usage: 80.0%. Job will proceed but may cause memory pressure."

# Memory monitoring
"Job X memory usage at stage: RSS: 800.0MB, VMS: 1200.0MB, Percent: 85.0%"

# Memory safeguard triggered
"Job X: CRITICAL MEMORY USAGE - 96.5% exceeds threshold 95.0%"
"Job X: Forcing process termination due to memory usage"

# Memory monitor lifecycle
"Memory monitor started for job X"
"Memory monitor stopped"

# Timeout issues
"Job X: Job exceeded soft time limit during spectrogram generation"

# Memory estimation
"Job X: Memory estimate - Files: 100.0MB, Processing: 300.0MB, Total: 800.0MB"

# Chunked processing
"Using chunked processing for dataset of 750.0MB"
"Processing 1000000 samples in chunks of 100000"

# Worker inspection errors
"Error checking if job X is running on worker: ..."
```

## Troubleshooting

### Common Issues

1. **Job stuck in "running" state**
   - Check if worker is alive: `celery -A config.celery_app inspect active`
   - Run cleanup: `python manage.py cleanup_stale_jobs`
   - Check for zombie jobs: `python manage.py cleanup_zombie_jobs --dry-run`
   - Check logs for memory/timeout issues

2. **Zombie jobs detected**
   - Jobs that appear running but aren't on workers
   - Run zombie cleanup: `python manage.py cleanup_zombie_jobs`
   - Check worker health: `celery -A config.celery_app inspect ping`
   - Review worker logs for crashes or restarts
   - Monitor zombie detection frequency

3. **Memory warnings**
   - These are informational - jobs will still proceed
   - Consider reducing dataset size or processing parameters
   - Monitor system memory usage during processing

4. **Memory safeguard triggered**
   - Job was terminated due to high memory usage (>95%)
   - Check logs for memory usage patterns
   - Consider using chunked processing or smaller datasets
   - Adjust `MEMORY_SAFEGUARD_THRESHOLD` if needed

5. **Timeout errors**
   - Increase `CELERY_TASK_SOFT_TIME_LIMIT`
   - Use chunked processing for large datasets
   - Check if data size is reasonable

6. **Worker deaths**
   - Check system memory usage
   - Review worker logs for OOM errors
   - Adjust `CELERY_WORKER_MAX_MEMORY_PER_CHILD`

### Log Analysis

Look for these log patterns:

```bash
# Zombie detection
"Job X: Detected as zombie - status 'running' but not running on any worker"
"Job X: Marked as failed due to zombie detection"
"Checking X jobs for zombie detection"
"Marked zombie job X as failed"
"Cleaned up X zombie jobs"

# Memory warnings (not errors)
"Job X: High memory usage expected - Estimated: 800.0MB, Available: 1000.0MB, Usage: 80.0%. Job will proceed but may cause memory pressure."

# Memory monitoring
"Job X memory usage at stage: RSS: 800.0MB, VMS: 1200.0MB, Percent: 85.0%"

# Memory safeguard triggered
"Job X: CRITICAL MEMORY USAGE - 96.5% exceeds threshold 95.0%"
"Job X: Forcing process termination due to memory usage"

# Memory monitor lifecycle
"Memory monitor started for job X"
"Memory monitor stopped"

# Timeout issues
"Job X: Job exceeded soft time limit during spectrogram generation"

# Memory estimation
"Job X: Memory estimate - Files: 100.0MB, Processing: 300.0MB, Total: 800.0MB"

# Chunked processing
"Using chunked processing for dataset of 750.0MB"
"Processing 1000000 samples in chunks of 100000"

# Worker inspection errors
"Error checking if job X is running on worker: ..."
```

### Performance Tuning

1. **For large datasets (>1GB)**:
   - Enable chunked processing
   - Increase worker memory limits
   - Use dedicated large_jobs queue
   - Monitor memory warnings
   - Consider lowering memory safeguard threshold

2. **For high concurrency**:
   - Increase worker concurrency
   - Use multiple worker instances
   - Monitor memory usage per worker

3. **For faster processing**:
   - Reduce FFT size
   - Increase hop size
   - Use smaller chunk sizes

4. **For memory-constrained systems**:
   - Lower `MEMORY_SAFEGUARD_THRESHOLD` to 90% or 85%
   - Reduce `CELERY_WORKER_MAX_MEMORY_PER_CHILD`
   - Force chunked processing for all large datasets

## Monitoring Setup

### Celery Flower

Monitor workers and tasks:
```bash
celery -A config.celery_app flower
```

### Log Monitoring

Set up log aggregation to monitor:
- Memory usage patterns
- Job completion rates
- Error frequencies
- Worker health
- Memory warning frequency
- Memory safeguard triggers

### Metrics to Track

- Job success/failure rates
- Average processing time by dataset size
- Memory usage patterns
- Worker restart frequency
- Queue depths
- Memory warning frequency
- Memory safeguard trigger frequency

## Best Practices

1. **Monitor memory warnings** - they indicate potential performance issues
2. **Use chunked processing** for datasets >500MB
3. **Monitor worker health** regularly
4. **Set appropriate timeouts** based on dataset size
5. **Clean up stale jobs** periodically
6. **Use separate queues** for different job types
7. **Monitor system resources** during peak usage
8. **Consider memory warnings** when planning large jobs
9. **Adjust memory safeguard threshold** based on system capacity
10. **Monitor memory safeguard triggers** to identify problematic jobs

## Future Improvements

1. **Dynamic resource allocation** based on job requirements
2. **Job queuing with priority** based on user/importance
3. **Distributed processing** across multiple workers
4. **Real-time progress updates** during processing
5. **Automatic scaling** based on queue depth
6. **Better error recovery** with partial results
7. **Memory usage prediction** based on historical data
8. **Adaptive memory thresholds** based on system load
