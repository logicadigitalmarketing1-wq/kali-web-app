#!/bin/bash
# HexStrike AI - Install remaining tools that need special handling
set -e

export PATH=$PATH:/usr/local/go/bin:/root/go/bin:/root/.cargo/bin
export GOPATH=/root/go

echo "============================================="
echo "Installing Remaining Tools"
echo "============================================="

cd /tmp

# Install dirsearch from GitHub
if [ ! -f "/usr/local/bin/dirsearch" ]; then
    echo "[1] Installing dirsearch..."
    git clone --quiet https://github.com/maurosoria/dirsearch.git
    cd dirsearch
    pip3 install --break-system-packages -r requirements.txt
    ln -sf /tmp/dirsearch/dirsearch.py /usr/local/bin/dirsearch
    chmod +x /usr/local/bin/dirsearch
    cd /tmp
fi

# Install arjun from GitHub (Python-based)
if [ ! -f "/usr/local/bin/arjun" ]; then
    echo "[2] Installing arjun..."
    git clone --quiet https://github.com/s0md3v/Arjun.git
    cd Arjun
    python3 setup.py install --prefix=/usr/local || pip3 install --break-system-packages .
    cd /tmp
fi

# Install paramspider from GitHub
if [ ! -f "/usr/local/bin/paramspider" ]; then
    echo "[3] Installing paramspider..."
    git clone --quiet https://github.com/devanshbatham/ParamSpider.git
    cd ParamSpider
    pip3 install --break-system-packages -r requirements.txt
    ln -sf /tmp/ParamSpider/paramspider.py /usr/local/bin/paramspider
    chmod +x /usr/local/bin/paramspider
    cd /tmp
fi

# Install uro from GitHub
if [ ! -f "/usr/local/bin/uro" ]; then
    echo "[4] Installing uro..."
    pip3 install --break-system-packages uro || \
    (git clone --quiet https://github.com/s0md3v/uro.git && \
     cd uro && \
     python3 setup.py install --prefix=/usr/local && \
     cd /tmp)
fi

# Install x8 from GitHub (Rust-based parameter discovery)
if [ ! -f "/usr/local/bin/x8" ]; then
    echo "[5] Installing x8..."
    git clone --quiet https://github.com/Sh1Yo/x8.git
    cd x8
    cargo build --release
    cp target/release/x8 /usr/local/bin/
    cd /tmp
fi

# Install feroxbuster (correct install)
if [ ! -f "/root/.cargo/bin/feroxbuster" ]; then
    echo "[6] Installing feroxbuster..."
    cargo install feroxbuster
    ln -sf /root/.cargo/bin/feroxbuster /usr/local/bin/feroxbuster
fi

# Install autorecon from GitHub
if [ ! -f "/usr/local/bin/autorecon" ]; then
    echo "[7] Installing autorecon..."
    pip3 install --break-system-packages git+https://github.com/Tib3rius/AutoRecon.git
fi

# Install enum4linux-ng
if [ ! -f "/usr/local/bin/enum4linux-ng" ]; then
    echo "[8] Installing enum4linux-ng..."
    git clone --quiet https://github.com/cddmp/enum4linux-ng.git
    cd enum4linux-ng
    pip3 install --break-system-packages -r requirements.txt
    ln -sf /tmp/enum4linux-ng/enum4linux-ng.py /usr/local/bin/enum4linux-ng
    chmod +x /usr/local/bin/enum4linux-ng
    cd /tmp
fi

# Install stegsolve
if [ ! -f "/usr/local/bin/stegsolve" ]; then
    echo "[9] Installing stegsolve..."
    wget -q http://www.caesum.com/handbook/Stegsolve.jar -O /usr/local/bin/stegsolve.jar
    echo '#!/bin/bash' > /usr/local/bin/stegsolve
    echo 'java -jar /usr/local/bin/stegsolve.jar "$@"' >> /usr/local/bin/stegsolve
    chmod +x /usr/local/bin/stegsolve
fi

# Install zsteg
if [ ! -f "/usr/local/bin/zsteg" ]; then
    echo "[10] Installing zsteg (Ruby gem)..."
    gem install zsteg || echo "zsteg install failed (non-critical)"
fi

# Install sherlock from GitHub
if [ ! -f "/usr/local/bin/sherlock" ]; then
    echo "[11] Installing sherlock..."
    git clone --quiet https://github.com/sherlock-project/sherlock.git
    cd sherlock
    pip3 install --break-system-packages -r requirements.txt
    ln -sf /tmp/sherlock/sherlock/sherlock.py /usr/local/bin/sherlock
    chmod +x /usr/local/bin/sherlock
    cd /tmp
fi

# Install theharvester (if not already installed)
if [ ! -f "/usr/bin/theharvester" ]; then
    echo "[12] Installing theHarvester..."
    pip3 install --break-system-packages theHarvester || \
    apt-get install -y theharvester
fi

# Install JWT tools
echo "[13] Installing JWT analysis tools..."
pip3 install --break-system-packages pyjwt[crypto] || echo "pyjwt install failed (non-critical)"

# Install cloud tools
echo "[14] Installing cloud security tools..."
pip3 install --break-system-packages \
    detect-secrets \
    truffleHog \
    gitpython \
    || echo "Some cloud tools failed (non-critical)"

# Install API testing tools
echo "[15] Installing API testing tools..."
pip3 install --break-system-packages \
    httpie \
    || apt-get install -y httpie

# Update nuclei templates
if command -v nuclei &> /dev/null; then
    echo "[16] Updating nuclei templates..."
    nuclei -update-templates -silent || echo "nuclei update failed (non-critical)"
fi

# Create symlinks for tools in /tmp
echo "[17] Creating symlinks..."
for tool in /tmp/*/; do
    toolname=$(basename "$tool")
    if [ -f "$tool/${toolname}.py" ]; then
        ln -sf "$tool/${toolname}.py" "/usr/local/bin/${toolname}" 2>/dev/null || true
    fi
done

echo ""
echo "============================================="
echo "Remaining Tools Installation Complete!"
echo "============================================="
echo ""
echo "Additional tools installed:"
echo "  ✓ dirsearch, arjun, paramspider, uro, x8"
echo "  ✓ feroxbuster, autorecon, enum4linux-ng"
echo "  ✓ stegsolve, zsteg, sherlock"
echo "  ✓ theHarvester, JWT tools"
echo "  ✓ Cloud security tools"
echo "  ✓ API testing tools"
echo ""
echo "============================================="
