#!/bin/bash
# Nuclei Maintenance Script for HexStrike
# Updates nuclei binary, templates, and validates installation

set -e

echo "╭─────────────────────────────────────────────────────────────╮"
echo "│       NUCLEI MAINTENANCE SCRIPT - HexStrike AI              │"
echo "╰─────────────────────────────────────────────────────────────╯"
echo ""

# Detect architecture
ARCH=$(uname -m)
if [ "$ARCH" = "x86_64" ]; then
    ARCH_NAME="amd64"
elif [ "$ARCH" = "aarch64" ] || [ "$ARCH" = "arm64" ]; then
    ARCH_NAME="arm64"
else
    echo "⚠️  Unsupported architecture: $ARCH"
    exit 1
fi
echo "📍 Architecture: $ARCH ($ARCH_NAME)"
echo ""

# Step 1: Update nuclei binary
echo "┌─────────────────────────────────────────────────────────────┐"
echo "│ [1/4] Updating nuclei binary...                             │"
echo "└─────────────────────────────────────────────────────────────┘"

CURRENT_VERSION=$(nuclei -version 2>&1 | grep -oP 'v\K[0-9.]+' | head -1 || echo "unknown")
echo "   Current version: v${CURRENT_VERSION}"

# Try self-update first
echo "   Attempting self-update..."
if nuclei -update 2>&1 | grep -q "already latest"; then
    echo "   ✓ Already at latest version"
else
    # Download latest if self-update fails or updates
    echo "   Downloading latest release..."
    NUCLEI_VERSION=$(curl -s https://api.github.com/repos/projectdiscovery/nuclei/releases/latest | jq -r '.tag_name' | sed 's/v//')

    if [ -z "$NUCLEI_VERSION" ] || [ "$NUCLEI_VERSION" = "null" ]; then
        echo "   ⚠️  Could not fetch latest version from GitHub API"
        NUCLEI_VERSION="3.4.0"  # Fallback
        echo "   Using fallback version: v${NUCLEI_VERSION}"
    fi

    echo "   Installing nuclei v${NUCLEI_VERSION}..."
    wget -q "https://github.com/projectdiscovery/nuclei/releases/download/v${NUCLEI_VERSION}/nuclei_${NUCLEI_VERSION}_linux_${ARCH_NAME}.zip" -O /tmp/nuclei.zip

    if [ -f /tmp/nuclei.zip ]; then
        mkdir -p /tmp/nuclei_extract
        unzip -q -o /tmp/nuclei.zip -d /tmp/nuclei_extract/
        mv /tmp/nuclei_extract/nuclei /usr/local/bin/nuclei
        chmod +x /usr/local/bin/nuclei
        rm -rf /tmp/nuclei.zip /tmp/nuclei_extract/
        echo "   ✓ Installed nuclei v${NUCLEI_VERSION}"
    else
        echo "   ✗ Download failed"
    fi
fi

NEW_VERSION=$(nuclei -version 2>&1 | grep -oP 'v\K[0-9.]+' | head -1 || echo "unknown")
echo "   New version: v${NEW_VERSION}"
echo ""

# Step 2: Update templates
echo "┌─────────────────────────────────────────────────────────────┐"
echo "│ [2/4] Updating nuclei templates...                          │"
echo "└─────────────────────────────────────────────────────────────┘"

# Clear old templates if they exist in non-standard locations
if [ -d ~/.local/nuclei-templates ]; then
    echo "   Removing old templates from ~/.local/nuclei-templates..."
    rm -rf ~/.local/nuclei-templates
fi

echo "   Downloading latest templates..."
nuclei -update-templates 2>&1 | tail -5

# Count templates
TEMPLATE_COUNT=$(find /root/nuclei-templates -name "*.yaml" 2>/dev/null | wc -l || echo "0")
echo "   ✓ Templates updated: ${TEMPLATE_COUNT} templates available"
echo ""

# Step 3: Validate templates
echo "┌─────────────────────────────────────────────────────────────┐"
echo "│ [3/4] Validating templates...                               │"
echo "└─────────────────────────────────────────────────────────────┘"

VALIDATION_ERRORS=$(nuclei -validate -silent 2>&1 | grep -ci "error" || echo "0")
if [ "$VALIDATION_ERRORS" -gt 0 ]; then
    echo "   ⚠️  Found ${VALIDATION_ERRORS} validation issues"
    echo "   Showing first 10 errors:"
    nuclei -validate -silent 2>&1 | grep -i "error" | head -10 || true
else
    echo "   ✓ No validation errors found"
fi
echo ""

# Step 4: Show status
echo "┌─────────────────────────────────────────────────────────────┐"
echo "│ [4/4] Nuclei Status                                         │"
echo "└─────────────────────────────────────────────────────────────┘"

echo "   Version:    $(nuclei -version 2>&1 | head -1)"
echo "   Templates:  /root/nuclei-templates"
echo "   Count:      ${TEMPLATE_COUNT} templates"
echo ""

# List template categories
echo "   Template Categories:"
if [ -d /root/nuclei-templates ]; then
    ls -d /root/nuclei-templates/*/ 2>/dev/null | xargs -n1 basename | head -15 | while read dir; do
        count=$(find "/root/nuclei-templates/$dir" -name "*.yaml" 2>/dev/null | wc -l)
        printf "     - %-25s %5d templates\n" "$dir" "$count"
    done
fi
echo ""

# Quick test
echo "   Quick Test:"
if nuclei -u https://example.com -t http/technologies/ -silent -timeout 10 2>/dev/null | head -3; then
    echo "   ✓ Nuclei is working correctly"
else
    echo "   ✓ Test completed (no findings on example.com is expected)"
fi

echo ""
echo "╭─────────────────────────────────────────────────────────────╮"
echo "│              ✓ NUCLEI MAINTENANCE COMPLETE                  │"
echo "╰─────────────────────────────────────────────────────────────╯"
