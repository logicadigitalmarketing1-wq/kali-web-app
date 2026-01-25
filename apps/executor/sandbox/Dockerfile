# SecureScope Tool Sandbox
# This container is used to execute security tools in an isolated environment

FROM kalilinux/kali-rolling:latest

LABEL maintainer="SecureScope Team"
LABEL description="Isolated sandbox for security tool execution"

# Avoid prompts during installation
ENV DEBIAN_FRONTEND=noninteractive

# Update and install essential security tools
RUN apt-get update && apt-get install -y --no-install-recommends \
    # Network tools
    nmap \
    traceroute \
    netcat-openbsd \
    tcpdump \
    dnsutils \
    whois \
    curl \
    wget \
    # TLS/SSL tools
    openssl \
    sslyze \
    testssl.sh \
    # Web tools
    nikto \
    whatweb \
    # Subdomain enumeration
    subfinder \
    # Other utilities
    jq \
    python3 \
    python3-pip \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/* \
    && apt-get clean

# Create non-root user for execution
RUN useradd -m -s /bin/bash executor \
    && mkdir -p /work /output \
    && chown executor:executor /work /output

# Security hardening
# Remove unnecessary setuid/setgid binaries
RUN find / -perm /6000 -type f -exec chmod a-s {} \; 2>/dev/null || true

# Remove shells and compilers that could be abused
RUN rm -f /bin/sh /usr/bin/gcc /usr/bin/g++ 2>/dev/null || true

# Set working directory
WORKDIR /work

# Default to non-root user
USER executor

# No default command - will be provided at runtime
CMD ["echo", "No command specified"]
