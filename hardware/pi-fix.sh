#!/bin/bash
# NomadOS Pi Fix — restores correct kiosk startup
# Run via SSH: curl -fsSL https://raw.githubusercontent.com/jamusyt-web/NomadOS/main/hardware/pi-fix.sh | sudo bash

APP_DIR="/home/jkillian/van-control"

# 1. Restore openbox autostart
mkdir -p /home/jkillian/.config/openbox
cat > /home/jkillian/.config/openbox/autostart << 'AUTOEOF'
xset s off &
xset s noblank &
xset -dpms &
unclutter -idle 1 -root &
/home/jkillian/van-control/hardware/pi-start.sh &
AUTOEOF

# 2. Write corrected launch script with all flags needed on Pi
cat > "$APP_DIR/hardware/pi-start.sh" << 'STARTEOF'
#!/bin/bash
export DISPLAY=:0
export ELECTRON_DISABLE_SANDBOX=1
APP_DIR="/home/jkillian/van-control"
echo "[$(date)] Starting Van Control Hub..." >> /tmp/van-control.log
sleep 2
cd "$APP_DIR/artifacts/van-electron"
exec npx electron . \
  --no-sandbox \
  --disable-gpu \
  --disable-dev-shm-usage \
  --disable-software-rasterizer \
  >> /tmp/van-control.log 2>&1
STARTEOF

chmod +x "$APP_DIR/hardware/pi-start.sh"
chown jkillian:jkillian "$APP_DIR/hardware/pi-start.sh"
chown jkillian:jkillian /home/jkillian/.config/openbox/autostart

echo "Fixed. Rebooting in 3 seconds..."
sleep 3
reboot
