#!/usr/bin/env bash
set -e
# Backend build for Render native Python
pip install -r requirements.txt gunicorn
git submodule update --init --recursive
cd pokemon-showdown && npm install && node build && cd ..
