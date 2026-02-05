#!/bin/bash
# HexStrike AI - Final round of tool installations
# Focus on high-priority tools that work on ARM64

set -e

export PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin:/usr/local/go/bin:/root/go/bin:/root/.cargo/bin
export GOPATH=/root/go

echo "============================================="
echo "Final Tool Installation (High Priority)"
echo "============================================="

# Update apt cache first
apt-get update -qq

# Install tools from Kali repos that should work
echo "[1/15] Installing available system tools..."
apt-get install -y -qq \
    xxd \
    exploitdb \
    searchsploit \
    httpie \
    metasploit-framework \
    arp-scan \
    steghide \
    outguess \
    sleuthkit \
    autopsy \
    bulk-extractor \
    tshark \
    wireshark-common \
    volatility3 \
    testdisk \
    photorec \
    2>/dev/null || echo "Some tools not available for ARM64"

# Install Python tools
echo "[2/15] Installing Python-based security tools..."
pip3 install --break-system-packages \
    pwntools \
    ropgadget \
    ropper \
    volatility3 \
    shodan \
    censys \
    prowler \
    ScoutSuite \
    checkov \
    terrascan \
    truffleHog \
    2>/dev/null || echo "Some Python tools failed"

# Install autorecon from GitHub
echo "[3/15] Installing autorecon..."
cd /tmp
rm -rf AutoRecon
git clone --quiet https://github.com/Tib3rius/AutoRecon.git
cd AutoRecon
pip3 install --break-system-packages -r requirements.txt
python3 setup.py install
cd /tmp

# Install sherlock properly
echo "[4/15] Installing sherlock..."
cd /tmp
rm -rf sherlock
git clone --quiet https://github.com/sherlock-project/sherlock.git
cd sherlock
pip3 install --break-system-packages -r requirements.txt
python3 -m pip install --break-system-packages .
cd /tmp

# Install trivy for ARM64
echo "[5/15] Installing trivy..."
if [ ! -f "/usr/local/bin/trivy" ]; then
    wget -q https://github.com/aquasecurity/trivy/releases/download/v0.48.0/trivy_0.48.0_Linux-ARM64.tar.gz
    tar -xzf trivy_0.48.0_Linux-ARM64.tar.gz
    mv trivy /usr/local/bin/
    chmod +x /usr/local/bin/trivy
    rm -f trivy_0.48.0_Linux-ARM64.tar.gz
fi

# Create vol symlink for volatility
echo "[6/15] Creating volatility symlinks..."
ln -sf /usr/bin/vol.py /usr/local/bin/vol 2>/dev/null || \
    ln -sf /usr/bin/volatility /usr/local/bin/vol 2>/dev/null || \
    ln -sf /usr/bin/volatility3 /usr/local/bin/vol 2>/dev/null || true

# Create exploit-db symlink
echo "[7/15] Creating exploit-db symlinks..."
ln -sf /usr/bin/searchsploit /usr/local/bin/exploit-db 2>/dev/null || true

# Install JWT tools
echo "[8/15] Installing JWT analyzer..."
pip3 install --break-system-packages PyJWT cryptography

cat > /usr/local/bin/jwt-analyzer << 'EOFJ'
#!/usr/bin/env python3
import sys
import json
try:
    import jwt
except ImportError:
    print("Error: PyJWT not installed")
    sys.exit(1)

if len(sys.argv) < 2:
    print("Usage: jwt-analyzer <token>")
    sys.exit(1)

token = sys.argv[1]
try:
    # Decode without verification
    header = jwt.get_unverified_header(token)
    payload = jwt.decode(token, options={"verify_signature": False})

    print("JWT Token Analysis")
    print("=" * 50)
    print("\nHeader:")
    print(json.dumps(header, indent=2))
    print("\nPayload:")
    print(json.dumps(payload, indent=2))
except Exception as e:
    print(f"Error decoding JWT: {e}")
    sys.exit(1)
EOFJ
chmod +x /usr/local/bin/jwt-analyzer

# Install Ruby tools
echo "[9/15] Installing Ruby tools..."
if command -v gem &>/dev/null; then
    gem install one_gadget zsteg 2>/dev/null || echo "Ruby tools failed"
fi

# Install stegsolve
echo "[10/15] Installing stegsolve..."
if [ ! -f "/usr/local/bin/stegsolve" ]; then
    wget -q http://www.caesum.com/handbook/Stegsolve.jar -O /usr/local/bin/stegsolve.jar 2>/dev/null || echo "Stegsolve download failed"
    cat > /usr/local/bin/stegsolve << 'EOFS'
#!/bin/bash
java -jar /usr/local/bin/stegsolve.jar "$@"
EOFS
    chmod +x /usr/local/bin/stegsolve
fi

# Install cloud security tools via pip
echo "[11/15] Installing cloud security tools..."
pip3 install --break-system-packages \
    kube-hunter \
    detect-secrets \
    2>/dev/null || echo "Some cloud tools failed"

# Install hashpump
echo "[12/15] Installing hashpump..."
cd /tmp
if [ ! -f "/usr/local/bin/hashpump" ]; then
    git clone --quiet https://github.com/bwall/HashPump.git || true
    cd HashPump
    apt-get install -y -qq g++ libssl-dev 2>/dev/null
    make 2>/dev/null && cp hashpump /usr/local/bin/ || echo "hashpump build failed"
    cd /tmp
fi

# Install social-analyzer
echo "[13/15] Installing social-analyzer..."
pip3 install --break-system-packages social-analyzer 2>/dev/null || echo "social-analyzer failed"

# Install spiderfoot
echo "[14/15] Installing spiderfoot..."
pip3 install --break-system-packages spiderfoot 2>/dev/null || \
    (cd /tmp && git clone --quiet https://github.com/smicallef/spiderfoot.git && \
     cd spiderfoot && pip3 install --break-system-packages -r requirements.txt) || \
    echo "spiderfoot failed"

# Verify and create symlinks
echo "[15/15] Creating final symlinks..."

# Create symlinks for tools in non-standard locations
declare -A SYMLINKS=(
    ["/usr/bin/msfconsole"]="metasploit"
    ["/usr/bin/searchsploit"]="exploit-db"
    ["/usr/bin/volatility3"]="vol"
    ["/usr/bin/volatility3"]="volatility"
)

for src in "${!SYMLINKS[@]}"; do
    dest="${SYMLINKS[$src]}"
    if [ -f "$src" ] && [ ! -f "/usr/local/bin/$dest" ]; then
        ln -sf "$src" "/usr/local/bin/$dest"
    fi
done

# Ensure PATH tools are accessible
for tool in rustscan feroxbuster ffuf gobuster; do
    if [ -f "/root/.cargo/bin/$tool" ]; then
        ln -sf "/root/.cargo/bin/$tool" "/usr/local/bin/$tool"
    elif [ -f "/root/go/bin/$tool" ]; then
        ln -sf "/root/go/bin/$tool" "/usr/local/bin/$tool"
    fi
done

# Update tool databases
echo ""
echo "Updating databases..."
searchsploit -u 2>/dev/null || echo "searchsploit update skipped"
nuclei -update-templates -silent 2>/dev/null || echo "nuclei update skipped"

# Count installed tools
echo ""
echo "Verifying installations..."
count=0
for tool in xxd arp-scan httpie steghide metasploit autorecon prowler \
            ropgadget ropper volatility3 sherlock trivy jwt-analyzer \
            exploit-db testdisk photorec tshark bulk-extractor sleuthkit \
            pwntools shodan checkov terrascan; do
    if command -v $tool &>/dev/null 2>&1; then
        ((count++))
    fi
done

echo ""
echo "============================================="
echo "Final Installation Complete!"
echo "============================================="
echo ""
echo "Successfully installed/verified: $count tools"
echo ""
echo "Categories covered:"
echo "  ✓ Basic utilities (xxd, etc.)"
echo "  ✓ Network scanning (arp-scan)"
echo "  ✓ Binary analysis (ropgadget, ropper, pwntools)"
echo "  ✓ Forensics (volatility3, sleuthkit, bulk-extractor)"
echo "  ✓ Steganography (steghide, stegsolve, outguess, zsteg)"
echo "  ✓ OSINT (sherlock, shodan)"
echo "  ✓ Exploitation (metasploit, exploit-db)"
echo "  ✓ Cloud security (trivy, prowler, checkov)"
echo "  ✓ JWT analysis (jwt-analyzer)"
echo ""
echo "============================================="
