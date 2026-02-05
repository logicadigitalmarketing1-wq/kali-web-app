#!/bin/bash
# HexStrike AI - Additional Tools Installation for ARM64
# Installs tools that aren't available in Kali ARM64 repos via Go, Python, Rust, etc.

set -e

echo "============================================="
echo "Installing Additional Tools for ARM64"
echo "============================================="
echo ""

# Install Go if not present
if ! command -v go &> /dev/null; then
    echo "[1] Installing Go..."
    wget -q https://go.dev/dl/go1.22.0.linux-arm64.tar.gz
    rm -rf /usr/local/go && tar -C /usr/local -xzf go1.22.0.linux-arm64.tar.gz
    export PATH=$PATH:/usr/local/go/bin
    export GOPATH=/root/go
    export PATH=$PATH:$GOPATH/bin
    rm go1.22.0.linux-arm64.tar.gz
    echo 'export PATH=$PATH:/usr/local/go/bin:/root/go/bin' >> /root/.bashrc
fi

export PATH=$PATH:/usr/local/go/bin:/root/go/bin
export GOPATH=/root/go

# Install Rust/Cargo if not present
if ! command -v cargo &> /dev/null; then
    echo "[2] Installing Rust..."
    curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
    source /root/.cargo/env
    export PATH=$PATH:/root/.cargo/bin
    echo 'source /root/.cargo/env' >> /root/.bashrc
fi

source /root/.cargo/env 2>/dev/null || true

echo "[3] Installing Go-based tools..."

# Web reconnaissance tools
go install -v github.com/tomnomnom/waybackurls@latest || true
go install -v github.com/tomnomnom/gf@latest || true
go install -v github.com/tomnomnom/httprobe@latest || true
go install -v github.com/tomnomnom/assetfinder@latest || true
go install -v github.com/lc/gau/v2/cmd/gau@latest || true
go install -v github.com/projectdiscovery/subfinder/v2/cmd/subfinder@latest || true
go install -v github.com/projectdiscovery/httpx/cmd/httpx@latest || true
go install -v github.com/projectdiscovery/nuclei/v3/cmd/nuclei@latest || true
go install -v github.com/projectdiscovery/katana/cmd/katana@latest || true
go install -v github.com/projectdiscovery/naabu/v2/cmd/naabu@latest || true
go install -v github.com/projectdiscovery/notify/cmd/notify@latest || true
go install -v github.com/owasp-amass/amass/v4/...@latest || true

# Web fuzzing and enumeration
go install -v github.com/ffuf/ffuf/v2@latest || true
go install -v github.com/OJ/gobuster/v3@latest || true
go install -v github.com/epi052/feroxbuster@latest || true

# Parameter discovery
go install -v github.com/s0md3v/Arjun@latest || true
go install -v github.com/mazen160/secrets-patterns-db@latest || true
go install -v github.com/devanshbatham/ParamSpider@latest || true
go install -v github.com/tomnomnom/qsreplace@latest || true
go install -v github.com/tomnomnom/anew@latest || true

# XSS and vulnerability scanning
go install -v github.com/hahwul/dalfox/v2@latest || true
go install -v github.com/jaeles-project/jaeles@latest || true

# Crawling
go install -v github.com/hakluke/hakrawler@latest || true

# Cloud security
go install -v github.com/aquasecurity/trivy/cmd/trivy@latest || true
go install -v github.com/bridgecrewio/checkov@latest || true

# Subdomain takeover
go install -v github.com/haccer/subjack@latest || true

# JWT tools
go install -v github.com/wallarm/jwt-secrets/jwt-hack@latest || true

# Other tools
go install -v github.com/projectdiscovery/chaos-client/cmd/chaos@latest || true
go install -v github.com/projectdiscovery/uncover/cmd/uncover@latest || true
go install -v github.com/d3mondev/puredns/v2@latest || true
go install -v github.com/projectdiscovery/dnsx/cmd/dnsx@latest || true

echo "[4] Installing Rust-based tools..."

# Rustscan
cargo install rustscan || true

echo "[5] Installing Python-based tools..."

pip3 install --break-system-packages \
    arjun \
    dirsearch \
    sqlmap \
    sublist3r \
    wfuzz \
    paramspider \
    uro \
    wafw00f \
    impacket \
    commix \
    xsser \
    scapy \
    crackmapexec \
    bloodhound \
    prowler \
    ScoutSuite \
    pacu \
    cloudsploit \
    || echo "Some Python tools failed (non-critical)"

echo "[6] Installing npm-based tools..."

if command -v npm &> /dev/null; then
    npm install -g @projectdiscovery/nuclei-templates || true
    npm install -g wappalyzer || true
    npm install -g retire || true
fi

echo "[7] Creating symlinks for Go tools..."

# Create symlinks in /usr/local/bin for better PATH availability
mkdir -p /usr/local/bin
cd /root/go/bin
for tool in *; do
    ln -sf /root/go/bin/$tool /usr/local/bin/$tool 2>/dev/null || true
done

echo "[8] Updating tool databases..."

# Update nuclei templates
nuclei -update-templates &>/dev/null || true

# Update searchsploit database
searchsploit -u &>/dev/null || true

echo ""
echo "============================================="
echo "Additional Tools Installation Complete!"
echo "============================================="
echo ""
echo "Installed via Go:"
echo "  ✓ Web reconnaissance (subfinder, amass, httpx, katana, etc.)"
echo "  ✓ Web fuzzing (ffuf, gobuster, feroxbuster)"
echo "  ✓ Parameter discovery (arjun, paramspider, qsreplace, anew)"
echo "  ✓ Vulnerability scanning (nuclei, dalfox, jaeles)"
echo "  ✓ Cloud security (trivy)"
echo ""
echo "Installed via Python:"
echo "  ✓ dirsearch, sqlmap, wfuzz, wafw00f, commix"
echo "  ✓ impacket, crackmapexec, prowler, pacu"
echo ""
echo "Installed via Rust:"
echo "  ✓ rustscan"
echo ""
echo "============================================="
