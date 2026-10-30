#!/usr/bin/env bash
# Keeps trying to create the Always Free Ampere A1 VM until Oracle has capacity
# ("Out of capacity for shape VM.Standard.A1.Flex" is common in busy regions).
#
# Easiest: run it in OCI Cloud Shell (console, top bar, ">_" icon), where the OCI CLI
# is already configured:
#
#   curl -fsSL https://raw.githubusercontent.com/mnavarrosqa/upgsuptime/main/deploy/oracle/create-a1-instance.sh -o create-a1-instance.sh
#   bash create-a1-instance.sh ssh-key.key.pub
#
# The argument is the PUBLIC key you downloaded when you first tried to create the
# instance (upload it to Cloud Shell with the gear menu → Upload). With no argument a
# new key pair is generated in ~/.ssh/upgsuptime and you download its private half.
#
# Optional env: OCPUS (default 1), MEMORY_GB (default 4), RETRY_SECONDS (default 60),
# DISPLAY_NAME (default upgsuptime), COMPARTMENT_ID, SUBNET_ID, IMAGE_ID.
set -euo pipefail

OCPUS="${OCPUS:-1}"
MEMORY_GB="${MEMORY_GB:-4}"
RETRY_SECONDS="${RETRY_SECONDS:-60}"
DISPLAY_NAME="${DISPLAY_NAME:-upgsuptime}"
SHAPE=VM.Standard.A1.Flex

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

AD="$(oci iam availability-domain list --compartment-id "$COMPARTMENT_ID" --query 'data[0].name' --raw-output)"

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
echo "Shape:               $SHAPE ($OCPUS OCPU, $MEMORY_GB GB)"
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
  while :; do
    attempt=$((attempt + 1))
    printf '[%s] Attempt %d… ' "$(date +%H:%M:%S)" "$attempt"
    if OUT="$(oci compute instance launch \
          --compartment-id "$COMPARTMENT_ID" \
          --availability-domain "$AD" \
          --display-name "$DISPLAY_NAME" \
          --shape "$SHAPE" \
          --shape-config "{\"ocpus\": $OCPUS, \"memoryInGBs\": $MEMORY_GB}" \
          --image-id "$IMAGE_ID" \
          --subnet-id "$SUBNET_ID" \
          --assign-public-ip true \
          --ssh-authorized-keys-file "$PUBKEY" \
          --query 'data.id' --raw-output 2>&1)"; then
      INSTANCE_ID="$OUT"
      echo "created!"
      break
    fi
    if grep -qiE "out of (host )?capacity" <<<"$OUT"; then
      echo "no capacity yet, retrying in ${RETRY_SECONDS}s"
      sleep "$RETRY_SECONDS"
    elif grep -qiE "TooManyRequests|429" <<<"$OUT"; then
      echo "rate limited, waiting $((RETRY_SECONDS * 3))s"
      sleep $((RETRY_SECONDS * 3))
    else
      echo "failed:"
      echo "$OUT"
      echo
      echo "This is not a capacity problem; fix it before retrying (e.g. LimitExceeded means"
      echo "you already use your Always Free A1 allowance)."
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
