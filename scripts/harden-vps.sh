#!/bin/bash
# VPS Security Hardening Script (Ubuntu 22.04 LTS)
# Creates non-root user, hardens SSH, configures UFW firewall, installs fail2ban
set -euo pipefail

# Configuration
DEPLOY_USER="${DEPLOY_USER:-deploy}"
SSH_PORT="${SSH_PORT:-2222}"

echo "=========================================="
echo " VPS Security Hardening"
echo " Target: Ubuntu 22.04 LTS"
echo "=========================================="

# Must run as root
if [ "$(id -u)" -ne 0 ]; then
  echo "Error: This script must be run as root."
  exit 1
fi

# ─── 1. Create non-root deploy user ───
echo "[1/7] Creating deploy user: $DEPLOY_USER"
if id "$DEPLOY_USER" &>/dev/null; then
  echo "  User '$DEPLOY_USER' already exists, skipping."
else
  adduser --disabled-password --gecos "" "$DEPLOY_USER"
  usermod -aG sudo "$DEPLOY_USER"
  usermod -aG docker "$DEPLOY_USER" 2>/dev/null || true
  echo "  User '$DEPLOY_USER' created and added to sudo group."
fi

# Set up SSH directory for deploy user
mkdir -p "/home/$DEPLOY_USER/.ssh"
chmod 700 "/home/$DEPLOY_USER/.ssh"
touch "/home/$DEPLOY_USER/.ssh/authorized_keys"
chmod 600 "/home/$DEPLOY_USER/.ssh/authorized_keys"
chown -R "$DEPLOY_USER:$DEPLOY_USER" "/home/$DEPLOY_USER/.ssh"
echo "  SSH directory configured. Add your public key to /home/$DEPLOY_USER/.ssh/authorized_keys"

# ─── 2. SSH Hardening ───
echo "[2/7] Hardening SSH configuration (port $SSH_PORT, key-only, no root login)"
cp /etc/ssh/sshd_config /etc/ssh/sshd_config.bak

cat > /etc/ssh/sshd_config.d/hardening.conf <<EOF
# SSH Hardening Configuration
Port $SSH_PORT
PermitRootLogin no
PasswordAuthentication no
PubkeyAuthentication yes
MaxAuthTries 3
MaxSessions 5
LoginGraceTime 30
ClientAliveInterval 300
ClientAliveCountMax 2
X11Forwarding no
AllowAgentForwarding no
AllowTcpForwarding no
PermitEmptyPasswords no
EOF

echo "  SSH hardened: port=$SSH_PORT, root login disabled, password auth disabled."

# ─── 3. UFW Firewall ───
echo "[3/7] Configuring UFW firewall (allow: $SSH_PORT, 80, 443)"
apt-get update -qq
apt-get install -y -qq ufw

ufw default deny incoming
ufw default allow outgoing
ufw allow "$SSH_PORT"/tcp comment "SSH"
ufw allow 80/tcp comment "HTTP"
ufw allow 443/tcp comment "HTTPS"

# Enable UFW non-interactively
echo "y" | ufw enable
echo "  UFW enabled. Allowed ports: $SSH_PORT (SSH), 80 (HTTP), 443 (HTTPS)."

# ─── 4. Fail2ban ───
echo "[4/7] Installing and configuring fail2ban"
apt-get install -y -qq fail2ban

cat > /etc/fail2ban/jail.local <<EOF
[DEFAULT]
bantime = 3600
findtime = 600
maxretry = 3
backend = systemd

[sshd]
enabled = true
port = $SSH_PORT
maxretry = 3
bantime = 3600

[nginx-limit-req]
enabled = true
port = http,https
filter = nginx-limit-req
logpath = /var/log/nginx/error.log
maxretry = 10
bantime = 600
EOF

systemctl enable fail2ban
systemctl restart fail2ban
echo "  Fail2ban installed: SSH (3 attempts), Nginx rate-limit (10 attempts)."

# ─── 5. Unattended Upgrades ───
echo "[5/7] Configuring unattended security upgrades"
apt-get install -y -qq unattended-upgrades

cat > /etc/apt/apt.conf.d/20auto-upgrades <<EOF
APT::Periodic::Update-Package-Lists "1";
APT::Periodic::Unattended-Upgrade "1";
APT::Periodic::AutocleanInterval "7";
EOF

cat > /etc/apt/apt.conf.d/50unattended-upgrades <<EOF
Unattended-Upgrade::Allowed-Origins {
    "\${distro_id}:\${distro_codename}-security";
    "\${distro_id}ESMApps:\${distro_codename}-apps-security";
    "\${distro_id}ESM:\${distro_codename}-infra-security";
};
Unattended-Upgrade::AutoFixInterruptedDpkg "true";
Unattended-Upgrade::Remove-Unused-Kernel-Packages "true";
Unattended-Upgrade::Remove-Unused-Dependencies "true";
EOF

echo "  Unattended security upgrades enabled."

# ─── 6. Kernel/Sysctl Hardening ───
echo "[6/7] Applying kernel hardening (sysctl)"
cat > /etc/sysctl.d/99-security.conf <<EOF
# Network security
net.ipv4.tcp_syncookies = 1
net.ipv4.conf.all.accept_redirects = 0
net.ipv4.conf.default.accept_redirects = 0
net.ipv4.conf.all.send_redirects = 0
net.ipv4.conf.default.send_redirects = 0
net.ipv4.conf.all.accept_source_route = 0
net.ipv4.conf.default.accept_source_route = 0
net.ipv4.conf.all.log_martians = 1
net.ipv4.icmp_echo_ignore_broadcasts = 1
net.ipv4.icmp_ignore_bogus_error_responses = 1

# IPv6 hardening
net.ipv6.conf.all.accept_redirects = 0
net.ipv6.conf.default.accept_redirects = 0

# ASLR
kernel.randomize_va_space = 2

# Restrict dmesg access
kernel.dmesg_restrict = 1
EOF

sysctl --system > /dev/null 2>&1
echo "  Kernel hardened: SYN cookies, no redirects, ASLR enabled."

# ─── 7. File Descriptor Limits ───
echo "[7/7] Setting file descriptor limits for $DEPLOY_USER"
cat >> /etc/security/limits.conf <<EOF
$DEPLOY_USER soft nofile 65535
$DEPLOY_USER hard nofile 65535
EOF

echo "  File descriptor limits set to 65535."

# ─── Restart SSH ───
echo ""
echo "=========================================="
echo " Hardening complete!"
echo "=========================================="
echo ""
echo " IMPORTANT: Before disconnecting, verify SSH access:"
echo "   ssh -p $SSH_PORT $DEPLOY_USER@<server-ip>"
echo ""
echo " Restarting SSH service..."
systemctl restart sshd

echo " Done. SSH is now on port $SSH_PORT."
