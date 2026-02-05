# HexStrike AI MCP - Production Dockerfile
# ==========================================
# Multi-stage build for Kali Linux security platform

FROM kalilinux/kali-rolling AS base

# Set environment
ENV TERM=xterm-256color
ENV PATH="/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin:/usr/local/go/bin:/root/go/bin:/root/.cargo/bin"
ENV DEBIAN_FRONTEND=noninteractive

# Update and install base dependencies
RUN apt-get update && apt-get install -y \
    python3 \
    python3-pip \
    python3-venv \
    python3-dev \
    python3-netifaces \
    build-essential \
    gcc \
    g++ \
    libffi-dev \
    libssl-dev \
    chromium \
    chromium-driver \
    curl \
    wget \
    git \
    && rm -rf /var/lib/apt/lists/*

# ==========================================
# Stage: Install Security Tools
# ==========================================
FROM base AS tools

WORKDIR /opt/hexstrike-ai

# Copy tool installation scripts
COPY install-tools.sh .
COPY install-*.sh .
COPY fix-tools.sh .

# Install all security tools (this takes a while but is cached)
RUN chmod +x *.sh && \
    bash install-tools.sh || true && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

# ==========================================
# Stage: Install Python Dependencies
# ==========================================
FROM tools AS python-deps

WORKDIR /opt/hexstrike-ai

# Create virtual environment
RUN python3 -m venv /opt/hexstrike-env

# Copy requirements and install
COPY requirements.txt .
RUN . /opt/hexstrike-env/bin/activate && \
    pip install --upgrade pip wheel setuptools && \
    pip install -r requirements.txt

# ==========================================
# Stage: Final Production Image
# ==========================================
FROM tools AS production

WORKDIR /opt/hexstrike-ai

# Copy virtual environment from python-deps
COPY --from=python-deps /opt/hexstrike-env /opt/hexstrike-env

# Copy application code
COPY hexstrike_server.py .
COPY hexstrike_mcp.py .
COPY hexstrike-ai-mcp.json .
COPY *.py ./

# Create data directory
RUN mkdir -p /data

# Set up the entrypoint
ENV VIRTUAL_ENV=/opt/hexstrike-env
ENV PATH="$VIRTUAL_ENV/bin:$PATH"

# Expose MCP port
EXPOSE 8888

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD curl -f http://localhost:8888/health || exit 1

# Start the server
CMD ["python3", "/opt/hexstrike-ai/hexstrike_server.py"]
