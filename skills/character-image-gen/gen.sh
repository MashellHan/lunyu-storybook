#!/usr/bin/env bash
# Generate one image with GitHub Copilot CLI's image_generation tool.
# usage: gen.sh <prompt-file> <out.png> [attachment.png ...]
# Costs ~1 Copilot premium request per run. Never attach photos of real people/children.
set -euo pipefail
prompt_file=$1; out=$2; shift 2
C=$(command -v copilot || ls -d "$HOME"/Library/Caches/github-copilot-sdk/cli/*/copilot 2>/dev/null | sort -V | tail -1 || true)
[ -n "$C" ] || { echo "copilot CLI not found (install/login it yourself first)"; exit 1; }
mkdir -p "$(dirname "$out")"
work=$(mktemp -d); cp "$prompt_file" "$work/prompt.txt"
args=()
for a in "$@"; do cp "$a" "$work/"; args+=(--attachment "$work/$(basename "$a")"); done
cat >> "$work/prompt.txt" <<'TXT'

---
执行要求：必须实际调用图像生成工具（image_generation），把所有附件作为 input_images 传入；不要用代码、脚本或 SVG 画图，也不要用代码给原图改色。尽量原样使用上面的描述作为提示词，不要大幅改写。生成后保存为 ./out.png。完成后说明实际传给工具的参数。
TXT
cd "$work"
"$C" -p "$(cat prompt.txt)" "${args[@]}" --allow-all-tools --trust-folder --output-format json > run.jsonl
cd - >/dev/null
[ -f "$work/out.png" ] || { echo "no out.png; check ~/.copilot/session-state/*/images/ and $work/run.jsonl"; exit 1; }
cp "$work/out.png" "$out"; file "$out"
echo "log: $work/run.jsonl"
