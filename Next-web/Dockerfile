FROM python:3.11-slim

# Set working directory
WORKDIR /app

# Install system dependencies
# ffmpeg is required for edge-tts or audio processing
RUN apt-get update && apt-get install -y \
    ffmpeg \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements
COPY requirements.txt .

# Install python dependencies
# Using Tsinghua mirror to speed up build time
RUN pip install --no-cache-dir -r requirements.txt -i https://pypi.tuna.tsinghua.edu.cn/simple

# Copy application code
COPY . .

# Expose port
EXPOSE 8086

# Environment variables
ENV PYTHONPATH=/app

# Run command
CMD ["python", "app/main.py"]
