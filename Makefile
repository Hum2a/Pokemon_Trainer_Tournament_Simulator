# Pokemon Trainer Tournament Simulator - Common commands
# Use: make <target>

.PHONY: install build dev run test clean dex

# Full install (Python deps, Pokemon Showdown, frontend)
install:
	pip install -r requirements.txt
	cd pokemon-showdown && npm install && node build && cd ..
	npm install
	cd frontend && npm install && cd ..

# Build frontend only
build:
	cd frontend && npm run build

# Run development mode (Flask + Vite)
dev:
	npm run dev

# Run production server
run:
	python app.py

# Fetch dex data for Team Builder (run once)
dex:
	cd Data/UsefulDatasets && python fetch_dex_data.py

# Clean build artifacts
clean:
	rm -rf frontend/dist
	rm -rf __pycache__ src/__pycache__
	find . -type d -name __pycache__ -exec rm -rf {} + 2>/dev/null || true
