#!/usr/bin/env bash
# Creates the Always Free VM for UPG Monitor from OCI Cloud Shell (console, top bar,
# ">_" icon), where the OCI CLI is already configured.
#
#   curl -fsSL https://raw.githubusercontent.com/mnavarrosqa/upgsuptime/main/deploy/oracle/create-instance.sh -o create-instance.sh
#   bash create-instance.sh ssh-key.key.pub                  # Ampere A1 (ARM), the better VM
#   TYPE=micro bash create-instance.sh ssh-key.key.pub       # AMD E2.1.Micro, almost always in stock
#
# TYPE=a1 (default): VM.Standard.A1.Flex, 1 OCPU / 4 GB. Often "Out of capacity", so the
#   script keeps retrying until Oracle has room.
# TYPE=micro: VM.Standard.E2.1.Micro, 1/8 OCPU (bursts higher) / 1 GB. Usually created at
#   once. Enough to run the app; builds are slow and lean on swap (install.sh adds it).
#   Always Free allows two of these.
#
# The argument is the PUBLIC key you downloaded when you first tried to create the
# instance (upload it to Cloud Shell with the gear menu → Upload). With no argument a
# new key pair is generated in ~/.ssh/upgsuptime and you download its private half.
#
# Gentle on the API: one launch request every RETRY_SECONDS (+ random jitter), and on
# "429 TooManyRequests" the wait doubles each time, up to 15 minutes.
#
# Optional env: OCPUS (A1 only, default 1), MEMORY_GB (A1 only, default 4),
# RETRY_SECONDS (default 90), DISPLAY_NAME (default upgsuptime / upgsuptime-micro),
# COMPARTMENT_ID, AD, SUBNET_ID, IMAGE_ID.
set -euo pipefail

TYPE="${TYPE:-a1}"
OCPUS="${OCPUS:-1}"
MEMORY_GB="${MEMORY_GB:-4}"
RETRY_SECONDS="${RETRY_SECONDS:-90}"
MAX_BACKOFF_SECONDS=900
case "$TYPE" in
  a1)
    SHAPE=VM.Standard.A1.Flex
    SHAPE_ARGS=(--shape-config "{\"ocpus\": $OCPUS, \"memoryInGBs\": $MEMORY_GB}")
    SHAPE_DESC="$SHAPE ($OCPUS OCPU, $MEMORY_GB GB)"
    DISPLAY_NAME="${DISPLAY_NAME:-upgsuptime}"
    ;;
  micro)
    SHAPE=VM.Standard.E2.1.Micro
    SHAPE_ARGS=()
    SHAPE_DESC="$SHAPE (1/8 OCPU, 1 GB)"
    DISPLAY_NAME="${DISPLAY_NAME:-upgsuptime-micro}"
    ;;
  *) echo "TYPE must be a1 or micro"; exit 1 ;;
esac

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

# ── Discover what we need ────────────────────────────────────────────────────
COMPARTMENT_ID="${COMPARTMENT_ID:-${OCI_TENANCY:-$(awk -F= '/^tenancy/{gsub(/ /,"",$2); print $2; exit}' ~/.oci/config 2>/dev/null)}}"
[ -n "$COMPARTMENT_ID" ] || { echo "Could not find your tenancy OCID; set COMPARTMENT_ID."; exit 1; }

# First availability domain that offers the shape (the micro lives in only one of them).
if [ -z "${AD:-}" ]; then
  for ad in $(oci iam availability-domain list --compartment-id "$COMPARTMENT_ID" --query 'data[].name' --raw-output | tr -d '[]",'); do
    if oci compute shape list --compartment-id "$COMPARTMENT_ID" --availability-domain "$ad" --all \
        --query "data[?shape=='$SHAPE'] | [0].shape" --raw-output 2>/dev/null | grep -q "$SHAPE"; then
      AD="$ad"; break
    fi
  done
fi
[ -n "${AD:-}" ] || { echo "No availability domain offers $SHAPE in this region; set AD."; exit 1; }

SUBNET_ID="${SUBNET_ID:-$(oci network subnet list --compartment-id "$COMPARTMENT_ID" \
  --query 'data[?"prohibit-public-ip-on-vnic" == `false`] | [0].id' --raw-output)}"
if [ -z "$SUBNET_ID" ] || [ "$SUBNET_ID" = "null" ]; then
  echo "No public subnet found. Create one: Networking → Virtual cloud networks → Start VCN Wizard"
  echo "→ 'Create VCN with Internet Connectivity', then run this again."
  exit 1
fi

IMAGE_ID="${IMAGE_ID:-$(oci compute image list --compartment-id "$COMPARTMENT_ID" \
  --operating-system "Canonical Ubuntu" --operating-system-version "24.04" --shape "$SHAPE" \
  --sort-by TIMECREATED --sort-order DESC --all \
  --query 'data[?!contains("display-name", `Minimal`)] | [0].id' --raw-output)}"
[ -n "$IMAGE_ID" ] && [ "$IMAGE_ID" != "null" ] || { echo "Ubuntu 24.04 image for $SHAPE not found; set IMAGE_ID."; exit 1; }

echo "Availability domain: $AD"
echo "Subnet:              $SUBNET_ID"
echo "Image:               $IMAGE_ID"
echo "Shape:               $SHAPE_DESC"
echo

# ── Already there? ───────────────────────────────────────────────────────────
EXISTING="$(oci compute instance list --compartment-id "$COMPARTMENT_ID" --display-name "$DISPLAY_NAME" \
  --query 'data[?"lifecycle-state" != `TERMINATED`] | [0].id' --raw-output 2>/dev/null || true)"
if [ -n "$EXISTING" ] && [ "$EXISTING" != "null" ]; then
  echo "An instance named '$DISPLAY_NAME' already exists: $EXISTING"
  INSTANCE_ID="$EXISTING"
else
  # ── Retry until created ──────────────────────────────────────────────────
  attempt=0
  backoff=0
  while :; do
    attempt=$((attempt + 1))
    printf '[%s] Attempt %d… ' "$(date +%H:%M:%S)" "$attempt"
    if OUT="$(oci --no-retry compute instance launch \
          --compartment-id "$COMPARTMENT_ID" \
          --availability-domain "$AD" \
          --display-name "$DISPLAY_NAME" \
          --shape "$SHAPE" \
          ${SHAPE_ARGS[@]+"${SHAPE_ARGS[@]}"} \
          --image-id "$IMAGE_ID" \
          --subnet-id "$SUBNET_ID" \
          --assign-public-ip true \
          --ssh-authorized-keys-file "$PUBKEY" \
          --query 'data.id' --raw-output 2>&1)"; then
      INSTANCE_ID="$OUT"
      echo "created!"
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
