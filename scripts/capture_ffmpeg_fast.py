#!/usr/bin/env python3
"""Keep Puppeteer's real-frame encoder arguments, with its VP9 CPU preset at 8.

This changes compression effort only. FPS, image input, quality, size and all
timestamps are left to Puppeteer; no synthetic frames or retiming are added.
"""
import os
import shutil
import sys

args = sys.argv[1:]
for index, argument in enumerate(args[:-1]):
    if argument == '-cpu-used':
        args[index + 1] = '8'
binary = shutil.which('ffmpeg')
if binary is None:
    raise SystemExit('ffmpeg not found')
os.execv(binary, [binary, *args])
