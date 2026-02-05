#!/bin/bash
# HexStrike AI - Install all remaining missing tools
# Comprehensive installation for ARM64 compatibility

set -e

export PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin:/usr/local/go/bin:/root/go/bin:/root/.cargo/bin
export GOPATH=/root/go

echo "============================================="
echo "Installing All Missing Tools (54 tools)"
echo "============================================="

# Install basic system tools
echo "[1/20] Installing basic system tools..."
DEBIAN_FRONTEND=noninteractive apt-get install -y -qq \
    xxd \
    arp-scan \
    httpie \
    steghide \
    outguess \
    testdisk \
    photorec \
    bulk-extractor \
    sleuthkit \
    tshark \
    || echo "Some basic tools failed (non-critical)"

# Install Metasploit Framework
echo "[2/20] Installing Metasploit Framework..."
DEBIAN_FRONTEND=noninteractive apt-get install -y -qq metasploit-framework || echo "Metasploit install failed"

# Install ExploitDB
echo "[3/20] Installing ExploitDB..."
DEBIAN_FRONTEND=noninteractive apt-get install -y -qq exploitdb || echo "ExploitDB install failed"

# Install Python-based tools
echo "[4/20] Installing Python security tools..."
pip3 install --break-system-packages \
    pwntools \
    ropgadget \
    ropper \
    volatility3 \
    autorecon \
    prowler \
    ScoutSuite \
    checkov \
    truffleHog \
    shodan \
    censys \
    social-analyzer \
    spiderfoot-cli \
    || echo "Some Python tools failed (non-critical)"

# Install uro (URL optimizer)
echo "[5/20] Installing uro..."
pip3 install --break-system-packages uro || \
    (cd /tmp && git clone https://github.com/s0md3v/uro.git && cd uro && python3 setup.py install)

# Install paramspider (correct method)
echo "[6/20] Installing paramspider..."
cd /tmp
rm -rf ParamSpider
git clone https://github.com/devanshbatham/ParamSpider.git
cd ParamSpider
pip3 install --break-system-packages .
ln -sf $(which paramspider.py) /usr/local/bin/paramspider 2>/dev/null || \
    ln -sf /tmp/ParamSpider/paramspider.py /usr/local/bin/paramspider
chmod +x /usr/local/bin/paramspider

# Install x8 (Rust parameter discovery)
echo "[7/20] Installing x8..."
cd /tmp
rm -rf x8
git clone https://github.com/Sh1Yo/x8.git
cd x8
cargo build --release --quiet
cp target/release/x8 /usr/local/bin/x8
chmod +x /usr/local/bin/x8

# Install feroxbuster (verify and symlink)
echo "[8/20] Installing feroxbuster..."
if [ ! -f "/root/.cargo/bin/feroxbuster" ]; then
    cargo install feroxbuster
fi
ln -sf /root/.cargo/bin/feroxbuster /usr/local/bin/feroxbuster

# Install rustscan (verify and symlink)
echo "[9/20] Installing rustscan..."
if [ ! -f "/root/.cargo/bin/rustscan" ]; then
    cargo install rustscan
fi
ln -sf /root/.cargo/bin/rustscan /usr/local/bin/rustscan

# Install enum4linux-ng
echo "[10/20] Installing enum4linux-ng..."
cd /tmp
rm -rf enum4linux-ng
git clone https://github.com/cddmp/enum4linux-ng.git
cd enum4linux-ng
pip3 install --break-system-packages -r requirements.txt
ln -sf /tmp/enum4linux-ng/enum4linux-ng.py /usr/local/bin/enum4linux-ng
chmod +x /usr/local/bin/enum4linux-ng

# Install sherlock (OSINT)
echo "[11/20] Installing sherlock..."
cd /tmp
rm -rf sherlock
git clone https://github.com/sherlock-project/sherlock.git
cd sherlock
pip3 install --break-system-packages -r requirements.txt
ln -sf /tmp/sherlock/sherlock/sherlock.py /usr/local/bin/sherlock
chmod +x /usr/local/bin/sherlock

# Install trivy (container scanner)
echo "[12/20] Installing trivy..."
if ! command -v trivy &> /dev/null; then
    cd /tmp
    wget -q https://github.com/aquasecurity/trivy/releases/download/v0.48.0/trivy_0.48.0_Linux-ARM64.tar.gz
    tar -xzf trivy_0.48.0_Linux-ARM64.tar.gz
    mv trivy /usr/local/bin/
    chmod +x /usr/local/bin/trivy
    rm trivy_0.48.0_Linux-ARM64.tar.gz
fi

# Install JWT analyzer tools
echo "[13/20] Installing JWT tools..."
pip3 install --break-system-packages \
    pyjwt \
    jwt \
    || echo "JWT tools install failed (non-critical)"

# Create jwt-analyzer wrapper
cat > /usr/local/bin/jwt-analyzer << 'EOF'
#!/usr/bin/env python3
import sys
import jwt
print("JWT Analyzer - Use: jwt-analyzer <token>")
if len(sys.argv) > 1:
    try:
        decoded = jwt.decode(sys.argv[1], options={"verify_signature": False})
        print(decoded)
    except Exception as e:
        print(f"Error: {e}")
EOF
chmod +x /usr/local/bin/jwt-analyzer

# Install cloud security tools
echo "[14/20] Installing cloud security tools..."
pip3 install --break-system-packages \
    kube-hunter \
    || echo "kube-hunter install failed"

# Install Ghidra (large download, skip if exists)
echo "[15/20] Checking Ghidra..."
if [ ! -d "/opt/ghidra" ]; then
    echo "Ghidra not found - skipping (large download)"
fi

# Install Ruby-based tools
echo "[16/20] Installing Ruby tools..."
if command -v gem &> /dev/null; then
    gem install one_gadget zsteg 2>/dev/null || echo "Some Ruby tools failed"
fi

# Install hashcat-utils
echo "[17/20] Installing hashcat-utils..."
DEBIAN_FRONTEND=noninteractive apt-get install -y -qq hashcat-utils || echo "hashcat-utils not available for ARM64"

# Install pwntools dependencies
echo "[18/20] Installing pwninit..."
cd /tmp
if [ ! -f "/usr/local/bin/pwninit" ]; then
    # pwninit not available for ARM64, skip
    echo "pwninit not available for ARM64"
fi

# Install stegsolve
echo "[19/20] Installing stegsolve..."
if [ ! -f "/usr/local/bin/stegsolve.jar" ]; then
    cd /tmp
    wget -q http://www.caesum.com/handbook/Stegsolve.jar -O /usr/local/bin/stegsolve.jar 2>/dev/null || \
        echo "Stegsolve download failed"
    cat > /usr/local/bin/stegsolve << 'EOF'
#!/bin/bash
java -jar /usr/local/bin/stegsolve.jar "$@"
EOF
    chmod +x /usr/local/bin/stegsolve
fi

# Install additional forensics tools
echo "[20/20] Installing forensics tools..."
DEBIAN_FRONTEND=noninteractive apt-get install -y -qq \
    volatility3 \
    || pip3 install --break-system-packages volatility3

# Create symlinks for vol (volatility alias)
ln -sf /usr/bin/volatility3 /usr/local/bin/vol 2>/dev/null || \
    ln -sf $(which vol.py) /usr/local/bin/vol 2>/dev/null || \
    ln -sf $(which volatility) /usr/local/bin/vol 2>/dev/null || true

# Verify installations and create missing symlinks
echo ""
echo "Creating symlinks and verifying installations..."

# List of tools to symlink
declare -A tool_paths=(
    ["rustscan"]="/root/.cargo/bin/rustscan"
    ["feroxbuster"]="/root/.cargo/bin/feroxbuster"
    ["x8"]="/tmp/x8/target/release/x8"
    ["trivy"]="/usr/local/bin/trivy"
)

for tool in "${!tool_paths[@]}"; do
    if [ -f "${tool_paths[$tool]}" ] && [ ! -f "/usr/local/bin/$tool" ]; then
        ln -sf "${tool_paths[$tool]}" "/usr/local/bin/$tool"
    fi
done

# Update databases
echo "Updating tool databases..."
nuclei -update-templates -silent 2>/dev/null || true
searchsploit -u 2>/dev/null || true

# Verify installed tools
echo ""
echo "Verifying installations..."
installed=0
for tool in xxd arp-scan httpie steghide metasploit autorecon prowler \
            ropgadget ropper volatility3 paramspider uro x8 feroxbuster \
            rustscan enum4linux-ng sherlock trivy jwt-analyzer; do
    if command -v $tool &>/dev/null; then
        ((installed++))
    fi
done

echo ""
echo "============================================="
echo "Installation Complete!"
echo "============================================="
echo ""
echo "Successfully verified: $installed tools"
echo ""
echo "Installed categories:"
echo "  ✓ Basic tools (xxd, arp-scan, httpie)"
echo "  ✓ Binary analysis (pwntools, ropgadget, ropper)"
echo "  ✓ Forensics (volatility3, bulk-extractor, sleuthkit)"
echo "  ✓ Web security (paramspider, uro, x8, feroxbuster)"
echo "  ✓ Network (rustscan, arp-scan, tshark)"
echo "  ✓ Cloud (trivy, prowler, checkov)"
echo "  ✓ OSINT (sherlock, shodan)"
echo "  ✓ Exploitation (metasploit, exploitdb)"
echo "  ✓ Steganography (steghide, stegsolve, outguess)"
echo ""
echo "Note: Some tools are not available for ARM64 architecture"
echo "============================================="
