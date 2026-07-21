#!/usr/bin/env bash
# VenInspect — Proxmox VE Helper-style installer (host shell + whiptail GUI)
#
# Run on the Proxmox HOST (not inside a CT):
#
#   GitHub (live):
#     bash -c "$(curl -fsSL https://raw.githubusercontent.com/McKrackenAU/VenInspect/main/ct/veninspect.sh)"
#
#   Gitea (LAN / dev):
#     bash -c "$(curl -fsSL http://192.168.13.9:3000/McKraken/VenInspect/raw/branch/main/ct/veninspect.sh)"
#
# Creates an unprivileged Debian LXC, then installs VenInspect inside it.
set -euo pipefail

APP="VenInspect"
APP_PORT="8181"
# Default clone sources (overridable in GUI)
REPO_GITHUB="https://github.com/McKrackenAU/VenInspect.git"
REPO_GITEA="http://192.168.13.9:3000/McKraken/VenInspect.git"
RAW_GITHUB="https://raw.githubusercontent.com/McKrackenAU/VenInspect/main"
RAW_GITEA="http://192.168.13.9:3000/McKraken/VenInspect/raw/branch/main"

# Defaults (helper-scripts style)
CTID=""
HN="veninspect"
CPU="2"
RAM="2048"
DISK="12"
BRIDGE="vmbr0"
STORAGE=""
NET="dhcp"
IP_CIDR=""
GW=""
REPO_URL="$REPO_GITEA"
PHOTO_SEPARATE="0"
PHOTO_MP=""

# Colors
YW=$'\033[33m'
BL=$'\033[36m'
GN=$'\033[1;92m'
RD=$'\033[01;31m'
CL=$'\033[m'
BOLD=$'\033[1m'

msg_info() { echo -e "${BL}${BOLD}ℹ ${CL}${YW}$1${CL}"; }
msg_ok() { echo -e "${GN}${BOLD}✔ ${CL}$1"; }
msg_error() { echo -e "${RD}${BOLD}✖ ${CL}$1"; }

header_info() {
  clear
  cat <<"EOF"
 __     __          ___                           _
 \ \   / /__ _ __  |_ _|_ __  ___ _ __   ___  ___| |_
  \ \ / / _ \ '_ \  | || '_ \/ __| '_ \ / _ \/ __| __|
   \ V /  __/ | | | | || | | \__ \ |_) |  __/ (__| |_
    \_/ \___|_| |_|___|_| |_|___/ .__/ \___|\___|\__|
                                |_|
EOF
  echo -e "${BOLD}${APP}${CL} — Proxmox LXC installer (helper-scripts style)\n"
}

need_root() {
  if [[ "$(id -u)" -ne 0 ]]; then
    msg_error "Run this on the Proxmox host as root."
    exit 1
  fi
}

need_proxmox() {
  if ! command -v pveversion >/dev/null 2>&1 || ! command -v pct >/dev/null 2>&1; then
    msg_error "Proxmox VE tools not found (pveversion / pct). Run on the PVE host shell."
    exit 1
  fi
}

need_whiptail() {
  if ! command -v whiptail >/dev/null 2>&1; then
    msg_info "Installing whiptail…"
    apt-get update -qq
    apt-get install -y -qq whiptail >/dev/null
  fi
}

next_ctid() {
  local id=100
  while pct status "$id" &>/dev/null; do
    id=$((id + 1))
  done
  echo "$id"
}

pick_storage() {
  # List storages that support containers / images
  local list=()
  while IFS= read -r line; do
    [[ -z "$line" ]] && continue
    list+=("$line" "")
  done < <(pvesm status -content rootdir 2>/dev/null | awk 'NR>1 {print $1}')
  if [[ ${#list[@]} -eq 0 ]]; then
    while IFS= read -r line; do
      [[ -z "$line" ]] && continue
      list+=("$line" "")
    done < <(pvesm status 2>/dev/null | awk 'NR>1 {print $1}')
  fi
  if [[ ${#list[@]} -eq 0 ]]; then
    msg_error "No Proxmox storage found."
    exit 1
  fi
  STORAGE=$(whiptail --backtitle "$APP" --title "Storage" \
    --menu "Select storage for the CT root disk:" 18 60 10 \
    "${list[@]}" 3>&1 1>&2 2>&3) || exit 1
}

gui_settings() {
  if ! whiptail --backtitle "$APP" --title "$APP LXC" \
    --yesno "Create a new unprivileged Debian LXC and install ${APP}?\n\nThis runs on the Proxmox host and uses a whiptail menu (like community helper scripts)." 12 70; then
    echo "Cancelled."
    exit 0
  fi

  CTID=$(whiptail --backtitle "$APP" --title "Container ID" \
    --inputbox "LXC Container ID:" 8 50 "$(next_ctid)" 3>&1 1>&2 2>&3) || exit 1
  HN=$(whiptail --backtitle "$APP" --title "Hostname" \
    --inputbox "Hostname:" 8 50 "$HN" 3>&1 1>&2 2>&3) || exit 1
  CPU=$(whiptail --backtitle "$APP" --title "CPU" \
    --inputbox "CPU cores:" 8 50 "$CPU" 3>&1 1>&2 2>&3) || exit 1
  RAM=$(whiptail --backtitle "$APP" --title "RAM" \
    --inputbox "RAM (MiB):" 8 50 "$RAM" 3>&1 1>&2 2>&3) || exit 1
  DISK=$(whiptail --backtitle "$APP" --title "Disk" \
    --inputbox "Root disk size (GiB) — keep small; photos can use a separate mount:" 10 60 "$DISK" 3>&1 1>&2 2>&3) || exit 1

  pick_storage

  BRIDGE=$(whiptail --backtitle "$APP" --title "Bridge" \
    --inputbox "Network bridge:" 8 50 "$BRIDGE" 3>&1 1>&2 2>&3) || exit 1

  NET=$(whiptail --backtitle "$APP" --title "IP configuration" \
    --menu "Network mode:" 14 60 4 \
    "dhcp" "DHCP (simple)" \
    "static" "Static IPv4" 3>&1 1>&2 2>&3) || exit 1

  if [[ "$NET" == "static" ]]; then
    IP_CIDR=$(whiptail --backtitle "$APP" --title "Static IP" \
      --inputbox "IPv4 CIDR (e.g. 192.168.1.50/24):" 8 60 3>&1 1>&2 2>&3) || exit 1
    GW=$(whiptail --backtitle "$APP" --title "Gateway" \
      --inputbox "Gateway IP:" 8 50 3>&1 1>&2 2>&3) || exit 1
  fi

  local src
  src=$(whiptail --backtitle "$APP" --title "Git source" \
    --menu "Where should the CT clone VenInspect from?" 15 72 4 \
    "gitea" "Gitea LAN — $REPO_GITEA" \
    "github" "GitHub live — $REPO_GITHUB" \
    "custom" "Enter a custom git URL" 3>&1 1>&2 2>&3) || exit 1

  case "$src" in
    gitea) REPO_URL="$REPO_GITEA"; RAW_BASE="$RAW_GITEA" ;;
    github) REPO_URL="$REPO_GITHUB"; RAW_BASE="$RAW_GITHUB" ;;
    custom)
      REPO_URL=$(whiptail --backtitle "$APP" --title "Custom git URL" \
        --inputbox "Git clone URL:" 8 72 "$REPO_GITHUB" 3>&1 1>&2 2>&3) || exit 1
      RAW_BASE="$RAW_GITHUB"
      ;;
  esac

  if whiptail --backtitle "$APP" --title "Photo storage" \
    --yesno "Use a SEPARATE host path for photos (large disk)?\n\nYes = bind-mount a host folder to /mnt/veninspect-photos\nNo  = photos under /var/lib/veninspect/photos on the CT disk" 14 70; then
    PHOTO_SEPARATE="1"
    PHOTO_MP=$(whiptail --backtitle "$APP" --title "Photo host path" \
      --inputbox "Host directory to bind-mount (will be created if missing):" 10 70 \
      "/tank/veninspect-photos" 3>&1 1>&2 2>&3) || exit 1
  fi

  local summary
  summary=$(
    cat <<EOF
CTID:       $CTID
Hostname:   $HN
CPU / RAM:  ${CPU} / ${RAM} MiB
Disk:       ${DISK}G on $STORAGE
Bridge:     $BRIDGE
Network:    $NET ${IP_CIDR:-} ${GW:+gw $GW}
Git:        $REPO_URL
Photos:     $([[ "$PHOTO_SEPARATE" == "1" ]] && echo "separate → $PHOTO_MP" || echo "default on DATA_DIR")
EOF
  )
  whiptail --backtitle "$APP" --title "Confirm" --yesno "Create container with these settings?\n\n$summary" 20 72 || exit 0
}

ensure_template() {
  local tmpl_storage="local"
  # Prefer storage that holds templates
  if pvesm status -content vztmpl 2>/dev/null | awk 'NR>1 {print $1}' | grep -qx local; then
    tmpl_storage="local"
  else
    tmpl_storage=$(pvesm status -content vztmpl 2>/dev/null | awk 'NR>1 {print $1; exit}')
    tmpl_storage="${tmpl_storage:-local}"
  fi

  msg_info "Ensuring Debian 12 template is available on ${tmpl_storage}…"
  if ! pveam list "$tmpl_storage" 2>/dev/null | grep -q "debian-12-standard"; then
    pveam update >/dev/null || true
    local vol
    vol=$(pveam available -section system 2>/dev/null | awk '/debian-12-standard/ {print $2; exit}')
    if [[ -z "${vol:-}" ]]; then
      msg_error "Could not find debian-12-standard template. Download one in Datacenter → Storage → Templates."
      exit 1
    fi
    msg_info "Downloading $vol (this can take a while)…"
    pveam download "$tmpl_storage" "$vol"
  fi
  TEMPLATE=$(pveam list "$tmpl_storage" 2>/dev/null | awk '/debian-12-standard/ {print $1; exit}')
  if [[ -z "${TEMPLATE:-}" ]]; then
    msg_error "Debian 12 template still not found after download."
    exit 1
  fi
  msg_ok "Template: $TEMPLATE"
}

create_container() {
  if pct status "$CTID" &>/dev/null; then
    msg_error "CT $CTID already exists."
    exit 1
  fi

  local net_arg
  if [[ "$NET" == "static" ]]; then
    net_arg="name=eth0,bridge=${BRIDGE},ip=${IP_CIDR},gw=${GW}"
  else
    net_arg="name=eth0,bridge=${BRIDGE},ip=dhcp"
  fi

  msg_info "Creating CT ${CTID} (${HN})…"
  pct create "$CTID" "$TEMPLATE" \
    --hostname "$HN" \
    --cores "$CPU" \
    --memory "$RAM" \
    --swap 512 \
    --rootfs "${STORAGE}:${DISK}" \
    --net0 "$net_arg" \
    --unprivileged 1 \
    --features nesting=1 \
    --onboot 1 \
    --start 0

  # Separate photos mount (host path → CT). Ownership is fixed on the HOST after install.
  if [[ "$PHOTO_SEPARATE" == "1" ]]; then
    mkdir -p "$PHOTO_MP"
    echo "mp0: ${PHOTO_MP},mp=/mnt/veninspect-photos" >>"/etc/pve/lxc/${CTID}.conf"
    msg_ok "Bound-mounted photos: ${PHOTO_MP} → /mnt/veninspect-photos"
  fi

  pct start "$CTID"
  msg_ok "CT ${CTID} started"
}

wait_for_network() {
  msg_info "Waiting for network inside CT…"
  local i
  for i in $(seq 1 60); do
    if pct exec "$CTID" -- bash -c "ping -c1 -W1 1.1.1.1 >/dev/null 2>&1 || ping -c1 -W1 8.8.8.8 >/dev/null 2>&1 || getent hosts debian.org >/dev/null 2>&1"; then
      msg_ok "Network is up"
      return 0
    fi
    sleep 2
  done
  msg_error "Network did not come up in time. Check bridge/DHCP, then re-run install inside the CT."
  exit 1
}

install_inside() {
  msg_info "Installing ${APP} inside CT ${CTID} (Node build — several minutes)…"
  pct exec "$CTID" -- bash -c "apt-get update -qq && DEBIAN_FRONTEND=noninteractive apt-get install -y -qq git ca-certificates curl >/dev/null"

  pct exec "$CTID" -- bash -c "rm -rf /tmp/VenInspect && git clone --depth 1 '${REPO_URL}' /tmp/VenInspect"

  # Never chown bind mounts from inside an unprivileged CT (Operation not permitted).
  if [[ "$PHOTO_SEPARATE" == "1" ]]; then
    pct exec "$CTID" -- mkdir -p /mnt/veninspect-photos /var/lib/veninspect
    pct exec "$CTID" -- bash -c 'cd /tmp/VenInspect && PHOTO_DIR=/mnt/veninspect-photos bash deploy/install-lxc.sh "'"${REPO_URL}"'"'
    fix_photo_mount_ownership
    msg_ok "PHOTO_DIR set to /mnt/veninspect-photos"
  else
    pct exec "$CTID" -- bash -c "cd /tmp/VenInspect && bash deploy/install-lxc.sh '${REPO_URL}'"
  fi

  msg_ok "${APP} installed"
}

# Map host photo directory ownership to the CT's veninspect UID (unprivileged idmap).
fix_photo_mount_ownership() {
  [[ "$PHOTO_SEPARATE" == "1" ]] || return 0
  mkdir -p "$PHOTO_MP"

  local ct_uid ct_gid host_uid host_gid
  ct_uid=$(pct exec "$CTID" -- id -u veninspect 2>/dev/null || echo 0)
  ct_gid=$(pct exec "$CTID" -- id -g veninspect 2>/dev/null || echo 0)

  # Default Proxmox unprivileged mapping: CT uid N → host (100000 + N)
  host_uid=$((100000 + ct_uid))
  host_gid=$((100000 + ct_gid))

  if chown -R "${host_uid}:${host_gid}" "$PHOTO_MP" 2>/dev/null; then
    chmod -R u+rwX,g+rwX "$PHOTO_MP" 2>/dev/null || true
    msg_ok "Host photo path ownership mapped for CT user (uid ${host_uid})"
  else
    msg_info "Could not chown ${PHOTO_MP} on host — trying world-writable fallback"
    chmod -R a+rwX "$PHOTO_MP" 2>/dev/null || true
  fi

  # Ensure env + restart (install-lxc already wrote PHOTO_DIR when PHOTO_DIR was set)
  pct exec "$CTID" -- bash -c '
    set -e
    touch /etc/veninspect.env
    if grep -q "^PHOTO_DIR=" /etc/veninspect.env; then
      sed -i "s|^PHOTO_DIR=.*|PHOTO_DIR=/mnt/veninspect-photos|" /etc/veninspect.env
    else
      echo "PHOTO_DIR=/mnt/veninspect-photos" >> /etc/veninspect.env
    fi
    systemctl restart veninspect
  '
}

show_done() {
  local ip
  ip=$(pct exec "$CTID" -- bash -c "hostname -I 2>/dev/null | awk '{print \$1}'" 2>/dev/null || true)
  ip="${ip:-<ct-ip>}"

  echo
  msg_ok "Completed successfully!"
  echo -e "${BOLD}${APP}${CL} is running in CT ${BOLD}${CTID}${CL} (${HN})"
  echo -e "  Login:      ${GN}http://${ip}:${APP_PORT}/login${CL}"
  echo -e "  User:        ${BOLD}root${CL} / ${BOLD}calvin${CL}"
  echo -e "  Field app:   ${GN}http://${ip}:${APP_PORT}/${CL}"
  echo -e "  Manage:      ${GN}http://${ip}:${APP_PORT}/manage${CL}"
  echo -e "  Status:      pct exec ${CTID} -- systemctl status veninspect"
  echo
  echo -e "Docs: docs/LXC-INSTALL.md in the repo"
  echo
}

# --- main ---
header_info
need_root
need_proxmox
need_whiptail
gui_settings
ensure_template
create_container
wait_for_network
install_inside
show_done
