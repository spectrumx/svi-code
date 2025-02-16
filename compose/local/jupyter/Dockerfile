FROM quay.io/jupyter/scipy-notebook:2024-12-23

RUN pip install \
    numpy \
    pandas \
    matplotlib \
    scikit-learn

# Add Jupyter config
COPY compose/local/jupyter/jupyter_notebook_config.py /home/jovyan/.jupyter/jupyter_notebook_config.py

