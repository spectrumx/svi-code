FROM quay.io/jupyter/scipy-notebook:2024-12-23

# Install Python packages
RUN pip install \
    numpy \
    pandas \
    matplotlib \
    scikit-learn \
    jupyterlab \
    jupyterlab-server \
    notebook \
    ipywidgets

# Install Node.js packages for JupyterLab
USER root
RUN apt-get update && apt-get install -y nodejs npm && \
    npm install -g \
    @jupyterlab/services \
    @jupyterlab/notebook \
    @jupyterlab/ui-components

USER jovyan

# Add Jupyter config
COPY compose/local/jupyter/jupyter_notebook_config.py /home/jovyan/.jupyter/jupyter_notebook_config.py

# Make sure the config directory exists
RUN mkdir -p /home/jovyan/.jupyter

# Set the working directory
WORKDIR /home/jovyan/work

# Command to run Jupyter
CMD ["jupyter", "notebook", "--allow-root"]

