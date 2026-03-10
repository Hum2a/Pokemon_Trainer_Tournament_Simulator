#!/usr/bin/env bash

# Release Tag Manager
# Creates and manages semantic versioning tags for releases
# Automatically updates CHANGELOG.md using Python script
# Works on Windows (Git Bash), Linux, and macOS

# Initialize variables
INCREMENT=""
NAME=""
SET_TAG=""
SHOW_CURRENT=false
FORCE=false
UPDATE_CHANGELOG=true

# Show help function
show_help() {
  echo "Usage: $0 [OPTIONS]"
  echo "Manage release tags with semantic versioning and smart CHANGELOG.md updates"
  echo ""
  echo "Options:"
  echo "  --major           Increment major version (vX.0.0)"
  echo "  --minor           Increment minor version (v0.X.0)"
  echo "  --patch           Increment patch version (v0.0.X) (default)"
  echo "  --name NAME       Append custom name to version (e.g., beta)"
  echo "  --set-tag TAG     Set specific tag (must be vX.Y.Z format)"
  echo "  --current         Show current release tag"
  echo "  --force           Force tag creation even if commit is tagged"
  echo "  --no-changelog    Skip updating CHANGELOG.md (smart categorization)"
  echo "  --help            Show this help message"
  echo ""
  echo "Examples:"
  echo "  $0 --current"
  echo "  $0 --minor"
  echo "  $0 --major --name beta"
  echo "  $0 --set-tag v1.2.3"
  echo "  $0 --patch --no-changelog"
  exit 0
}

# Function to update CHANGELOG.md using Python script
update_changelog() {
  local new_tag="$1"

  echo "🚀 Updating CHANGELOG.md with smart categorization..."
  echo "This will analyze commits and create a beautiful, categorized changelog entry."
  echo ""

  # Check if Python is available
  # Try multiple methods to find Python (handles Windows Git Bash issues)
  PYTHON_CMD=""

  # Method 1: Try python3 command
  if command -v python3 &> /dev/null 2>&1; then
    # Test if it's actually Python (not Windows Store stub)
    if python3 --version &> /dev/null 2>&1; then
      PYTHON_CMD="python3"
    fi
  fi

  # Method 2: Try python command
  if [[ -z "$PYTHON_CMD" ]]; then
    if command -v python &> /dev/null 2>&1; then
      # Test if it's actually Python (not Windows Store stub)
      if python --version &> /dev/null 2>&1; then
        PYTHON_CMD="python"
      fi
    fi
  fi

  # Method 3: Try common Windows Python paths
  if [[ -z "$PYTHON_CMD" ]]; then
    if [[ -f "/c/Python311/python.exe" ]]; then
      PYTHON_CMD="/c/Python311/python.exe"
    elif [[ -f "/c/Python312/python.exe" ]]; then
      PYTHON_CMD="/c/Python312/python.exe"
    elif [[ -f "/c/Python310/python.exe" ]]; then
      PYTHON_CMD="/c/Python310/python.exe"
    elif [[ -f "/c/Python39/python.exe" ]]; then
      PYTHON_CMD="/c/Python39/python.exe"
    fi
  fi

  # Method 4: Try py launcher (Windows)
  if [[ -z "$PYTHON_CMD" ]]; then
    if command -v py &> /dev/null 2>&1; then
      if py --version &> /dev/null 2>&1; then
        PYTHON_CMD="py"
      fi
    fi
  fi

  if [[ -z "$PYTHON_CMD" ]]; then
    echo "❌ Error: Python is not installed or not accessible"
    echo "Please install Python 3.6+ to use the smart changelog updater"
    echo ""
    echo "On Windows, you can:"
    echo "  1. Install Python from https://www.python.org/downloads/"
    echo "  2. Make sure to check 'Add Python to PATH' during installation"
    echo "  3. Or use the --no-changelog flag to skip changelog updates"
    exit 1
  fi

  # Check if the Python script exists
  if [[ ! -f "scripts/update_changelog.py" ]]; then
    echo "❌ Error: update_changelog.py script not found!"
    echo "Please ensure the script exists in the scripts/ directory."
    exit 1
  fi

  # Run the Python changelog updater
  echo "📝 Running smart changelog updater..."
  echo "   Using: $PYTHON_CMD"
  $PYTHON_CMD scripts/update_changelog.py "$new_tag"

  if [[ $? -eq 0 ]]; then
    echo ""
    echo "✅ CHANGELOG.md updated successfully with smart categorization!"
    echo "   - New release section added: [$new_tag]"
    echo "   - Unreleased section reset for future changes"
    echo "   - Commits automatically categorized into meaningful sections"
  else
    echo "❌ Failed to update CHANGELOG.md"
    exit 1
  fi
}

# Parse long arguments
while [[ $# -gt 0 ]]; do
  case "$1" in
    --major)
      if [[ -n "$INCREMENT" ]]; then
        echo "Error: Cannot use multiple version flags together (--major, --minor, --patch, --set-tag)"
        exit 1
      fi
      INCREMENT="major"
      shift
      ;;
    --minor)
      if [[ -n "$INCREMENT" ]]; then
        echo "Error: Cannot use multiple version flags together (--major, --minor, --patch, --set-tag)"
        exit 1
      fi
      INCREMENT="minor"
      shift
      ;;
    --patch)
      if [[ -n "$INCREMENT" ]]; then
        echo "Error: Cannot use multiple version flags together (--major, --minor, --patch, --set-tag)"
        exit 1
      fi
      INCREMENT="patch"
      shift
      ;;
    --name)
      if [[ "$SHOW_CURRENT" == true ]]; then
        echo "Error: Cannot use --name with --current"
        exit 1
      fi
      NAME="$2"
      shift 2
      ;;
    --set-tag)
      if [[ -n "$INCREMENT" ]]; then
        echo "Error: Cannot use multiple version flags together (--major, --minor, --patch, --set-tag)"
        exit 1
      fi
      SET_TAG="$2"
      # Validate tag format
      if [[ ! "$SET_TAG" =~ ^v[0-9]+\.[0-9]+\.[0-9]+(-[a-zA-Z0-9-]+)?$ ]]; then
        echo "Error: Tag must be in format vX.Y.Z or vX.Y.Z-NAME (e.g., v1.2.3 or v1.2.3-beta)"
        exit 1
      fi
      INCREMENT="set"
      shift 2
      ;;
    --current)
      if [[ -n "$INCREMENT" || -n "$NAME" || "$FORCE" == true ]]; then
        echo "Error: Cannot combine --current with other options"
        exit 1
      fi
      SHOW_CURRENT=true
      shift
      ;;
    --force)
      if [[ "$SHOW_CURRENT" == true ]]; then
        echo "Error: Cannot use --force with --current"
        exit 1
      fi
      FORCE=true
      shift
      ;;
    --no-changelog)
      UPDATE_CHANGELOG=false
      shift
      ;;
    --help)
      show_help
      ;;
    *)
      echo "Error: Unknown option $1"
      show_help
      exit 1
      ;;
  esac
done

# Default to patch if no version option specified
if [[ -z "$INCREMENT" && "$SHOW_CURRENT" == false ]]; then
  INCREMENT="patch"
fi

# Always sync with remote tags first
echo "Syncing with remote tags..."
git fetch --tags --force >/dev/null 2>&1

# Get current commit hash
CURRENT_COMMIT=$(git rev-parse HEAD)

# Get latest tag from remote
LATEST_TAG=$(git ls-remote --tags --refs --sort=-v:refname origin | head -n 1 | sed 's/.*\///')

# Show current tag if requested
if [[ "$SHOW_CURRENT" == true ]]; then
  if [[ -z "$LATEST_TAG" ]]; then
    echo "No releases found"
    exit 0
  fi

  TAG_COMMIT=$(git ls-remote origin refs/tags/"$LATEST_TAG" | cut -f 1)
  echo "Latest release tag: $LATEST_TAG"
  echo "Tag points to commit: $TAG_COMMIT"
  echo "Current commit: $CURRENT_COMMIT"

  if [[ "$TAG_COMMIT" == "$CURRENT_COMMIT" ]]; then
    echo "Status: Current commit is tagged"
  else
    echo "Status: Current commit is not tagged"
  fi
  exit 0
fi

# Handle set-tag mode
if [[ "$INCREMENT" == "set" ]]; then
  NEW_TAG="$SET_TAG"
  echo "Setting tag directly to: $NEW_TAG"
else
  # Set default version if no tags exist
  if [[ -z "$LATEST_TAG" ]]; then
    LATEST_TAG="v0.0.0"
    echo "No existing tags found. Starting from v0.0.0"
  else
    echo "Current release tag: $LATEST_TAG"
  fi

  # Extract version numbers
  CLEAN_TAG=${LATEST_TAG#v}
  MAJOR=$(echo "$CLEAN_TAG" | cut -d. -f1)
  MINOR=$(echo "$CLEAN_TAG" | cut -d. -f2)
  PATCH=$(echo "$CLEAN_TAG" | cut -d. -f3 | sed 's/-.*//') # Remove any suffixes

  # Increment version based on selection
  case $INCREMENT in
    major)
      MAJOR=$((MAJOR + 1))
      MINOR=0
      PATCH=0
      ;;
    minor)
      MINOR=$((MINOR + 1))
      PATCH=0
      ;;
    patch)
      PATCH=$((PATCH + 1))
      ;;
  esac

  # Construct new tag
  NEW_TAG="v${MAJOR}.${MINOR}.${PATCH}"

  # Append custom name if provided
  if [[ -n "$NAME" ]]; then
    SANITIZED_NAME=$(echo "$NAME" | tr -cd '[:alnum:]-' | tr ' ' '-')
    NEW_TAG="${NEW_TAG}-${SANITIZED_NAME}"
  fi
fi

# Check if tag already exists locally or remotely
echo "Checking for existing tags..."
EXISTING_REMOTE=$(git ls-remote origin "refs/tags/${NEW_TAG}")
EXISTING_LOCAL=$(git tag -l "$NEW_TAG")

# Delete existing tags if found
if [[ -n "$EXISTING_REMOTE" || -n "$EXISTING_LOCAL" ]]; then
  echo "Tag $NEW_TAG already exists - deleting old version"

  # Delete remote tag
  if [[ -n "$EXISTING_REMOTE" ]]; then
    echo "Deleting remote tag: $NEW_TAG"
    git push --delete origin "$NEW_TAG" >/dev/null 2>&1 || true
  fi

  # Delete local tag
  if [[ -n "$EXISTING_LOCAL" ]]; then
    echo "Deleting local tag: $NEW_TAG"
    git tag -d "$NEW_TAG" >/dev/null 2>&1 || true
  fi
fi

# Check if current commit is already tagged
if [[ -n "$LATEST_TAG" ]]; then
  TAG_COMMIT=$(git ls-remote origin refs/tags/"$LATEST_TAG" | cut -f 1)
  if [[ "$TAG_COMMIT" == "$CURRENT_COMMIT" && "$FORCE" == false ]]; then
    echo "Error: Current commit is already tagged as $LATEST_TAG"
    echo "Use --force to create a new tag on this commit"
    exit 1
  fi
fi

# Function to update package.json version
update_package_json() {
  local new_version="$1"

  # Remove 'v' prefix if present
  local clean_version=${new_version#v}

  # Update frontend/package.json (primary app version)
  if [[ -f "frontend/package.json" ]]; then
    echo "📦 Updating frontend/package.json version to $clean_version..."
    if command -v node &> /dev/null; then
      node -e "
        const fs = require('fs');
        const path = 'frontend/package.json';
        const pkg = JSON.parse(fs.readFileSync(path, 'utf8'));
        pkg.version = '$clean_version';
        fs.writeFileSync(path, JSON.stringify(pkg, null, 2) + '\n');
      " || { echo "❌ Failed to update frontend/package.json"; exit 1; }
    else
      if [[ "$OSTYPE" == "darwin"* ]]; then
        sed -i '' "s/\"version\": \".*\"/\"version\": \"$clean_version\"/" "frontend/package.json"
      else
        sed -i "s/\"version\": \".*\"/\"version\": \"$clean_version\"/" "frontend/package.json"
      fi
    fi
    git add frontend/package.json
  fi

  # Update pyproject.toml (Python project version)
  if [[ -f "pyproject.toml" ]]; then
    echo "📦 Updating pyproject.toml version to $clean_version..."
    if [[ "$OSTYPE" == "darwin"* ]]; then
      sed -i '' "s/^version = \".*\"/version = \"$clean_version\"/" "pyproject.toml"
    else
      sed -i "s/^version = \".*\"/version = \"$clean_version\"/" "pyproject.toml"
    fi
    git add pyproject.toml
  fi

  if [[ -f "frontend/package.json" || -f "pyproject.toml" ]]; then
    echo "✅ Version updated to $clean_version"
  else
    echo "⚠️  No version files found (frontend/package.json, pyproject.toml)"
  fi
}

# Update CHANGELOG.md if enabled
if [[ "$UPDATE_CHANGELOG" == true ]]; then
  update_changelog "$NEW_TAG"

  # Stage the updated CHANGELOG.md
  git add CHANGELOG.md
  echo "✅ CHANGELOG.md staged for commit"
fi

# Update package.json version
update_package_json "$NEW_TAG"

# Commit changes if there are any staged files
STAGED_FILES=$(git diff --cached --name-only)
if [[ -n "$STAGED_FILES" ]]; then
  echo "📝 Committing version bump and changelog updates..."

  # Build commit message
  COMMIT_MSG="chore: bump version to $NEW_TAG"
  if [[ "$UPDATE_CHANGELOG" == true ]]; then
    COMMIT_MSG="$COMMIT_MSG and update changelog"
  fi

  git commit -m "$COMMIT_MSG"

  if [[ $? -eq 0 ]]; then
    echo "✅ Changes committed successfully"

    # Push the commit
    echo "📤 Pushing commit to remote..."
    git push origin HEAD

    if [[ $? -ne 0 ]]; then
      echo "⚠️  Warning: Failed to push commit, but continuing with tag creation"
    fi
  else
    echo "❌ Failed to commit changes"
    exit 1
  fi
fi

# Create and push new tag
echo "Creating new tag: $NEW_TAG"
git tag "$NEW_TAG" && git push origin "$NEW_TAG"

if [[ $? -eq 0 ]]; then
  echo "🎉 Successfully created release tag: $NEW_TAG"
  echo "📝 Tag URL: https://github.com/$(git remote get-url origin | sed -E 's/.*[:/]([^/]+\/[^/]+)\.git.*/\1/')/releases/tag/$NEW_TAG"

  if [[ "$UPDATE_CHANGELOG" == true ]]; then
    echo ""
    echo "📋 Smart Changelog System:"
    echo "   ✅ CHANGELOG.md has been updated with smart categorization"
    echo "   ✅ Commits automatically sorted into meaningful sections"
    echo "   ✅ Professional formatting with emojis and clear structure"
  fi

  echo ""
  echo "✅ Release $NEW_TAG created successfully!"
  echo "   - Version bumped in frontend/package.json and pyproject.toml"
  if [[ "$UPDATE_CHANGELOG" == true ]]; then
    echo "   - CHANGELOG.md updated"
  fi
  echo "   - Changes committed and pushed"
  echo "   - Tag created and pushed"
else
  echo "❌ Error: Failed to create tag"
  exit 1
fi
