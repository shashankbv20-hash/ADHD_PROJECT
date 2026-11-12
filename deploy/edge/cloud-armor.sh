#!/usr/bin/env bash
# Edge rate limiting for the Attune API on Google Cloud (Cloud Armor), shared by ALL instances.
#
# NOT RUN OR VERIFIED by the project: review every value, test in a staging project first, and
# adjust the numbers to real traffic. It needs a global external Application Load Balancer in front
# of the API (Cloud Armor attaches to the load balancer's backend service).
#
#   PROJECT=my-project BACKEND_SERVICE=attune-api-backend ./cloud-armor.sh
set -euo pipefail

: "${PROJECT:?set PROJECT}"
: "${BACKEND_SERVICE:?set BACKEND_SERVICE (the load balancer backend service for the API)}"
POLICY="${POLICY:-attune-api-edge}"

gcloud compute security-policies create "$POLICY" --project "$PROJECT" \
  --description "Attune API edge rate limiting"

# 1. Per client address: throttle to 300 requests/minute, then answer 429 for 5 more minutes.
gcloud compute security-policies rules create 1000 --project "$PROJECT" \
  --security-policy "$POLICY" \
  --expression "true" \
  --action throttle \
  --rate-limit-threshold-count 300 --rate-limit-threshold-interval-sec 60 \
  --conform-action allow --exceed-action deny-429 \
  --enforce-on-key IP

# 2. Much tighter limit on the most expensive writes (event batches and data erasure/export).
gcloud compute security-policies rules create 900 --project "$PROJECT" \
  --security-policy "$POLICY" \
  --expression "request.method == 'POST' && (request.path.contains('/events:batch') || request.path.contains('/data-erasure'))" \
  --action throttle \
  --rate-limit-threshold-count 60 --rate-limit-threshold-interval-sec 60 \
  --conform-action allow --exceed-action deny-429 \
  --enforce-on-key IP

# 3. Default rule (lowest priority) allows everything that was not throttled.
gcloud compute security-policies rules update 2147483647 --project "$PROJECT" \
  --security-policy "$POLICY" --action allow

gcloud compute backend-services update "$BACKEND_SERVICE" --global --project "$PROJECT" \
  --security-policy "$POLICY"

echo "Attached $POLICY to $BACKEND_SERVICE. Set TRUST_PROXY_HEADERS=true and FORWARDED_ALLOW_IPS to the"
echo "load balancer ranges on the API so the in-process limiter also sees real client addresses."
