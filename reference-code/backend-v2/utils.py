"""
Utility functions for the Next.js website generator.
"""

import re
from pathlib import Path


def derive_app_name(description: str) -> str:
    """
    Derive a kebab-case app name from a project description.

    Examples:
        "Jira-like project management" -> "project-manager"
        "E-commerce platform for shoes" -> "shoe-store"
        "Build a task tracker" -> "task-tracker"

    Args:
        description: The project description from the user

    Returns:
        A kebab-case app name
    """
    # Remove common words that don't add meaning to the app name
    stop_words = {
        'a', 'an', 'the', 'like', 'similar', 'to', 'for', 'with',
        'build', 'create', 'make', 'application', 'app', 'website',
        'web', 'platform', 'system', 'tool', 'based', 'advanced',
        'simple', 'basic', 'complex', 'modern', 'new', 'my', 'our',
        'using', 'use', 'that', 'this', 'will', 'can', 'should',
        'need', 'want', 'please', 'help', 'me', 'i', 'we', 'you'
    }

    # Extract alphabetic words only
    words = re.findall(r'\b[a-zA-Z]+\b', description.lower())

    # Filter out stop words
    key_words = [w for w in words if w not in stop_words]

    # Take the first 2-3 meaningful words
    key_words = key_words[:2]

    if not key_words:
        return "nextjs-app"

    return "-".join(key_words)


def build_create_next_app_command(app_name: str, output_dir: str = ".") -> str:
    """
    Build the create-next-app command with all required flags.

    Args:
        app_name: The kebab-case app name
        output_dir: The directory where the app will be created

    Returns:
        The full command string to execute
    """
    app_path = Path(output_dir) / app_name

    # Using 'echo n |' to auto-answer any prompts with 'no'
    return (
        f'echo n | npm create next-app@latest "{app_path}" '
        f'-- --typescript --eslint --tailwind --app --src-dir --import-alias "@/*"'
    )


def extract_app_name_from_architecture(content: str) -> str:
    """
    Extract the app name from an architecture document.

    Looks for patterns like:
    - **App Name**: my-app
    - App Name: my-app
    - # Architecture Design: my-app

    Args:
        content: The architecture document content

    Returns:
        The extracted app name, or "nextjs-app" as fallback
    """
    patterns = [
        r'\*\*App Name\*\*:\s*`?([a-z0-9-]+)`?',
        r'App Name:\s*`?([a-z0-9-]+)`?',
        r'# Architecture Design:\s*([a-zA-Z0-9-]+)',
    ]

    for pattern in patterns:
        match = re.search(pattern, content, re.IGNORECASE)
        if match:
            name = match.group(1).lower().strip()
            # Ensure valid kebab-case
            name = re.sub(r'[^a-z0-9-]', '-', name)
            name = re.sub(r'-+', '-', name).strip('-')
            if name:
                return name

    return "nextjs-app"


def validate_app_name(name: str) -> str:
    """
    Validate and sanitize an app name for npm/Next.js compatibility.

    Args:
        name: The proposed app name

    Returns:
        A valid, sanitized app name
    """
    # Convert to lowercase
    name = name.lower()

    # Replace spaces and underscores with hyphens
    name = re.sub(r'[\s_]+', '-', name)

    # Remove any characters that aren't alphanumeric or hyphens
    name = re.sub(r'[^a-z0-9-]', '', name)

    # Remove consecutive hyphens
    name = re.sub(r'-+', '-', name)

    # Remove leading/trailing hyphens
    name = name.strip('-')

    # Ensure it's not empty
    if not name:
        return "nextjs-app"

    # npm package names must be <= 214 characters
    return name[:214]
