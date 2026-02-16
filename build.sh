#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

mkdir -p dist .build

# Bundle local app ES modules
./bin/esbuild viewer/src/main.js --bundle --format=iife --outfile=.build/bundle.js

# Inline rule: replaces any tag with data-local="path" with its file contents.
INLINE_RULE='
match($0, /data-local="([^"]+)"/, m) {
	file = "viewer/" m[1]
	if (mode == "lite" && m[1] ~ /^vendor\//) {
		gsub(/ *data-local="[^"]*"/, "")
		print
		next
	}
	if ($0 ~ /<script/) {
		print "<script type=\"text/javascript\">"
		while ((getline line < file) > 0) print line
		close(file)
		print "</script>"
	} else if ($0 ~ /<link/) {
		print "<style type=\"text/css\">"
		while ((getline line < file) > 0) print line
		close(file)
		print "</style>"
	}
	next
}
{ print }
'

# Full build: monolithic offline build
awk -v mode=full "$INLINE_RULE" viewer/index.html > dist/claude-keeper.html
echo "Built: dist/claude-keeper.html"

# Lite build: vendor libraries load from CDN
awk -v mode=lite "$INLINE_RULE" viewer/index.html > dist/claude-keeper-lite.html
echo "Built: dist/claude-keeper-lite.html"
