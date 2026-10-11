#!/usr/bin/env bash
# Rebuild The Marked's animation frames from the vector rig and install them into assets/.
#
#   VEKTRA=/path/to/vektra  CVZ_BROWSER=/path/to/chrome-or-headless_shell  tools/art/the_marked/build.sh
#
# Needs Python 3.10+ with numpy, pillow and opencv-python-headless. VEKTRA is the vektra skill folder (its scripts/_cvlib.py is used
# only to rasterise the rest-pose textures through headless Chromium).
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
REPO="$(cd "$HERE/../../.." && pwd)"
WORK="${WORK:-$(mktemp -d)}"
PY="${PY:-python3}"
export VEKTRA="${VEKTRA:?set VEKTRA to the vektra skill folder}"
cd "$HERE"
$PY skinparts.py "$WORK/tex"                       # rest-pose textures, one per skinned or rigid object
$PY gait.py walk "$WORK/clips"; $PY gait.py run "$WORK/clips"
$PY poses.py "$WORK/clips"
for clip in walk run idle basic_attack hit_react death_collapse dodge_step interact_pickup ritual_channel low_sanity signal_decode; do
  $PY skin.py "$WORK/clips/$clip.clip.json" "$WORK/tex" "$WORK/anim/$clip"
done
$PY export_marked.py "$WORK/anim" "$REPO"
