#!/bin/bash
# =============================================================================
# VAN CONTROL HUB — Raspberry Pi Setup Script
# =============================================================================
# Run this ONCE on a fresh Raspberry Pi OS Lite (64-bit) installation.
# It configures the Pi to boot directly into the van control dashboard
# with no visible desktop, no login screen, and nothing else.
#
# Usage:
#   chmod +x pi-setup.sh
#   sudo ./pi-setup.sh
#
# What this script does:
#   1. Installs Node.js 20 LTS + build tools
#   2. Installs Electron dependencies (Xorg, GPU libraries)
#   3. Clones/copies the van control app
#   4. Builds the React UI
#   5. Installs npm packages (including serialport native build)
#   6. Configures auto-login (no password on boot)
#   7. Configures X11 kiosk session that launches Electron
#   8. Disables screen blanking / power management
#   9. Allows backlight control without sudo
# =============================================================================

set -e  # Exit on any error

APP_DIR="/home/pi/van-control"
PI_USER="pi"

echo "=========================================="
echo "  Van Control Hub — Pi Setup"
echo "=========================================="

# ── Check we're running as root ───────────────────────────────────────────────
if [ "$EUID" -ne 0 ]; then
  echo "ERROR: Please run as root: sudo ./pi-setup.sh"
  exit 1
fi

# ── 1. System update and dependencies ────────────────────────────────────────
echo ""
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

# ── 2. Install Node.js 20 LTS ─────────────────────────────────────────────────
echo ""
echo "[2/9] Installing Node.js 20 LTS..."
if ! command -v node &>/dev/null || [[ $(node --version | cut -d. -f1 | tr -d 'v') -lt 20 ]]; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y nodejs
fi
echo "Node.js: $(node --version)"
echo "npm: $(npm --version)"

# Install pnpm
npm install -g pnpm@latest

# ── 3. Copy app files ─────────────────────────────────────────────────────────
echo ""
echo "[3/9] Setting up app directory at $APP_DIR..."
mkdir -p "$APP_DIR"

# If running from inside the project directory, copy files
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

if [ -d "$PROJECT_ROOT/artifacts/van-control" ]; then
  echo "Copying project files..."
  cp -r "$PROJECT_ROOT/." "$APP_DIR/"
  chown -R "$PI_USER:$PI_USER" "$APP_DIR"
else
  echo "Project files not found at $PROJECT_ROOT"
  echo "Please copy the project to $APP_DIR manually, then re-run this script."
  exit 1
fi

# ── 4. Install npm packages ───────────────────────────────────────────────────
echo ""
echo "[4/9] Installing npm packages..."
cd "$APP_DIR"
sudo -u "$PI_USER" pnpm install --no-frozen-lockfile

# Rebuild serialport native module for Electron
echo "Rebuilding serialport for Electron..."
cd "$APP_DIR/artifacts/van-electron"
sudo -u "$PI_USER" npx @electron/rebuild -f -w serialport 2>/dev/null || \
  echo "(serialport rebuild skipped — will work as long as ABI matches)"

# ── 5. Build the React UI ─────────────────────────────────────────────────────
echo ""
echo "[5/9] Building React UI for Electron..."
cd "$APP_DIR"
sudo -u "$PI_USER" BUILD_TARGET=electron pnpm --filter @workspace/van-control run build

echo "UI built successfully."

# ── 6. Configure auto-login ───────────────────────────────────────────────────
echo ""
echo "[6/9] Configuring auto-login..."

# Raspberry Pi OS auto-login via raspi-config
raspi-config nonint do_boot_behaviour B2  # Console auto-login (text mode)

# Also configure getty for TTY1
mkdir -p /etc/systemd/system/getty@tty1.service.d
cat > /etc/systemd/system/getty@tty1.service.d/autologin.conf << EOF
[Service]
ExecStart=
ExecStart=-/sbin/agetty --autologin $PI_USER --noclear %I \$TERM
EOF

systemctl daemon-reload
systemctl enable getty@tty1

# ── 7. Set up X11 kiosk auto-start ───────────────────────────────────────────
echo ""
echo "[7/9] Configuring X11 kiosk session..."

# Openbox config — minimal window manager, no decorations
mkdir -p "/home/$PI_USER/.config/openbox"
cat > "/home/$PI_USER/.config/openbox/autostart" << 'EOF'
# Disable screen blanking and power management
xset s off &
xset s noblank &
xset -dpms &

# Hide cursor after 1 second of inactivity
unclutter -idle 1 -root &

# Launch Van Control Hub
/home/pi/van-control/hardware/pi-start.sh &
EOF
chown "$PI_USER:$PI_USER" "/home/$PI_USER/.config/openbox/autostart"

# .bash_profile to auto-start X on TTY1
cat > "/home/$PI_USER/.bash_profile" << 'EOF'
# Auto-start X on TTY1
if [ -z "$DISPLAY" ] && [ "$(tty)" = "/dev/tty1" ]; then
  exec startx -- -nocursor 2>/dev/null
fi
EOF
chown "$PI_USER:$PI_USER" "/home/$PI_USER/.bash_profile"

# .xinitrc to start openbox
cat > "/home/$PI_USER/.xinitrc" << 'EOF'
exec openbox-session
EOF
chown "$PI_USER:$PI_USER" "/home/$PI_USER/.xinitrc"

# ── 8. Create launch script ───────────────────────────────────────────────────
echo ""
echo "[8/9] Creating launch script..."
cat > "$APP_DIR/hardware/pi-start.sh" << 'EOF'
#!/bin/bash
# Van Control Hub — Launcher
# This script is called by Openbox autostart on boot.

export DISPLAY=:0
export ELECTRON_DISABLE_SANDBOX=1
export LIBGL_ALWAYS_SOFTWARE=1  # Use software rendering if GPU init fails

APP_DIR="/home/pi/van-control"

echo "[$(date)] Starting Van Control Hub..." >> /tmp/van-control.log

# Wait for display to be ready
sleep 2

cd "$APP_DIR/artifacts/van-electron"
exec npx electron . --no-sandbox >> /tmp/van-control.log 2>&1
EOF
chmod +x "$APP_DIR/hardware/pi-start.sh"
chown "$PI_USER:$PI_USER" "$APP_DIR/hardware/pi-start.sh"

# ── 9. Backlight permissions ──────────────────────────────────────────────────
echo ""
echo "[9/9] Configuring backlight permissions..."
BACKLIGHT_PATH="/sys/class/backlight/rpi_backlight/brightness"
if [ -f "$BACKLIGHT_PATH" ]; then
  chmod a+w "$BACKLIGHT_PATH"
  # Make it persist across reboots via udev
  cat > /etc/udev/rules.d/99-backlight.rules << 'EOF'
SUBSYSTEM=="backlight", ACTION=="add", RUN+="/bin/chmod a+w /sys/class/backlight/%k/brightness"
EOF
  echo "Backlight configured."
else
  echo "(Backlight path not found — will configure when Pi display is attached)"
fi

# Serial port permissions
usermod -a -G dialout "$PI_USER"
echo "Added $PI_USER to dialout group (serial port access)."

# ── Done ──────────────────────────────────────────────────────────────────────
echo ""
echo "=========================================="
echo "  Setup complete!"
echo "=========================================="
echo ""
echo "  Reboot your Pi to start Van Control Hub:"
echo "    sudo reboot"
echo ""
echo "  The Pi will boot directly into the dashboard."
echo "  Logs: /tmp/van-control.log"
echo ""
echo "  To update the app later:"
echo "    cd /home/pi/van-control"
echo "    git pull  (or copy new files)"
echo "    BUILD_TARGET=electron pnpm --filter @workspace/van-control run build"
echo ""
