#!/bin/bash
# =============================================================================
# VAN CONTROL HUB — Raspberry Pi Setup Script
# =============================================================================
# Run this ONCE on a fresh Raspberry Pi OS (64-bit) installation.
# It configures the Pi to boot directly into the van control dashboard
# with no visible desktop, no login screen, and nothing else.
#
# Usage:
#   sudo bash hardware/pi-setup.sh
#
# =============================================================================

set -e

echo "=========================================="
echo "  Van Control Hub — Pi Setup"
echo "=========================================="

# ── Check we're running as root ───────────────────────────────────────────────
if [ "$EUID" -ne 0 ]; then
  echo "ERROR: Please run as root: sudo bash hardware/pi-setup.sh"
  exit 1
fi

# ── Auto-detect the real user (works even when called via sudo) ───────────────
if [ -n "$SUDO_USER" ] && [ "$SUDO_USER" != "root" ]; then
  PI_USER="$SUDO_USER"
elif [ -n "$USER" ] && [ "$USER" != "root" ]; then
  PI_USER="$USER"
else
  # Last resort: first non-root user with a home directory
  PI_USER=$(getent passwd | awk -F: '$3 >= 1000 && $3 < 65534 && $6 ~ /^\/home/ {print $1; exit}')
fi

if [ -z "$PI_USER" ]; then
  echo "ERROR: Could not detect a non-root user. Please set PI_USER manually:"
  echo "  sudo PI_USER=yourusername bash hardware/pi-setup.sh"
  exit 1
fi

HOME_DIR="/home/$PI_USER"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
APP_DIR="$HOME_DIR/van-control"

echo ""
echo "  Username : $PI_USER"
echo "  Home     : $HOME_DIR"
echo "  App dir  : $APP_DIR"
echo ""

# ── 1. System update and dependencies ────────────────────────────────────────
echo "[1/9] Updating system and installing dependencies..."
apt-get update -qq
apt-get install -y \
  curl \
  git \
  build-essential \
  python3 \
  python3-pip \
  xorg \
  openbox \
  xdotool \
  libgtk-3-0 \
  libnotify4 \
  libnss3 \
  libxss1 \
  libxtst6 \
  xdg-utils \
  libatspi2.0-0 \
  libdrm2 \
  libgbm1 \
  libasound2 \
  unclutter \
  --no-install-recommends
echo "[1/9] Done."

# ── 2. Install Node.js 20 LTS ─────────────────────────────────────────────────
echo ""
echo "[2/9] Installing Node.js 20 LTS..."
if ! command -v node &>/dev/null || [[ $(node --version | cut -d. -f1 | tr -d 'v') -lt 20 ]]; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y nodejs
fi
echo "  Node.js: $(node --version)"
echo "  npm:     $(npm --version)"
npm install -g pnpm@latest --quiet
echo "[2/9] Done."

# ── 3. Copy/link app files ────────────────────────────────────────────────────
echo ""
echo "[3/9] Setting up app directory..."

# If the project is already cloned into APP_DIR, skip copying
if [ "$PROJECT_ROOT" = "$APP_DIR" ]; then
  echo "  App already at $APP_DIR — skipping copy."
else
  mkdir -p "$APP_DIR"
  cp -r "$PROJECT_ROOT/." "$APP_DIR/"
fi

chown -R "$PI_USER:$PI_USER" "$APP_DIR"
echo "[3/9] Done."

# ── 4. Install npm packages ───────────────────────────────────────────────────
echo ""
echo "[4/9] Installing npm packages (this may take a few minutes)..."
cd "$APP_DIR"
sudo -u "$PI_USER" pnpm install --no-frozen-lockfile

echo "  Rebuilding serialport for Electron..."
cd "$APP_DIR/artifacts/van-electron"
sudo -u "$PI_USER" npx @electron/rebuild -f -w serialport 2>/dev/null || \
  echo "  (serialport rebuild skipped — will try again at runtime)"

echo "[4/9] Done."

# ── 5. Verify pre-built UI ────────────────────────────────────────────────────
echo ""
echo "[5/9] Checking pre-built UI..."
UI_DIST="$APP_DIR/artifacts/van-control/dist/public/index.html"

if [ -f "$UI_DIST" ]; then
  echo "  Pre-built UI found — no build needed on Pi."
  echo "[5/9] Done."
else
  echo ""
  echo "  ERROR: Built UI files not found at $UI_DIST"
  echo ""
  echo "  The UI must be built in Replit and committed to GitHub before"
  echo "  running this script. In Replit, run:"
  echo "    BUILD_TARGET=electron pnpm --filter @workspace/van-control run build"
  echo "  Then commit and push to GitHub, and re-run this setup script."
  exit 1
fi

# ── 6. Configure auto-login ───────────────────────────────────────────────────
echo ""
echo "[6/9] Configuring auto-login..."

# Try raspi-config first (cleanest method), fall back to manual systemd config
if command -v raspi-config &>/dev/null; then
  raspi-config nonint do_boot_behaviour B2 2>/dev/null || true
fi

# Always configure getty directly (works on all Pi OS versions)
mkdir -p /etc/systemd/system/getty@tty1.service.d
cat > /etc/systemd/system/getty@tty1.service.d/autologin.conf << EOF
[Service]
ExecStart=
ExecStart=-/sbin/agetty --autologin $PI_USER --noclear %I \$TERM
EOF

systemctl daemon-reload
systemctl enable getty@tty1
echo "[6/9] Done."

# ── 7. Set up X11 kiosk auto-start ───────────────────────────────────────────
echo ""
echo "[7/9] Configuring X11 kiosk session..."

mkdir -p "$HOME_DIR/.config/openbox"
cat > "$HOME_DIR/.config/openbox/autostart" << EOF
# Disable screen blanking and power management
xset s off &
xset s noblank &
xset -dpms &

# Hide cursor after 1 second of inactivity
unclutter -idle 1 -root &

# Launch Van Control Hub
$APP_DIR/hardware/pi-start.sh &
EOF
chown -R "$PI_USER:$PI_USER" "$HOME_DIR/.config"

# .bash_profile — auto-start X on TTY1 login
cat > "$HOME_DIR/.bash_profile" << 'BASHEOF'
if [ -z "$DISPLAY" ] && [ "$(tty)" = "/dev/tty1" ]; then
  exec startx -- -nocursor 2>/dev/null
fi
BASHEOF
chown "$PI_USER:$PI_USER" "$HOME_DIR/.bash_profile"

# .xinitrc — tell X to start openbox
cat > "$HOME_DIR/.xinitrc" << 'BASHEOF'
exec openbox-session
BASHEOF
chown "$PI_USER:$PI_USER" "$HOME_DIR/.xinitrc"

echo "[7/9] Done."

# ── 8. Create launch script ───────────────────────────────────────────────────
echo ""
echo "[8/9] Creating launch script..."
cat > "$APP_DIR/hardware/pi-start.sh" << EOF
#!/bin/bash
# Van Control Hub — Launcher (auto-generated by pi-setup.sh)

export DISPLAY=:0
export ELECTRON_DISABLE_SANDBOX=1

APP_DIR="$APP_DIR"

echo "[\$(date)] Starting Van Control Hub..." >> /tmp/van-control.log

# Wait for display to be ready
sleep 2

cd "\$APP_DIR/artifacts/van-electron"
exec npx electron . --no-sandbox >> /tmp/van-control.log 2>&1
EOF
chmod +x "$APP_DIR/hardware/pi-start.sh"
chown "$PI_USER:$PI_USER" "$APP_DIR/hardware/pi-start.sh"
echo "[8/9] Done."

# ── 9. Permissions ────────────────────────────────────────────────────────────
echo ""
echo "[9/9] Configuring permissions..."

# Backlight control
BACKLIGHT_PATH="/sys/class/backlight/rpi_backlight/brightness"
if [ -f "$BACKLIGHT_PATH" ]; then
  chmod a+w "$BACKLIGHT_PATH"
  cat > /etc/udev/rules.d/99-backlight.rules << 'EOF'
SUBSYSTEM=="backlight", ACTION=="add", RUN+="/bin/chmod a+w /sys/class/backlight/%k/brightness"
EOF
  echo "  Backlight configured."
else
  echo "  (Backlight path not found — OK if display not yet connected)"
fi

# Serial port access for Arduino
usermod -a -G dialout "$PI_USER"
echo "  Serial port (Arduino) access granted."
echo "[9/9] Done."

# ── Done ──────────────────────────────────────────────────────────────────────
echo ""
echo "=========================================="
echo "  Setup complete!"
echo "=========================================="
echo ""
echo "  Reboot your Pi to launch Van Control Hub:"
echo "    sudo reboot"
echo ""
echo "  On reboot it will boot directly into"
echo "  the dashboard. No login, no desktop."
echo ""
echo "  Logs: /tmp/van-control.log"
echo ""
echo "  To update the app later:"
echo "    cd $APP_DIR && git pull"
echo "    BUILD_TARGET=electron NODE_OPTIONS=--max-old-space-size=512 \\"
echo "      pnpm --filter @workspace/van-control run build"
echo ""
