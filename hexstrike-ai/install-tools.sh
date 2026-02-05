#!/bin/bash
# HexStrike AI - Security Tools Installation Script
# Installs all 150+ security tools for the HexStrike platform

# Don't exit on error - continue installing other tools
set +e

echo "============================================="
echo "HexStrike AI - Tools Installation"
echo "============================================="
echo ""

# Update package list
echo "[1/10] Updating package lists..."
apt-get update -qq

# Install essential dependencies first
echo "[2/10] Installing essential dependencies..."
DEBIAN_FRONTEND=noninteractive apt-get install -y -qq \
    curl \
    wget \
    git \
    jq \
    unzip \
    golang-go \
    ruby \
    ruby-dev \
    build-essential \
    libpcap-dev \
    libssl-dev

# Set up Go environment
export GOPATH=/root/go
export PATH=$PATH:/usr/local/go/bin:$GOPATH/bin
mkdir -p $GOPATH/bin

# Install Kali metapackages (includes most tools)
echo "[3/10] Installing Kali security tools metapackages..."
DEBIAN_FRONTEND=noninteractive apt-get install -y -qq \
    kali-tools-top10 \
    kali-tools-web \
    kali-tools-information-gathering \
    kali-tools-passwords \
    kali-tools-reverse-engineering \
    kali-tools-forensics \
    kali-tools-exploitation \
    2>/dev/null || echo "Some metapackages may not be available"

# Network & Reconnaissance Tools
echo "[4/12] Installing network reconnaissance tools..."
DEBIAN_FRONTEND=noninteractive apt-get install -y \
    nmap \
    masscan \
    amass \
    fierce \
    dnsenum \
    theharvester \
    responder \
    python3-netifaces \
    enum4linux \
    enum4linux-ng \
    smbmap \
    nbtscan \
    arp-scan \
    samba-common-bin \
    tcpdump \
    tshark \
    wireshark-common \
    aircrack-ng \
    autorecon \
    2>/dev/null || true

# Install rustscan if available or from GitHub
if ! command -v rustscan &> /dev/null; then
    echo "Installing RustScan from releases..."
    wget -q https://github.com/RustScan/RustScan/releases/download/2.3.0/rustscan_2.3.0_amd64.deb -O /tmp/rustscan.deb && \
    dpkg -i /tmp/rustscan.deb 2>/dev/null || apt-get install -f -y
    rm -f /tmp/rustscan.deb
fi

# Install netexec (formerly crackmapexec)
pip3 install --break-system-packages netexec 2>/dev/null || true

# Web Application Security Tools
echo "[5/12] Installing web application security tools..."
DEBIAN_FRONTEND=noninteractive apt-get install -y \
    gobuster \
    feroxbuster \
    ffuf \
    dirb \
    dirsearch \
    nikto \
    sqlmap \
    wpscan \
    arjun \
    wafw00f \
    wfuzz \
    commix \
    xsser \
    dotdotpwn \
    zaproxy \
    2>/dev/null || true

# Detect architecture for binary downloads
ARCH=$(dpkg --print-architecture 2>/dev/null || echo "amd64")
echo "Detected architecture: $ARCH"

# Install nuclei from GitHub releases (latest version)
echo "Installing Nuclei..."
if ! command -v nuclei &> /dev/null; then
    NUCLEI_VERSION=$(curl -s https://api.github.com/repos/projectdiscovery/nuclei/releases/latest | jq -r '.tag_name' | sed 's/v//')
    wget -q "https://github.com/projectdiscovery/nuclei/releases/download/v${NUCLEI_VERSION}/nuclei_${NUCLEI_VERSION}_linux_${ARCH}.zip" -O /tmp/nuclei.zip && \
    unzip -q -o /tmp/nuclei.zip -d /usr/local/bin/ && \
    chmod +x /usr/local/bin/nuclei
    rm -f /tmp/nuclei.zip
    # Update nuclei templates
    nuclei -update-templates 2>/dev/null || true
fi

# Install httpx from GitHub releases (ProjectDiscovery version)
echo "Installing httpx (ProjectDiscovery)..."
# Remove Python httpx wrapper if it exists (conflicts with ProjectDiscovery httpx)
rm -f /usr/bin/httpx 2>/dev/null || true
if [ ! -f /usr/local/bin/httpx ]; then
    HTTPX_VERSION=$(curl -s https://api.github.com/repos/projectdiscovery/httpx/releases/latest | jq -r '.tag_name' | sed 's/v//')
    wget -q "https://github.com/projectdiscovery/httpx/releases/download/v${HTTPX_VERSION}/httpx_${HTTPX_VERSION}_linux_${ARCH}.zip" -O /tmp/httpx.zip && \
    unzip -q -o /tmp/httpx.zip -d /usr/local/bin/ && \
    chmod +x /usr/local/bin/httpx
    rm -f /tmp/httpx.zip
fi

# Install subfinder from GitHub releases
echo "Installing subfinder..."
if ! command -v subfinder &> /dev/null; then
    SUBFINDER_VERSION=$(curl -s https://api.github.com/repos/projectdiscovery/subfinder/releases/latest | jq -r '.tag_name' | sed 's/v//')
    wget -q "https://github.com/projectdiscovery/subfinder/releases/download/v${SUBFINDER_VERSION}/subfinder_${SUBFINDER_VERSION}_linux_${ARCH}.zip" -O /tmp/subfinder.zip && \
    unzip -q -o /tmp/subfinder.zip -d /usr/local/bin/ && \
    chmod +x /usr/local/bin/subfinder
    rm -f /tmp/subfinder.zip
fi

# Install katana from GitHub releases
echo "Installing katana..."
if ! command -v katana &> /dev/null; then
    KATANA_VERSION=$(curl -s https://api.github.com/repos/projectdiscovery/katana/releases/latest | jq -r '.tag_name' | sed 's/v//')
    wget -q "https://github.com/projectdiscovery/katana/releases/download/v${KATANA_VERSION}/katana_${KATANA_VERSION}_linux_${ARCH}.zip" -O /tmp/katana.zip && \
    unzip -q -o /tmp/katana.zip -d /usr/local/bin/ && \
    chmod +x /usr/local/bin/katana
    rm -f /tmp/katana.zip
fi

# Install dalfox from GitHub releases
echo "Installing dalfox..."
if ! command -v dalfox &> /dev/null; then
    DALFOX_VERSION=$(curl -s https://api.github.com/repos/hahwul/dalfox/releases/latest | jq -r '.tag_name' | sed 's/v//')
    wget -q "https://github.com/hahwul/dalfox/releases/download/v${DALFOX_VERSION}/dalfox_${DALFOX_VERSION}_linux_${ARCH}.tar.gz" -O /tmp/dalfox.tar.gz && \
    tar -xzf /tmp/dalfox.tar.gz -C /usr/local/bin/ dalfox && \
    chmod +x /usr/local/bin/dalfox
    rm -f /tmp/dalfox.tar.gz
fi

# Install rustscan (fast port scanner)
echo "Installing rustscan..."
if ! command -v rustscan &> /dev/null; then
    # RustScan doesn't have ARM64 pre-built binaries, install via cargo
    if [ "$ARCH" = "arm64" ]; then
        which cargo || (apt-get update -qq && apt-get install -y -qq cargo rustc)
        cargo install rustscan --version 2.3.0 2>/dev/null || true
        ln -sf /root/.cargo/bin/rustscan /usr/local/bin/rustscan 2>/dev/null || true
    else
        wget -q "https://github.com/RustScan/RustScan/releases/download/2.3.0/rustscan_2.3.0_amd64.deb" -O /tmp/rustscan.deb && \
        dpkg -i /tmp/rustscan.deb 2>/dev/null || apt-get install -f -y 2>/dev/null
        rm -f /tmp/rustscan.deb
    fi
fi

# Install Go-based tools
echo "[6/12] Installing Go-based tools..."
go install github.com/lc/gau/v2/cmd/gau@latest 2>/dev/null || true
go install github.com/tomnomnom/waybackurls@latest 2>/dev/null || true
go install github.com/hakluke/hakrawler@latest 2>/dev/null || true
go install github.com/devanshbatham/paramspider@latest 2>/dev/null || true
go install github.com/s0md3v/uro@latest 2>/dev/null || true
go install github.com/sh1yo/x8@latest 2>/dev/null || true
go install github.com/tomnomnom/anew@latest 2>/dev/null || true
go install github.com/tomnomnom/qsreplace@latest 2>/dev/null || true
go install github.com/jaeles-project/jaeles@latest 2>/dev/null || true
go install github.com/KathanP19/Gxss@latest 2>/dev/null || true

# Copy Go binaries to /usr/local/bin
cp -f $GOPATH/bin/* /usr/local/bin/ 2>/dev/null || true

# Authentication & Password Tools
echo "[7/12] Installing authentication and password tools..."
DEBIAN_FRONTEND=noninteractive apt-get install -y \
    hydra \
    john \
    hashcat \
    hashcat-utils \
    medusa \
    patator \
    hashid \
    hash-identifier \
    ophcrack \
    ophcrack-cli \
    2>/dev/null || true

# Install evil-winrm via gem
gem install evil-winrm 2>/dev/null || true

# Install JWT tools
pip3 install --break-system-packages jwt-tool 2>/dev/null || true

# Binary Analysis & Reverse Engineering Tools
echo "[8/12] Installing binary analysis and reverse engineering tools..."
DEBIAN_FRONTEND=noninteractive apt-get install -y \
    gdb \
    gdb-peda \
    binwalk \
    checksec \
    binutils \
    foremost \
    steghide \
    exiftool \
    file \
    xxd \
    patchelf \
    radare2 \
    2>/dev/null || true

# Install pwntools and related Python tools
pip3 install --break-system-packages pwntools ropper angr 2>/dev/null || true

# Install ROPgadget
pip3 install --break-system-packages ROPgadget 2>/dev/null || true

# Install one_gadget (Ruby gem)
gem install one_gadget 2>/dev/null || true

# Install pwninit for CTF
if ! command -v pwninit &> /dev/null; then
    wget -q https://github.com/io12/pwninit/releases/latest/download/pwninit -O /usr/local/bin/pwninit && \
    chmod +x /usr/local/bin/pwninit 2>/dev/null || true
fi

# Install libc-database
if [ ! -d "/opt/libc-database" ]; then
    git clone https://github.com/niklasb/libc-database.git /opt/libc-database 2>/dev/null || true
    ln -sf /opt/libc-database/find /usr/local/bin/libc-database 2>/dev/null || true
fi

# Cloud & Container Security Tools
echo "[9/12] Installing cloud and container security tools..."
DEBIAN_FRONTEND=noninteractive apt-get install -y \
    trivy \
    checkov \
    2>/dev/null || true

# Install prowler, scout-suite via pip3
pip3 install --break-system-packages \
    prowler \
    ScoutSuite \
    kube-hunter \
    terrascan \
    2>/dev/null || true

# Install kube-bench
if ! command -v kube-bench &> /dev/null; then
    KUBEBENCH_VERSION=$(curl -s https://api.github.com/repos/aquasecurity/kube-bench/releases/latest | jq -r '.tag_name' | sed 's/v//')
    wget -q "https://github.com/aquasecurity/kube-bench/releases/download/v${KUBEBENCH_VERSION}/kube-bench_${KUBEBENCH_VERSION}_linux_amd64.tar.gz" -O /tmp/kube-bench.tar.gz && \
    tar -xzf /tmp/kube-bench.tar.gz -C /usr/local/bin/ kube-bench && \
    chmod +x /usr/local/bin/kube-bench
    rm -f /tmp/kube-bench.tar.gz
fi 2>/dev/null || true

# Install docker-bench-security
if [ ! -d "/opt/docker-bench-security" ]; then
    git clone https://github.com/docker/docker-bench-security.git /opt/docker-bench-security 2>/dev/null || true
    ln -sf /opt/docker-bench-security/docker-bench-security.sh /usr/local/bin/docker-bench-security 2>/dev/null || true
fi

# CTF & Forensics Tools
echo "[10/12] Installing CTF and forensics tools..."
DEBIAN_FRONTEND=noninteractive apt-get install -y \
    testdisk \
    scalpel \
    zsteg \
    outguess \
    bulk-extractor \
    sleuthkit \
    hashpump \
    2>/dev/null || true

# Install volatility3
pip3 install --break-system-packages volatility3 2>/dev/null || true

# OSINT & Intelligence Tools
echo "[11/12] Installing OSINT and intelligence tools..."
DEBIAN_FRONTEND=noninteractive apt-get install -y \
    sherlock \
    recon-ng \
    spiderfoot \
    shodan \
    maltego \
    2>/dev/null || true

# Install social-analyzer
pip3 install --break-system-packages social-analyzer 2>/dev/null || true

# Install censys CLI
pip3 install --break-system-packages censys 2>/dev/null || true

# Additional required tools
echo "[12/12] Installing additional tools..."
DEBIAN_FRONTEND=noninteractive apt-get install -y \
    curl \
    wget \
    git \
    jq \
    chromium \
    chromium-driver \
    httpie \
    2>/dev/null || true

# Clean up
echo ""
echo "Cleaning up package cache..."
apt-get clean
rm -rf /var/lib/apt/lists/*

# Verification - Check which tools are installed
echo ""
echo "============================================="
echo "Verifying Tool Installation"
echo "============================================="
echo ""

declare -A TOOLS=(
    # Essential
    ["nmap"]="nmap"
    ["gobuster"]="gobuster"
    ["dirb"]="dirb"
    ["nikto"]="nikto"
    ["sqlmap"]="sqlmap"
    ["hydra"]="hydra"
    ["john"]="john"
    ["hashcat"]="hashcat"
    # Network
    ["rustscan"]="rustscan"
    ["masscan"]="masscan"
    ["nbtscan"]="nbtscan"
    ["autorecon"]="autorecon"
    ["arp-scan"]="arp-scan"
    ["responder"]="responder"
    ["enum4linux"]="enum4linux"
    ["enum4linux-ng"]="enum4linux-ng"
    ["rpcclient"]="rpcclient"
    ["tcpdump"]="tcpdump"
    ["tshark"]="tshark"
    ["aircrack-ng"]="aircrack-ng"
    # Web Security
    ["ffuf"]="ffuf"
    ["feroxbuster"]="feroxbuster"
    ["dirsearch"]="dirsearch"
    ["wfuzz"]="wfuzz"
    ["xsser"]="xsser"
    ["dotdotpwn"]="dotdotpwn"
    ["gau"]="gau"
    ["waybackurls"]="waybackurls"
    ["arjun"]="arjun"
    ["paramspider"]="paramspider"
    ["x8"]="x8"
    ["jaeles"]="jaeles"
    ["dalfox"]="dalfox"
    ["httpx"]="httpx"
    ["wafw00f"]="wafw00f"
    ["katana"]="katana"
    ["hakrawler"]="hakrawler"
    ["zaproxy"]="zaproxy"
    # Vuln Scanning
    ["nuclei"]="nuclei"
    ["wpscan"]="wpscan"
    # Password
    ["medusa"]="medusa"
    ["patator"]="patator"
    ["hash-identifier"]="hash-identifier"
    ["ophcrack"]="ophcrack"
    ["hashcat-utils"]="hashcat-utils"
    ["evil-winrm"]="evil-winrm"
    # Binary
    ["gdb"]="gdb"
    ["radare2"]="r2"
    ["binwalk"]="binwalk"
    ["checksec"]="checksec"
    ["objdump"]="objdump"
    ["ROPgadget"]="ROPgadget"
    ["ropper"]="ropper"
    ["one_gadget"]="one_gadget"
    ["pwninit"]="pwninit"
    # Forensics
    ["steghide"]="steghide"
    ["foremost"]="foremost"
    ["exiftool"]="exiftool"
    ["strings"]="strings"
    ["file"]="file"
    ["xxd"]="xxd"
    ["testdisk"]="testdisk"
    ["scalpel"]="scalpel"
    ["zsteg"]="zsteg"
    ["outguess"]="outguess"
    ["bulk_extractor"]="bulk_extractor"
    ["vol3"]="vol3"
    # Cloud
    ["trivy"]="trivy"
    ["checkov"]="checkov"
    ["prowler"]="prowler"
    ["kube-hunter"]="kube-hunter"
    ["kube-bench"]="kube-bench"
    ["terrascan"]="terrascan"
    # OSINT
    ["amass"]="amass"
    ["subfinder"]="subfinder"
    ["fierce"]="fierce"
    ["dnsenum"]="dnsenum"
    ["theharvester"]="theHarvester"
    ["sherlock"]="sherlock"
    ["recon-ng"]="recon-ng"
    ["spiderfoot"]="spiderfoot"
    # Exploitation
    ["msfconsole"]="msfconsole"
    ["msfvenom"]="msfvenom"
    ["searchsploit"]="searchsploit"
    # API
    ["curl"]="curl"
    ["httpie"]="http"
    ["anew"]="anew"
    ["qsreplace"]="qsreplace"
    # Additional
    ["netexec"]="netexec"
    ["smbmap"]="smbmap"
)

INSTALLED=0
MISSING=0

for tool in "${!TOOLS[@]}"; do
    if command -v "${TOOLS[$tool]}" &> /dev/null; then
        echo "  [OK] $tool"
        ((INSTALLED++))
    else
        echo "  [MISSING] $tool"
        ((MISSING++))
    fi
done

echo ""
echo "============================================="
echo "Installation Summary"
echo "============================================="
echo "  Installed: $INSTALLED tools"
echo "  Missing: $MISSING tools"
echo ""

if [ $MISSING -gt 0 ]; then
    echo "Note: Some tools may require manual installation."
    echo "Missing tools can often be installed via:"
    echo "  - apt-get install <package>"
    echo "  - pip3 install <package>"
    echo "  - go install <package>@latest"
    echo "  - gem install <package>"
fi

echo ""
echo "============================================="
echo "HexStrike Tools Installation Complete!"
echo "============================================="
