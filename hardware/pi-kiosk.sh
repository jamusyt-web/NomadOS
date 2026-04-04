#!/bin/bash
# Switches the Pi to Chromium kiosk mode (replaces Electron)
PI_USER="${SUDO_USER:-$USER}"
HOME_DIR="/home/$PI_USER"

cat > "$HOME_DIR/.config/openbox/autostart" << 'EOF'
xset s off &
xset s noblank &
xset -dpms &
unclutter -idle 1 -root &
python3 -m http.server 8080 --directory /home/jkillian/van-control/artifacts/van-control/dist/public &
sleep 3
chromium-browser --kiosk --noerrdialogs --disable-infobars --no-first-run http://localhost:8080 &
EOF

echo "Done. Rebooting..."
sudo reboot
