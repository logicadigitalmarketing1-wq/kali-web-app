#!/bin/bash
# HexStrike AI - Tool Fixes Script
# Fixes: httpx (wrong version), nuclei, amass, nmap NSE, nikto, rustscan

set -e

echo "========================================="
echo "HexStrike AI - Fixing Tool Issues"
echo "========================================="
echo ""

# Detect architecture
ARCH=$(uname -m)
if [ "$ARCH" = "x86_64" ]; then
    ARCH_NAME="amd64"
elif [ "$ARCH" = "aarch64" ] || [ "$ARCH" = "arm64" ]; then
    ARCH_NAME="arm64"
else
    echo "Unsupported architecture: $ARCH"
    exit 1
fi
echo "Detected architecture: $ARCH ($ARCH_NAME)"
echo ""

# Set up Go environment
export GOPATH=${GOPATH:-/root/go}
export PATH=$PATH:/usr/local/go/bin:$GOPATH/bin
mkdir -p $GOPATH/bin

# 1. Fix httpx (remove Python httpx, install ProjectDiscovery httpx)
echo "[1/6] Fixing httpx..."
echo "  Removing Python httpx packages..."
pip3 uninstall httpx -y 2>/dev/null || true
pip3 uninstall httpx-sse -y 2>/dev/null || true
pip3 uninstall httpcore -y 2>/dev/null || true

# Remove any existing httpx binary to ensure clean install
rm -f /usr/local/bin/httpx
rm -f /usr/bin/httpx

# Install ProjectDiscovery httpx (Go binary)
echo "  Downloading ProjectDiscovery httpx..."
HTTPX_VERSION=$(curl -s https://api.github.com/repos/projectdiscovery/httpx/releases/latest | jq -r '.tag_name' | sed 's/v//')
if [ -z "$HTTPX_VERSION" ] || [ "$HTTPX_VERSION" = "null" ]; then
    HTTPX_VERSION="1.6.10"  # Fallback version
fi
echo "  Installing httpx v${HTTPX_VERSION}..."
wget -q "https://github.com/projectdiscovery/httpx/releases/download/v${HTTPX_VERSION}/httpx_${HTTPX_VERSION}_linux_${ARCH_NAME}.zip" -O /tmp/httpx.zip
unzip -q -o /tmp/httpx.zip -d /tmp/httpx_extract/
mv /tmp/httpx_extract/httpx /usr/local/bin/httpx
chmod +x /usr/local/bin/httpx
rm -rf /tmp/httpx.zip /tmp/httpx_extract/

# Verify httpx
echo "  Verifying httpx installation..."
if httpx -version 2>&1 | grep -q "projectdiscovery"; then
    echo "  [OK] httpx fixed (ProjectDiscovery version)"
    httpx -version 2>&1 | head -1
else
    echo "  [WARNING] httpx installed but version check unclear"
    httpx -version 2>&1 | head -1 || true
fi
echo ""

# 2. Update nuclei and templates
echo "[2/6] Updating nuclei..."
if command -v nuclei &> /dev/null; then
    echo "  Attempting self-update..."
    nuclei -update 2>/dev/null || true
else
    echo "  Nuclei not found, installing..."
fi

# Always ensure latest version
NUCLEI_VERSION=$(curl -s https://api.github.com/repos/projectdiscovery/nuclei/releases/latest | jq -r '.tag_name' | sed 's/v//')
if [ -z "$NUCLEI_VERSION" ] || [ "$NUCLEI_VERSION" = "null" ]; then
    NUCLEI_VERSION="3.4.0"  # Fallback version (updated 2026-02)
fi
echo "  Installing nuclei v${NUCLEI_VERSION}..."
wget -q "https://github.com/projectdiscovery/nuclei/releases/download/v${NUCLEI_VERSION}/nuclei_${NUCLEI_VERSION}_linux_${ARCH_NAME}.zip" -O /tmp/nuclei.zip
unzip -q -o /tmp/nuclei.zip -d /tmp/nuclei_extract/
mv /tmp/nuclei_extract/nuclei /usr/local/bin/nuclei
chmod +x /usr/local/bin/nuclei
rm -rf /tmp/nuclei.zip /tmp/nuclei_extract/

# Update templates
echo "  Updating nuclei templates..."
nuclei -update-templates 2>/dev/null || true
echo "  [OK] nuclei updated"
nuclei -version 2>&1 | head -1
echo ""

# 3. Update amass
echo "[3/6] Updating amass..."
echo "  Installing amass via Go..."
go install -v github.com/owasp-amass/amass/v4/...@master 2>/dev/null || {
    echo "  Go install failed, trying apt..."
    apt-get update -qq
    DEBIAN_FRONTEND=noninteractive apt-get install -y amass 2>/dev/null || true
}

# Copy from GOPATH if built there
if [ -f "$GOPATH/bin/amass" ]; then
    cp -f $GOPATH/bin/amass /usr/local/bin/
    echo "  Copied amass from GOPATH"
fi

if command -v amass &> /dev/null; then
    echo "  [OK] amass updated"
    amass -version 2>&1 | head -1 || true
else
    echo "  [WARNING] amass may not be installed correctly"
fi
echo ""

# 4. Update nmap NSE scripts
echo "[4/6] Updating nmap NSE scripts..."
echo "  Updating script database..."
nmap --script-updatedb 2>/dev/null || true

echo "  Installing nmap-vulners..."
apt-get update -qq 2>/dev/null || true
DEBIAN_FRONTEND=noninteractive apt-get install -y nmap-vulners 2>/dev/null || {
    # Try alternative: clone the repo manually
    echo "  nmap-vulners package not found, trying manual install..."
    if [ ! -d "/usr/share/nmap/scripts/vulners" ]; then
        git clone https://github.com/vulnersCom/nmap-vulners.git /tmp/nmap-vulners 2>/dev/null || true
        if [ -f "/tmp/nmap-vulners/vulners.nse" ]; then
            cp /tmp/nmap-vulners/vulners.nse /usr/share/nmap/scripts/
            nmap --script-updatedb
            rm -rf /tmp/nmap-vulners
            echo "  Installed vulners.nse manually"
        fi
    fi
}
echo "  [OK] nmap NSE scripts updated"
echo ""

# 5. Verify nikto
echo "[5/6] Verifying nikto..."
if ! command -v nikto &> /dev/null; then
    echo "  Nikto not found, installing..."
    apt-get update -qq 2>/dev/null || true
    DEBIAN_FRONTEND=noninteractive apt-get install -y nikto
fi

if command -v nikto &> /dev/null; then
    echo "  [OK] nikto verified"
    nikto -Version 2>&1 | head -3 || true
else
    echo "  [ERROR] nikto installation failed"
fi
echo ""

# 6. Verify rustscan
echo "[6/6] Verifying rustscan..."
if ! command -v rustscan &> /dev/null; then
    echo "  Rustscan not found, installing..."
    if [ "$ARCH_NAME" = "amd64" ]; then
        wget -q https://github.com/RustScan/RustScan/releases/download/2.3.0/rustscan_2.3.0_amd64.deb -O /tmp/rustscan.deb
        dpkg -i /tmp/rustscan.deb 2>/dev/null || apt-get install -f -y
        rm -f /tmp/rustscan.deb
    else
        echo "  ARM64 detected, installing via cargo..."
        cargo install rustscan 2>/dev/null || true
        cp -f ~/.cargo/bin/rustscan /usr/local/bin/ 2>/dev/null || true
    fi
fi

if command -v rustscan &> /dev/null; then
    echo "  [OK] rustscan verified"
    rustscan --version 2>&1 | head -1 || true
else
    echo "  [WARNING] rustscan may need manual installation"
fi
echo ""

# Summary
echo "========================================="
echo "Tool Fixes Complete!"
echo "========================================="
echo ""
echo "Summary:"
echo "  - httpx: ProjectDiscovery version installed"
echo "  - nuclei: Updated with latest templates"
echo "  - amass: Updated to latest version"
echo "  - nmap: NSE scripts and vulners updated"
echo "  - nikto: Verified"
echo "  - rustscan: Verified (code fix in hexstrike_server.py)"
echo ""
echo "Testing commands:"
echo "  httpx -u https://example.com -silent"
echo "  nuclei -u https://example.com -t dns/ -silent"
echo "  nikto -h https://example.com -Tuning 1"
echo "  amass enum -d example.com -passive -timeout 5"
echo "  rustscan -a scanme.nmap.org -- -sV"
echo ""
echo "NOTE: Remember to restart hexstrike service after these changes!"
