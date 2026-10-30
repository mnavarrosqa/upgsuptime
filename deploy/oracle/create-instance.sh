#!/usr/bin/env bash
# Creates the Always Free VM for UPG Monitor from OCI Cloud Shell (console, top bar,
# ">_" icon), where the OCI CLI is already configured.
#
#   curl -fsSL https://raw.githubusercontent.com/mnavarrosqa/upgsuptime/main/deploy/oracle/create-instance.sh -o create-instance.sh
#   bash create-instance.sh ssh-key.key.pub                  # Ampere A1 (ARM), the better VM
#   TYPE=micro bash create-instance.sh ssh-key.key.pub       # AMD E2.1.Micro, usually in stock
#   TYPE=any bash create-instance.sh ssh-key.key.pub         # alternate both, keep the first that fits
#
# TYPE=a1 (default): VM.Standard.A1.Flex, 1 OCPU / 4 GB. Often "Out of capacity", so the
#   script keeps retrying until Oracle has room.
# TYPE=micro: VM.Standard.E2.1.Micro, 1/8 OCPU (bursts higher) / 1 GB. Usually created at
#   once. Enough to run the app; builds are slow and lean on swap (install.sh adds it).
#   Always Free allows two of these.
# TYPE=any: alternates A1 and micro attempts (same request rate) and stops at the first
#   one created.
#
# To keep it running for hours, run it on any always-on Linux box with the OCI CLI
# configured (`oci setup config`), e.g. inside tmux or with nohup; Cloud Shell closes
# after ~20 minutes without keyboard input.
#
# The argument is the PUBLIC key you downloaded when you first tried to create the
# instance (upload it to Cloud Shell with the gear menu → Upload). With no argument a
# new key pair is generated in ~/.ssh/upgsuptime and you download its private half.
#
# Gentle on the API: one launch request every RETRY_SECONDS (+ random jitter), and on
# "429 TooManyRequests" the wait doubles each time, up to 15 minutes.
#
# Optional env: OCPUS (A1 only, default 1), MEMORY_GB (A1 only, default 4),
# RETRY_SECONDS (default 90), COMPARTMENT_ID, SUBNET_ID. Instances are named
# upgsuptime (A1) and upgsuptime-micro.
#
# It refuses to create anything that would go over the Always Free limits (A1: 2 OCPU /
# 12 GB in total; two E2.1.Micro; 200 GB of boot + block volumes), since a Pay As You
# Go account is billed for the excess. Only instances in the root compartment count.
set -euo pipefail

TYPE="${TYPE:-a1}"
OCPUS="${OCPUS:-1}"
MEMORY_GB="${MEMORY_GB:-4}"
RETRY_SECONDS="${RETRY_SECONDS:-90}"
MAX_BACKOFF_SECONDS=900
case "$TYPE" in
  a1|micro) TYPES=("$TYPE") ;;
  any) TYPES=(a1 micro) ;;
  *) echo "TYPE must be a1, micro or any"; exit 1 ;;
esac

# Sets SHAPE, SHAPE_ARGS, SHAPE_DESC and DISPLAY_NAME for one type.
use_type() {
  case "$1" in
    a1)
      SHAPE=VM.Standard.A1.Flex
      SHAPE_ARGS=(--shape-config "{\"ocpus\": $OCPUS, \"memoryInGBs\": $MEMORY_GB}")
      SHAPE_DESC="$SHAPE ($OCPUS OCPU, $MEMORY_GB GB)"
      DISPLAY_NAME=upgsuptime
      ;;
    micro)
      SHAPE=VM.Standard.E2.1.Micro
      SHAPE_ARGS=()
      SHAPE_DESC="$SHAPE (1/8 OCPU, 1 GB)"
      DISPLAY_NAME=upgsuptime-micro
      ;;
  esac
}

command -v oci >/dev/null || { echo "OCI CLI not found. Run this in OCI Cloud Shell."; exit 1; }

# ── SSH key ──────────────────────────────────────────────────────────────────
PUBKEY="${1:-}"
if [ -z "$PUBKEY" ]; then
  mkdir -p ~/.ssh
  if [ ! -f ~/.ssh/upgsuptime ]; then
    ssh-keygen -t ed25519 -N "" -f ~/.ssh/upgsuptime -C upgsuptime >/dev/null
    echo "Generated a new SSH key. Download ~/.ssh/upgsuptime (gear menu → Download) and keep it safe."
  fi
  PUBKEY=~/.ssh/upgsuptime.pub
fi
[ -f "$PUBKEY" ] || { echo "Public key file not found: $PUBKEY"; exit 1; }
grep -q "PRIVATE KEY" "$PUBKEY" && { echo "$PUBKEY is a PRIVATE key. Pass the .pub file."; exit 1; }
# A key pasted into an editor often gets split across lines or cut short; Oracle then
# answers "Invalid format for ssh public key" only after the first launch request.
if [ "$(grep -c . "$PUBKEY")" -ne 1 ] \
  || ! grep -qE '^(ssh-(rsa|ed25519|dss)|ecdsa-sha2-[a-z0-9-]+) [A-Za-z0-9+/]+=* ?.*$' "$PUBKEY" \
  || { command -v ssh-keygen >/dev/null && ! ssh-keygen -l -f "$PUBKEY" >/dev/null 2>&1; }; then
  echo "$PUBKEY is not a valid SSH public key: it must be ONE line like 'ssh-rsa AAAA… name'."
  echo "If you pasted it, it probably got split or cut. Recreate it from the private key with"
  echo "  ssh-keygen -y -f <private-key-file> > $PUBKEY"
  exit 1
fi

# ── Discover what we need ────────────────────────────────────────────────────
COMPARTMENT_ID="${COMPARTMENT_ID:-${OCI_TENANCY:-$(awk -F= '/^tenancy/{gsub(/ /,"",$2); print $2; exit}' ~/.oci/config 2>/dev/null)}}"
[ -n "$COMPARTMENT_ID" ] || { echo "Could not find your tenancy OCID; set COMPARTMENT_ID."; exit 1; }

SUBNET_ID="${SUBNET_ID:-$(oci network subnet list --compartment-id "$COMPARTMENT_ID" \
  --query 'data[?"prohibit-public-ip-on-vnic" == `false`] | [0].id' --raw-output)}"
if [ -z "$SUBNET_ID" ] || [ "$SUBNET_ID" = "null" ]; then
  echo "No public subnet found. Create one: Networking → Virtual cloud networks → Start VCN Wizard"
  echo "→ 'Create VCN with Internet Connectivity', then run this again."
  exit 1
fi
echo "Subnet: $SUBNET_ID"

ADS="$(oci iam availability-domain list --compartment-id "$COMPARTMENT_ID" --query 'data[].name' --raw-output | tr -d '[]",')"

# Per type: the first availability domain that offers the shape (the micro lives in
# only one of them) and the newest Ubuntu 24.04 image built for it (ARM vs x86).
declare -A AD_OF IMAGE_OF
resolve_type() {
  use_type "$1"
  local ad image
  for ad in $ADS; do
    if oci compute shape list --compartment-id "$COMPARTMENT_ID" --availability-domain "$ad" --all \
        --query "data[?shape=='$SHAPE'] | [0].shape" --raw-output 2>/dev/null | grep -q "$SHAPE"; then
      AD_OF[$1]="$ad"; break
    fi
  done
  [ -n "${AD_OF[$1]:-}" ] || { echo "No availability domain offers $SHAPE in this region."; exit 1; }
  image="$(oci compute image list --compartment-id "$COMPARTMENT_ID" \
    --operating-system "Canonical Ubuntu" --operating-system-version "24.04" --shape "$SHAPE" \
    --sort-by TIMECREATED --sort-order DESC --all \
    --query 'data[?!contains("display-name", `Minimal`)] | [0].id' --raw-output)"
  [ -n "$image" ] && [ "$image" != "null" ] || { echo "Ubuntu 24.04 image for $SHAPE not found."; exit 1; }
  IMAGE_OF[$1]="$image"
  echo "$SHAPE_DESC → ${AD_OF[$1]}, image $image"
}

# ── Stay inside Always Free ──────────────────────────────────────────────────
# On a Pay As You Go account Oracle bills whatever goes over these, so refuse to
# create an instance that would. Override only if Oracle changes the limits.
FREE_A1_OCPUS="${FREE_A1_OCPUS:-2}"
FREE_A1_MEMORY_GB="${FREE_A1_MEMORY_GB:-12}"
FREE_MICRO_COUNT="${FREE_MICRO_COUNT:-2}"
FREE_STORAGE_GB="${FREE_STORAGE_GB:-200}"
NEW_BOOT_GB=50   # the default boot volume is ~47 GB; count it as 50

sum() { tr -d '[] \n' | tr ',' '\n' | awk '{s+=$1} END {print s+0}'; }

check_free_tier() {  # $1: a1 or micro
  local live='"lifecycle-state" != `TERMINATED`'
  if [ "$1" = a1 ]; then
    local used_ocpus used_mem
    used_ocpus="$(oci compute instance list --compartment-id "$COMPARTMENT_ID" --all \
      --query "data[?shape == '$SHAPE' && $live].\"shape-config\".ocpus" --raw-output | sum)"
    used_mem="$(oci compute instance list --compartment-id "$COMPARTMENT_ID" --all \
      --query "data[?shape == '$SHAPE' && $live].\"shape-config\".\"memory-in-gbs\"" --raw-output | sum)"
    echo "Always Free A1 in use: $used_ocpus/$FREE_A1_OCPUS OCPU, $used_mem/$FREE_A1_MEMORY_GB GB"
    if awk -v u="$used_ocpus" -v n="$OCPUS" -v f="$FREE_A1_OCPUS" 'BEGIN{exit !(u+n>f)}' \
      || awk -v u="$used_mem" -v n="$MEMORY_GB" -v f="$FREE_A1_MEMORY_GB" 'BEGIN{exit !(u+n>f)}'; then
      echo "Refusing: $OCPUS OCPU / $MEMORY_GB GB more would go over the Always Free A1 allowance (and be billed)."
      exit 1
    fi
  else
    local micros
    micros="$(oci compute instance list --compartment-id "$COMPARTMENT_ID" --all \
      --query "length(data[?shape == '$SHAPE' && $live])" --raw-output)"
    micros="${micros:-0}"
    echo "Always Free micro VMs in use: $micros/$FREE_MICRO_COUNT"
    if [ "$micros" -ge "$FREE_MICRO_COUNT" ]; then
      echo "Refusing: a third E2.1.Micro is not Always Free (it would be billed)."
      exit 1
    fi
  fi

  # Boot and block volumes share 200 GB in total.
  local storage=0 ad gb
  for ad in $(oci iam availability-domain list --compartment-id "$COMPARTMENT_ID" --query 'data[].name' --raw-output | tr -d '[]",'); do
    gb="$(oci bv boot-volume list --compartment-id "$COMPARTMENT_ID" --availability-domain "$ad" --all \
      --query "data[?$live].\"size-in-gbs\"" --raw-output | sum)"
    storage=$((storage + gb))
  done
  gb="$(oci bv volume list --compartment-id "$COMPARTMENT_ID" --all \
    --query "data[?$live].\"size-in-gbs\"" --raw-output | sum)"
  storage=$((storage + gb))
  echo "Always Free storage in use: $storage/$FREE_STORAGE_GB GB (+$NEW_BOOT_GB for this VM)"
  if [ $((storage + NEW_BOOT_GB)) -gt "$FREE_STORAGE_GB" ]; then
    echo "Refusing: another boot volume would go over the 200 GB of free storage (and be billed)."
    exit 1
  fi
}

# ── Already there? ───────────────────────────────────────────────────────────
INSTANCE_ID=""
for t in "${TYPES[@]}"; do
  use_type "$t"
  EXISTING="$(oci compute instance list --compartment-id "$COMPARTMENT_ID" --display-name "$DISPLAY_NAME" \
    --query 'data[?"lifecycle-state" != `TERMINATED`] | [0].id' --raw-output 2>/dev/null || true)"
  if [ -n "$EXISTING" ] && [ "$EXISTING" != "null" ]; then
    echo "An instance named '$DISPLAY_NAME' already exists: $EXISTING"
    INSTANCE_ID="$EXISTING"
    break
  fi
done

if [ -z "$INSTANCE_ID" ]; then
  for t in "${TYPES[@]}"; do
    use_type "$t"
    check_free_tier "$t"
    resolve_type "$t"
  done
  echo

  # ── Retry until created ──────────────────────────────────────────────────
  attempt=0
  backoff=0
  while :; do
    t="${TYPES[attempt % ${#TYPES[@]}]}"
    attempt=$((attempt + 1))
    use_type "$t"
    printf '[%s] Attempt %d (%s)… ' "$(date +%H:%M:%S)" "$attempt" "$t"
    if OUT="$(oci --no-retry compute instance launch \
          --compartment-id "$COMPARTMENT_ID" \
          --availability-domain "${AD_OF[$t]}" \
          --display-name "$DISPLAY_NAME" \
          --shape "$SHAPE" \
          ${SHAPE_ARGS[@]+"${SHAPE_ARGS[@]}"} \
          --image-id "${IMAGE_OF[$t]}" \
          --subnet-id "$SUBNET_ID" \
          --assign-public-ip true \
          --ssh-authorized-keys-file "$PUBKEY" \
          --query 'data.id' --raw-output 2>&1)"; then
      INSTANCE_ID="$OUT"
      echo "created $SHAPE_DESC!"
      break
    fi
    jitter=$((RANDOM % 20))
    if grep -qiE "TooManyRequests|\"status\": 429" <<<"$OUT"; then
      # Back off exponentially while the API keeps saying slow down.
      backoff=$(( backoff == 0 ? RETRY_SECONDS * 3 : backoff * 2 ))
      [ "$backoff" -gt "$MAX_BACKOFF_SECONDS" ] && backoff=$MAX_BACKOFF_SECONDS
      echo "rate limited, waiting $((backoff + jitter))s"
      sleep $((backoff + jitter))
    elif grep -qiE "out of (host )?capacity|InternalError" <<<"$OUT"; then
      backoff=0
      echo "no capacity yet, retrying in $((RETRY_SECONDS + jitter))s"
      sleep $((RETRY_SECONDS + jitter))
    else
      echo "failed:"
      echo "$OUT"
      echo
      echo "This is not a capacity problem; fix it before retrying (e.g. LimitExceeded means"
      echo "you already use your Always Free allowance for this shape)."
      exit 1
    fi
  done
fi

# ── Wait for it and show the public IP ───────────────────────────────────────
echo "Waiting for the instance to start…"
oci compute instance get --instance-id "$INSTANCE_ID" --wait-for-state RUNNING >/dev/null
IP="$(oci compute instance list-vnics --instance-id "$INSTANCE_ID" --query 'data[0]."public-ip"' --raw-output)"
echo
echo "Running. Public IP: $IP"
echo "Connect with:  ssh -i <your-private-key> ubuntu@$IP"
