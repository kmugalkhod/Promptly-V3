"""Context Builder for Smart Chat Agent Context Management.

This module provides intelligent file relevance scoring and context building
for the Chat Agent. It analyzes user queries and scores project files by
relevance, enabling the agent to receive the most useful files upfront
without needing to search.

Key classes:
- RelevanceScorer: Scores files based on keyword matches, file type, and recency
- ContextBuilder: Builds optimized context from scored files (Story 1.2)
- SmartContext: Data structure for context results (Story 1.2)
"""

import re
import time
import logging
from dataclasses import dataclass, field
from typing import Optional

# Configure logger for context builder
logger = logging.getLogger(__name__)


def configure_context_logging(level: int = logging.INFO) -> None:
    """Configure logging for the context builder module.

    Args:
        level: Logging level (e.g., logging.DEBUG, logging.INFO, logging.WARNING)

    Usage:
        from services.context_builder import configure_context_logging
        import logging
        configure_context_logging(logging.DEBUG)  # Enable detailed logs
        configure_context_logging(logging.WARNING)  # Disable most logs
    """
    handler = logging.StreamHandler()
    handler.setFormatter(logging.Formatter(
        "%(asctime)s - %(name)s - %(levelname)s - %(message)s"
    ))
    logger.addHandler(handler)
    logger.setLevel(level)


# Configuration constants
MAX_CONTEXT_TOKENS = 4000
MAX_FULL_FILES = 5
MIN_SCORE_THRESHOLD = 0.1

# File type priorities (higher = more likely to be relevant)
FILE_TYPE_PRIORITIES = {
    ".tsx": 1.0,   # React components - most user-facing
    ".ts": 0.8,    # TypeScript utilities, hooks, types
    ".css": 0.6,   # Stylesheets
    ".scss": 0.6,  # SCSS stylesheets
}
DEFAULT_FILE_PRIORITY = 0.4

# Stop words to filter from queries
STOP_WORDS = {"the", "a", "an", "to", "make", "change", "update", "add", "fix", "is", "it", "in", "on", "for"}

# Route-related keywords for page file bonus
ROUTE_KEYWORDS = {"page", "route", "navigate", "navigation", "home", "homepage", "/"}


class RelevanceScorer:
    """Scores files by relevance to a user query.

    Uses multiple signals:
    - Keyword matches in content
    - File type priority (.tsx > .ts > .css)
    - Component name matches
    - Page file bonus for route queries
    - Recency bonus for recently modified files
    """

    def __init__(self, recent_files: Optional[list[str]] = None):
        """Initialize the scorer.

        Args:
            recent_files: List of recently modified file paths, ordered by recency
                         (most recent first). Used for recency bonus.
        """
        self.recent_files = recent_files or []

    def score_file(self, file_path: str, file_content: str, query: str) -> float:
        """Score a file's relevance to a query.

        Args:
            file_path: Path to the file (e.g., "components/Header.tsx")
            file_content: Content of the file
            query: User's query string

        Returns:
            Float score between 0.0 and 1.0
        """
        keywords = self._extract_keywords(query)

        # Calculate individual scores
        keyword_score = self._calculate_keyword_score(file_content, keywords)
        file_type_score = self._get_file_type_priority(file_path)
        component_score = self._calculate_component_match(file_path, query)
        route_score = self._calculate_route_bonus(file_path, query)
        recency_score = self._calculate_recency_bonus(file_path)

        # Weighted combination (from story dev notes)
        final_score = (
            keyword_score * 0.4 +       # 40% weight on keyword matches
            file_type_score * 0.25 +    # 25% weight on file type
            component_score * 0.2 +     # 20% weight on component name match
            route_score * 0.1 +         # 10% weight on page file bonus
            recency_score * 0.05        # 5% weight on recency
        )

        # Clamp to 0.0-1.0 range
        return max(0.0, min(1.0, final_score))

    def _extract_keywords(self, query: str) -> list[str]:
        """Extract meaningful keywords from a query.

        Args:
            query: User's query string

        Returns:
            List of lowercase keywords (>= 3 chars, no stop words)
        """
        # Lowercase and split on whitespace/punctuation
        words = re.split(r'[\s\-_.,;:!?()]+', query.lower())

        # Filter: remove stop words and short words
        keywords = [
            word for word in words
            if len(word) >= 3 and word not in STOP_WORDS
        ]

        return keywords

    def _calculate_keyword_score(self, content: str, keywords: list[str]) -> float:
        """Calculate score based on keyword matches in content.

        Args:
            content: File content to search
            keywords: List of keywords to look for

        Returns:
            Float score between 0.0 and 1.0
        """
        if not keywords:
            return 0.0

        content_lower = content.lower()
        matches = sum(1 for kw in keywords if kw in content_lower)

        # Return ratio of matched keywords (capped at 1.0)
        return min(1.0, matches / len(keywords))

    def _get_file_type_priority(self, file_path: str) -> float:
        """Get priority score based on file extension.

        Args:
            file_path: Path to the file

        Returns:
            Priority score between 0.0 and 1.0
        """
        # Extract extension
        ext_match = re.search(r'\.[a-zA-Z]+$', file_path)
        if not ext_match:
            return DEFAULT_FILE_PRIORITY

        ext = ext_match.group().lower()
        return FILE_TYPE_PRIORITIES.get(ext, DEFAULT_FILE_PRIORITY)

    def _calculate_component_match(self, file_path: str, query: str) -> float:
        """Calculate bonus for component name matching query.

        Args:
            file_path: Path to the file
            query: User's query string

        Returns:
            0.3 if component name found in query, 0.0 otherwise
        """
        # Extract component name from file path (e.g., "Header.tsx" -> "header")
        filename = file_path.split("/")[-1]
        component_name = re.sub(r'\.[a-zA-Z]+$', '', filename).lower()

        # Check if component name appears in query
        if component_name and len(component_name) >= 3 and component_name in query.lower():
            return 0.3

        return 0.0

    def _calculate_route_bonus(self, file_path: str, query: str) -> float:
        """Calculate bonus for page files when query is route-related.

        Args:
            file_path: Path to the file
            query: User's query string

        Returns:
            0.2 if page file and route query, 0.0 otherwise
        """
        # Check if query mentions routes/pages
        query_lower = query.lower()
        is_route_query = any(kw in query_lower for kw in ROUTE_KEYWORDS)

        if not is_route_query:
            return 0.0

        # Check if file is a page file
        filename = file_path.split("/")[-1].lower()
        is_page_file = filename in ("page.tsx", "layout.tsx", "page.ts", "layout.ts")

        return 0.2 if is_page_file else 0.0

    def _calculate_recency_bonus(self, file_path: str) -> float:
        """Calculate bonus based on how recently the file was modified.

        Args:
            file_path: Path to the file

        Returns:
            Score between 0.0 and 0.15 based on recency position
        """
        if not self.recent_files or file_path not in self.recent_files:
            return 0.0

        # Get position (0 = most recent)
        position = self.recent_files.index(file_path)

        # Calculate bonus: most recent gets 0.15, decreasing for older
        max_bonus = 0.15
        decay_factor = 0.7  # Each older position gets 70% of previous bonus

        bonus = max_bonus * (decay_factor ** position)
        return bonus


# =============================================================================
# Data Classes for Context Structure (Story 1.2)
# =============================================================================

@dataclass
class FileContent:
    """Represents a file with its full content included in context.

    Attributes:
        path: File path relative to project root
        content: Full file content
        score: Relevance score (0.0-1.0)
    """
    path: str
    content: str
    score: float


@dataclass
class FileSummary:
    """Represents a file summary for files not included in full.

    Attributes:
        path: File path relative to project root
        line_count: Number of lines in the file
        purpose: Brief description of file purpose
        score: Relevance score (0.0-1.0)
    """
    path: str
    line_count: int
    purpose: str
    score: float


@dataclass
class SmartContext:
    """Container for intelligently built context.

    Attributes:
        full_files: Files included with full content
        summaries: Files included as summaries only
        token_count: Estimated total tokens used
    """
    full_files: list[FileContent] = field(default_factory=list)
    summaries: list[FileSummary] = field(default_factory=list)
    token_count: int = 0


# =============================================================================
# Helper Functions (Story 1.2)
# =============================================================================

def estimate_tokens(text: str) -> int:
    """Estimate the number of tokens in a text string.

    Uses a simple approximation of ~4 characters per token.
    This is conservative to avoid exceeding context limits.

    Args:
        text: The text to estimate tokens for

    Returns:
        Estimated token count
    """
    if not text:
        return 0
    return len(text) // 4


def estimate_file_tokens(file_path: str, content: str) -> int:
    """Estimate tokens for a file including formatting overhead.

    Accounts for the markdown formatting used when including files:
    ### {path}
    ```
    {content}
    ```

    Args:
        file_path: Path to the file
        content: File content

    Returns:
        Estimated token count including formatting
    """
    # Format: "### {path}\n```\n{content}\n```\n"
    formatted = f"### {file_path}\n```\n{content}\n```\n"
    return estimate_tokens(formatted)


def detect_file_purpose(file_path: str, content: str = "") -> str:
    """Detect the purpose of a file based on its path and content.

    Args:
        file_path: Path to the file
        content: File content (optional, for future enhancement)

    Returns:
        Brief purpose string (max 30 chars)
    """
    path_lower = file_path.lower()
    filename = file_path.split("/")[-1].lower()

    # Page/Layout files
    if filename in ("page.tsx", "page.ts"):
        return "Page component"
    if filename in ("layout.tsx", "layout.ts"):
        return "Layout component"

    # By directory
    if "/components/" in path_lower or path_lower.startswith("components/"):
        return "React component"
    if "/hooks/" in path_lower or path_lower.startswith("hooks/"):
        return "React hook"
    if "/lib/" in path_lower or path_lower.startswith("lib/"):
        return "Utility library"
    if "/utils/" in path_lower or path_lower.startswith("utils/"):
        return "Utility functions"
    if "/types/" in path_lower or path_lower.startswith("types/"):
        return "Type definitions"
    if "/styles/" in path_lower or path_lower.startswith("styles/"):
        return "Stylesheet"
    if "/api/" in path_lower or path_lower.startswith("api/"):
        return "API route"
    if "/services/" in path_lower or path_lower.startswith("services/"):
        return "Service module"

    # By extension
    if filename.endswith(".css") or filename.endswith(".scss"):
        return "Stylesheet"
    if filename.endswith(".tsx"):
        return "React component"
    if filename.endswith(".ts"):
        return "TypeScript module"
    if filename.endswith(".json"):
        return "Configuration"
    if filename.endswith(".md"):
        return "Documentation"

    return "Source file"


# =============================================================================
# Context Builder (Story 1.2)
# =============================================================================

class ContextBuilder:
    """Builds optimized context from scored files for the Chat Agent.

    Uses RelevanceScorer to rank files, then selects the most relevant
    files to include in full within token limits. Remaining files are
    included as summaries.
    """

    def __init__(
        self,
        scorer: Optional[RelevanceScorer] = None,
        max_tokens: int = MAX_CONTEXT_TOKENS,
        max_full_files: int = MAX_FULL_FILES,
        min_score_threshold: float = MIN_SCORE_THRESHOLD
    ):
        """Initialize the context builder.

        Args:
            scorer: RelevanceScorer instance (creates default if None)
            max_tokens: Maximum tokens for full file content
            max_full_files: Maximum number of files to include in full
            min_score_threshold: Minimum score to include a file
        """
        self.scorer = scorer or RelevanceScorer()
        self.max_tokens = max_tokens
        self.max_full_files = max_full_files
        self.min_score_threshold = min_score_threshold

    def build_context(
        self,
        generated_files: dict[str, str],
        query: str,
        max_tokens: Optional[int] = None
    ) -> SmartContext:
        """Build optimized context from project files.

        Args:
            generated_files: Dict mapping file paths to content
            query: User's query string
            max_tokens: Override default max tokens (optional)

        Returns:
            SmartContext with full files and summaries
        """
        start_time = time.perf_counter()

        if not generated_files:
            logger.debug("No files to build context from")
            return SmartContext()

        effective_max_tokens = max_tokens or self.max_tokens
        query_preview = query[:50] + "..." if len(query) > 50 else query
        logger.debug(f"Building context for query: '{query_preview}'")

        # 1. Score all files
        scored_files = [
            (path, content, self.scorer.score_file(path, content, query))
            for path, content in generated_files.items()
        ]

        # 2. Sort by score descending
        scored_files.sort(key=lambda x: x[2], reverse=True)

        # Log top scores
        logger.debug(f"Scored {len(scored_files)} files")
        if scored_files:
            top_scores = [(p, f"{s:.3f}") for p, _, s in scored_files[:5]]
            logger.debug(f"Top 5 scores: {top_scores}")

        # 3. Build context within budget
        full_files: list[FileContent] = []
        summaries: list[FileSummary] = []
        token_count = 0

        for path, content, score in scored_files:
            # Skip files below threshold
            if score < self.min_score_threshold:
                continue

            file_tokens = estimate_file_tokens(path, content)

            # Check if we can include full content
            if (token_count + file_tokens <= effective_max_tokens and
                    len(full_files) < self.max_full_files):
                full_files.append(FileContent(
                    path=path,
                    content=content,
                    score=score
                ))
                token_count += file_tokens
                logger.debug(f"Full file: {path} (score={score:.3f}, tokens={file_tokens})")
            else:
                # Add as summary
                summaries.append(FileSummary(
                    path=path,
                    line_count=content.count('\n') + 1,
                    purpose=detect_file_purpose(path, content),
                    score=score
                ))

        # Log summary
        duration_ms = (time.perf_counter() - start_time) * 1000
        logger.info(
            f"Context built: {len(full_files)} full files, "
            f"{len(summaries)} summaries, "
            f"{token_count} tokens, "
            f"{duration_ms:.1f}ms"
        )

        return SmartContext(
            full_files=full_files,
            summaries=summaries,
            token_count=token_count
        )
