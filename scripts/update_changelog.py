#!/usr/bin/env python3
"""
Update CHANGELOG.md with a new release section from git commits.
Parses commits since the last tag and categorizes them (Added, Fixed, Changed, etc.).
Follows Keep a Changelog format.
"""

import argparse
import re
import subprocess
import sys
from datetime import datetime
from pathlib import Path


# Conventional commit prefix -> Keep a Changelog section
COMMIT_PREFIX_MAP = {
    "feat": "Added",
    "feature": "Added",
    "add": "Added",
    "fix": "Fixed",
    "bugfix": "Fixed",
    "chore": "Changed",
    "refactor": "Changed",
    "perf": "Changed",
    "style": "Changed",
    "docs": "Changed",
    "ci": "Changed",
    "build": "Changed",
    "test": "Changed",
    "revert": "Removed",
    "remove": "Removed",
    "breaking": "Breaking",
}


def run_git(*args: str) -> str:
    """Run a git command and return stdout."""
    result = subprocess.run(
        ["git"] + list(args),
        capture_output=True,
        text=True,
        check=False,
    )
    if result.returncode != 0:
        raise RuntimeError(f"git {' '.join(args)} failed: {result.stderr}")
    return result.stdout.strip()


def get_repo_slug() -> str:
    """Extract owner/repo from git remote URL."""
    url = run_git("remote", "get-url", "origin")
    # Handle https://github.com/owner/repo or git@github.com:owner/repo.git
    m = re.search(r"github\.com[:/]([^/]+/[^/]+?)(?:\.git)?$", url)
    if m:
        return m.group(1).rstrip("/")
    return "owner/repo"


def get_last_tag() -> str | None:
    """Get the most recent tag, or None if none exist."""
    out = run_git("tag", "-l", "--sort=-v:refname")
    tags = [t.strip() for t in out.splitlines() if t.strip()]
    return tags[0] if tags else None


def categorize_commit(subject: str) -> str:
    """Map a commit subject to a Keep a Changelog section."""
    subject_lower = subject.lower()
    # Check conventional commit format: type(scope): message
    m = re.match(r"^(\w+)(?:\([^)]+\))?!?:\s*", subject, re.I)
    if m:
        prefix = m.group(1).lower()
        if prefix in COMMIT_PREFIX_MAP:
            return COMMIT_PREFIX_MAP[prefix]
        if "!" in subject[:m.end()] or "breaking" in prefix:
            return "Breaking"

    # Keyword fallbacks
    if any(w in subject_lower for w in ["add", "new", "implement", "support"]):
        return "Added"
    if any(w in subject_lower for w in ["fix", "bug", "resolve"]):
        return "Fixed"
    if any(w in subject_lower for w in ["remove", "drop", "delete"]):
        return "Removed"
    if any(w in subject_lower for w in ["deprecate"]):
        return "Deprecated"
    if any(w in subject_lower for w in ["security"]):
        return "Security"

    return "Changed"


def format_entry(hash_short: str, subject: str) -> str:
    """Format a single changelog entry."""
    # Strip conventional prefix for cleaner display
    subject_clean = subject
    m = re.match(r"^\w+(?:\([^)]+\))?!?:\s*", subject, re.I)
    if m:
        subject_clean = subject[m.end() :].strip()
    if not subject_clean:
        subject_clean = subject
    return f"- {subject_clean} ({hash_short})"


def build_release_section(tag: str, commits: list[tuple[str, str]]) -> str:
    """Build the new release section content."""
    sections: dict[str, list[str]] = {}
    for hash_short, subject in commits:
        section = categorize_commit(subject)
        if section not in sections:
            sections[section] = []
        sections[section].append(format_entry(hash_short, subject))

    # Order of sections in Keep a Changelog
    order = ["Added", "Changed", "Deprecated", "Removed", "Fixed", "Security", "Breaking"]
    lines = [f"## [{tag}] - {datetime.now().strftime('%Y-%m-%d')}", ""]
    for sec in order:
        if sec in sections:
            lines.append(f"### {sec}")
            lines.append("")
            for entry in sections[sec]:
                lines.append(entry)
            lines.append("")

    return "\n".join(lines)


def update_changelog(changelog_path: Path, new_tag: str, release_content: str) -> None:
    """Insert the new release section and update links."""
    text = changelog_path.read_text(encoding="utf-8")
    repo_slug = get_repo_slug()

    # Find ## [Unreleased] and consume until next ## [ or link line
    unreleased_start = text.find("## [Unreleased]")
    if unreleased_start == -1:
        raise ValueError("Could not find ## [Unreleased] section in CHANGELOG.md")

    # Find end of Unreleased section (next ## [ or first [X]: link)
    after_unreleased = text[unreleased_start:]
    next_section = re.search(r"\n## \[", after_unreleased)
    if next_section:
        unreleased_end = unreleased_start + next_section.start() + 1  # keep \n
    else:
        unreleased_end = len(text)

    before = text[:unreleased_start]
    after = text[unreleased_end:]

    # New Unreleased section (empty, for future commits)
    new_unreleased = "## [Unreleased]\n\n### Added\n\n### Changed\n\n### Fixed\n\n"

    # Update links: add new tag, update Unreleased to compare new_tag...HEAD
    unreleased_link = f"[Unreleased]: https://github.com/{repo_slug}/compare/{new_tag}...HEAD\n"
    new_tag_link = f"[{new_tag}]: https://github.com/{repo_slug}/releases/tag/{new_tag}\n"

    after = re.sub(r"\[Unreleased\]: [^\n]+\n", unreleased_link + new_tag_link, after, count=1)

    new_text = before + new_unreleased + "\n" + release_content + "\n" + after
    changelog_path.write_text(new_text, encoding="utf-8")


def main() -> int:
    parser = argparse.ArgumentParser(description="Update CHANGELOG.md with new release")
    parser.add_argument("tag", help="New version tag (e.g. v1.2.3)")
    args = parser.parse_args()

    tag = args.tag
    if not re.match(r"^v\d+\.\d+\.\d+(-[a-zA-Z0-9-]+)?$", tag):
        print(f"Error: Tag must match vX.Y.Z or vX.Y.Z-name: {tag}", file=sys.stderr)
        return 1

    changelog_path = Path("CHANGELOG.md")
    if not changelog_path.exists():
        print("Error: CHANGELOG.md not found", file=sys.stderr)
        return 1

    try:
        last_tag = get_last_tag()
        if last_tag:
            out = run_git("log", f"{last_tag}..HEAD", "--format=%h %s", "--no-merges")
        else:
            out = run_git("log", "HEAD", "--format=%h %s", "--no-merges")
        commits = []
        for line in out.splitlines():
            line = line.strip()
            if not line:
                continue
            parts = line.split(" ", 1)
            if len(parts) == 2:
                commits.append((parts[0], parts[1]))

        release_content = build_release_section(tag, commits)
        update_changelog(changelog_path, tag, release_content)
        print(f"Updated CHANGELOG.md with release {tag} ({len(commits)} commits)")
        return 0
    except Exception as e:
        print(f"Error: {e}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main())
