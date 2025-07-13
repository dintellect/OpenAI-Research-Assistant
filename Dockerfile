# Use an official Python runtime as a parent image
FROM python:3.12-slim

# Set the working directory
WORKDIR /app

# Install system dependencies (for numpy, faiss, etc.)
RUN apt-get update && apt-get install -y \
    build-essential \
    swig \
    cmake \
    pkg-config \
    libblas-dev \
    liblapack-dev \
    && rm -rf /var/lib/apt/lists/*

# Upgrade pip and install setuptools/wheel first
RUN pip install --upgrade pip setuptools wheel

# Copy requirements from api directory and install
COPY api/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy the api directory contents
COPY api/ .

# Expose the port FastAPI runs on
EXPOSE 8000

# Run the app
CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "8000"] 