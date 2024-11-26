# Use an official Python runtime as a parent image
FROM python:3.9

# Set the working directory to /app
WORKDIR /app

# Copy the requirements file into the container
COPY ./requirements .

ARG BUILD_ENVIRONMENT=production
ENV BUILD_ENV=${BUILD_ENVIRONMENT}

# Install dependencies
RUN pip install --no-cache-dir -r base.txt
RUN pip install --no-cache-dir -r local.txt

# Copy the current directory contents into the container at /app
COPY . .

# Define the command to run your Celery worker
CMD ["celery", "-A", "celery_app", "worker", "-l", "info"]
