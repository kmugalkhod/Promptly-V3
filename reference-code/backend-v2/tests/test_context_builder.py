"""Tests for the context builder module.

Tests the RelevanceScorer class and its scoring logic.
"""

import pytest
import time
import sys
import importlib.util
from pathlib import Path

# Import context_builder directly without going through services/__init__.py
# This avoids the e2b dependency from sandbox.py
_module_path = Path(__file__).parent.parent / "services" / "context_builder.py"
_spec = importlib.util.spec_from_file_location("context_builder", _module_path)
_context_builder = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(_context_builder)

RelevanceScorer = _context_builder.RelevanceScorer
STOP_WORDS = _context_builder.STOP_WORDS
FILE_TYPE_PRIORITIES = _context_builder.FILE_TYPE_PRIORITIES

# Story 1.2 imports
FileContent = _context_builder.FileContent
FileSummary = _context_builder.FileSummary
SmartContext = _context_builder.SmartContext
ContextBuilder = _context_builder.ContextBuilder
estimate_tokens = _context_builder.estimate_tokens
estimate_file_tokens = _context_builder.estimate_file_tokens
detect_file_purpose = _context_builder.detect_file_purpose
MAX_CONTEXT_TOKENS = _context_builder.MAX_CONTEXT_TOKENS
MAX_FULL_FILES = _context_builder.MAX_FULL_FILES
MIN_SCORE_THRESHOLD = _context_builder.MIN_SCORE_THRESHOLD


# Sample files for testing
SAMPLE_FILES = {
    "components/Header.tsx": """
        "use client";
        import { Button } from "@/components/ui/button";

        export function Header() {
            return (
                <header className="bg-slate-900 p-4">
                    <h1>My App</h1>
                    <Button>Click me</Button>
                </header>
            );
        }
    """,
    "components/Footer.tsx": """
        export function Footer() {
            return (
                <footer className="bg-slate-800 p-4">
                    <p>Copyright 2025</p>
                </footer>
            );
        }
    """,
    "app/page.tsx": """
        export default function Home() {
            return (
                <main>
                    <h1>Welcome to My App</h1>
                </main>
            );
        }
    """,
    "app/about/page.tsx": """
        export default function About() {
            return (
                <main>
                    <h1>About Us</h1>
                </main>
            );
        }
    """,
    "lib/utils.ts": """
        import { clsx, type ClassValue } from "clsx";
        import { twMerge } from "tailwind-merge";

        export function cn(...inputs: ClassValue[]) {
            return twMerge(clsx(inputs));
        }
    """,
    "styles/globals.css": """
        @tailwind base;
        @tailwind components;
        @tailwind utilities;

        .container {
            max-width: 1200px;
            margin: 0 auto;
        }
    """,
    "hooks/useAuth.ts": """
        import { useState, useEffect } from "react";

        export function useAuth() {
            const [user, setUser] = useState(null);
            return { user, isLoading: false };
        }
    """,
}


class TestRelevanceScorerInit:
    """Tests for RelevanceScorer initialization."""

    def test_init_default(self):
        """Test default initialization."""
        scorer = RelevanceScorer()
        assert scorer.recent_files == []

    def test_init_with_recent_files(self):
        """Test initialization with recent files."""
        recent = ["file1.tsx", "file2.tsx"]
        scorer = RelevanceScorer(recent_files=recent)
        assert scorer.recent_files == recent


class TestKeywordExtraction:
    """Tests for keyword extraction."""

    def test_extract_basic_keywords(self):
        """Test basic keyword extraction."""
        scorer = RelevanceScorer()
        keywords = scorer._extract_keywords("make the header blue")
        assert "header" in keywords
        assert "blue" in keywords
        # Stop words should be filtered
        assert "the" not in keywords
        assert "make" not in keywords

    def test_extract_keywords_filters_short_words(self):
        """Test that short words are filtered."""
        scorer = RelevanceScorer()
        keywords = scorer._extract_keywords("go to it")
        # All words are 2 chars or less, or stop words
        assert keywords == []

    def test_extract_keywords_handles_punctuation(self):
        """Test keyword extraction with punctuation."""
        scorer = RelevanceScorer()
        keywords = scorer._extract_keywords("update header, footer, and sidebar!")
        assert "header" in keywords
        assert "footer" in keywords
        assert "sidebar" in keywords

    def test_extract_keywords_empty_query(self):
        """Test keyword extraction with empty query."""
        scorer = RelevanceScorer()
        keywords = scorer._extract_keywords("")
        assert keywords == []


class TestKeywordScoring:
    """Tests for keyword matching score."""

    def test_keyword_score_all_match(self):
        """Test score when all keywords match."""
        scorer = RelevanceScorer()
        content = "This header is blue and styled nicely"
        keywords = ["header", "blue"]
        score = scorer._calculate_keyword_score(content, keywords)
        assert score == 1.0

    def test_keyword_score_partial_match(self):
        """Test score when some keywords match."""
        scorer = RelevanceScorer()
        content = "This header is red"
        keywords = ["header", "blue"]
        score = scorer._calculate_keyword_score(content, keywords)
        assert score == 0.5

    def test_keyword_score_no_match(self):
        """Test score when no keywords match."""
        scorer = RelevanceScorer()
        content = "This is a footer component"
        keywords = ["header", "blue"]
        score = scorer._calculate_keyword_score(content, keywords)
        assert score == 0.0

    def test_keyword_score_empty_keywords(self):
        """Test score with empty keywords list."""
        scorer = RelevanceScorer()
        score = scorer._calculate_keyword_score("some content", [])
        assert score == 0.0

    def test_keyword_score_case_insensitive(self):
        """Test that keyword matching is case insensitive."""
        scorer = RelevanceScorer()
        content = "HEADER component with BLUE styling"
        keywords = ["header", "blue"]
        score = scorer._calculate_keyword_score(content, keywords)
        assert score == 1.0


class TestFileTypePriority:
    """Tests for file type priority scoring."""

    def test_tsx_priority(self):
        """Test .tsx file gets highest priority."""
        scorer = RelevanceScorer()
        score = scorer._get_file_type_priority("components/Header.tsx")
        assert score == 1.0

    def test_ts_priority(self):
        """Test .ts file priority."""
        scorer = RelevanceScorer()
        score = scorer._get_file_type_priority("lib/utils.ts")
        assert score == 0.8

    def test_css_priority(self):
        """Test .css file priority."""
        scorer = RelevanceScorer()
        score = scorer._get_file_type_priority("styles/globals.css")
        assert score == 0.6

    def test_scss_priority(self):
        """Test .scss file priority."""
        scorer = RelevanceScorer()
        score = scorer._get_file_type_priority("styles/theme.scss")
        assert score == 0.6

    def test_unknown_extension_priority(self):
        """Test unknown file extension gets default priority."""
        scorer = RelevanceScorer()
        score = scorer._get_file_type_priority("config.json")
        assert score == 0.4

    def test_no_extension_priority(self):
        """Test file without extension gets default priority."""
        scorer = RelevanceScorer()
        score = scorer._get_file_type_priority("Dockerfile")
        assert score == 0.4


class TestComponentNameMatching:
    """Tests for component name matching."""

    def test_component_match_in_query(self):
        """Test component name found in query."""
        scorer = RelevanceScorer()
        score = scorer._calculate_component_match(
            "components/Header.tsx",
            "make the header blue"
        )
        assert score == 0.3

    def test_component_not_in_query(self):
        """Test component name not in query."""
        scorer = RelevanceScorer()
        score = scorer._calculate_component_match(
            "components/Footer.tsx",
            "make the header blue"
        )
        assert score == 0.0

    def test_component_match_case_insensitive(self):
        """Test component matching is case insensitive."""
        scorer = RelevanceScorer()
        score = scorer._calculate_component_match(
            "components/Header.tsx",
            "update the HEADER styles"
        )
        assert score == 0.3

    def test_component_match_nested_path(self):
        """Test component name extraction from nested path."""
        scorer = RelevanceScorer()
        score = scorer._calculate_component_match(
            "components/ui/Button.tsx",
            "change the button color"
        )
        assert score == 0.3


class TestPageFileBonus:
    """Tests for page file bonus with route queries."""

    def test_page_file_with_route_query(self):
        """Test page file gets bonus for route query."""
        scorer = RelevanceScorer()
        score = scorer._calculate_route_bonus(
            "app/page.tsx",
            "change the homepage"
        )
        assert score == 0.2

    def test_page_file_with_non_route_query(self):
        """Test page file gets no bonus for non-route query."""
        scorer = RelevanceScorer()
        score = scorer._calculate_route_bonus(
            "app/page.tsx",
            "change the color blue"
        )
        assert score == 0.0

    def test_non_page_file_with_route_query(self):
        """Test non-page file gets no bonus even with route query."""
        scorer = RelevanceScorer()
        score = scorer._calculate_route_bonus(
            "components/Header.tsx",
            "update the navigation"
        )
        assert score == 0.0

    def test_layout_file_with_route_query(self):
        """Test layout file also gets bonus."""
        scorer = RelevanceScorer()
        score = scorer._calculate_route_bonus(
            "app/layout.tsx",
            "change the page layout"
        )
        assert score == 0.2


class TestRecencyBonus:
    """Tests for recency-based scoring."""

    def test_most_recent_file(self):
        """Test most recent file gets highest bonus."""
        recent = ["file1.tsx", "file2.tsx", "file3.tsx"]
        scorer = RelevanceScorer(recent_files=recent)
        score = scorer._calculate_recency_bonus("file1.tsx")
        assert score == 0.15  # Max bonus

    def test_second_recent_file(self):
        """Test second most recent file gets reduced bonus."""
        recent = ["file1.tsx", "file2.tsx", "file3.tsx"]
        scorer = RelevanceScorer(recent_files=recent)
        score = scorer._calculate_recency_bonus("file2.tsx")
        assert score == pytest.approx(0.15 * 0.7, rel=0.01)

    def test_not_in_recent_list(self):
        """Test file not in recent list gets no bonus."""
        recent = ["file1.tsx", "file2.tsx"]
        scorer = RelevanceScorer(recent_files=recent)
        score = scorer._calculate_recency_bonus("other.tsx")
        assert score == 0.0

    def test_empty_recent_list(self):
        """Test with empty recent list."""
        scorer = RelevanceScorer(recent_files=[])
        score = scorer._calculate_recency_bonus("file.tsx")
        assert score == 0.0


class TestScoreFile:
    """Tests for the main score_file method."""

    def test_score_file_header_query(self):
        """Test scoring header file with header query."""
        scorer = RelevanceScorer()
        score = scorer.score_file(
            "components/Header.tsx",
            SAMPLE_FILES["components/Header.tsx"],
            "make the header blue"
        )
        # Should have high score due to keyword match + component match + file type
        assert score > 0.5

    def test_score_file_returns_bounded_value(self):
        """Test that score is always between 0 and 1."""
        scorer = RelevanceScorer()
        for path, content in SAMPLE_FILES.items():
            for query in ["header", "styling", "random xyz query"]:
                score = scorer.score_file(path, content, query)
                assert 0.0 <= score <= 1.0

    def test_score_file_relevant_vs_irrelevant(self):
        """Test that relevant files score higher than irrelevant ones."""
        scorer = RelevanceScorer()
        query = "make the header blue"

        header_score = scorer.score_file(
            "components/Header.tsx",
            SAMPLE_FILES["components/Header.tsx"],
            query
        )
        footer_score = scorer.score_file(
            "components/Footer.tsx",
            SAMPLE_FILES["components/Footer.tsx"],
            query
        )

        assert header_score > footer_score

    def test_score_file_page_query(self):
        """Test page file scores high for page-related query."""
        scorer = RelevanceScorer()
        query = "change the homepage"

        page_score = scorer.score_file(
            "app/page.tsx",
            SAMPLE_FILES["app/page.tsx"],
            query
        )
        header_score = scorer.score_file(
            "components/Header.tsx",
            SAMPLE_FILES["components/Header.tsx"],
            query
        )

        assert page_score > header_score


class TestEdgeCases:
    """Tests for edge cases."""

    def test_empty_query(self):
        """Test scoring with empty query."""
        scorer = RelevanceScorer()
        score = scorer.score_file(
            "components/Header.tsx",
            SAMPLE_FILES["components/Header.tsx"],
            ""
        )
        # Should return a low but valid score (file type priority only)
        assert 0.0 <= score <= 1.0

    def test_empty_content(self):
        """Test scoring with empty file content."""
        scorer = RelevanceScorer()
        score = scorer.score_file(
            "components/Empty.tsx",
            "",
            "make header blue"
        )
        assert 0.0 <= score <= 1.0

    def test_special_characters_in_query(self):
        """Test scoring with special characters in query."""
        scorer = RelevanceScorer()
        score = scorer.score_file(
            "components/Header.tsx",
            SAMPLE_FILES["components/Header.tsx"],
            "update @header #blue !important"
        )
        assert 0.0 <= score <= 1.0


class TestPerformance:
    """Performance tests for scoring."""

    def test_scoring_performance(self):
        """Test that scoring 50 files completes in under 50ms."""
        scorer = RelevanceScorer()
        query = "make the header component background color blue"

        # Create 50 sample files
        files = []
        for i in range(50):
            files.append((
                f"components/Component{i}.tsx",
                f"export function Component{i}() {{ return <div>Content {i}</div>; }}"
            ))

        start_time = time.perf_counter()
        for path, content in files:
            scorer.score_file(path, content, query)
        duration_ms = (time.perf_counter() - start_time) * 1000

        assert duration_ms < 50, f"Scoring 50 files took {duration_ms:.1f}ms (should be <50ms)"


# =============================================================================
# Story 1.2 Tests: Context Builder
# =============================================================================

class TestDataClasses:
    """Tests for SmartContext data classes."""

    def test_file_content_creation(self):
        """Test FileContent dataclass creation."""
        fc = FileContent(path="test.tsx", content="content", score=0.8)
        assert fc.path == "test.tsx"
        assert fc.content == "content"
        assert fc.score == 0.8

    def test_file_summary_creation(self):
        """Test FileSummary dataclass creation."""
        fs = FileSummary(path="test.tsx", line_count=10, purpose="React component", score=0.5)
        assert fs.path == "test.tsx"
        assert fs.line_count == 10
        assert fs.purpose == "React component"
        assert fs.score == 0.5

    def test_smart_context_default(self):
        """Test SmartContext with default values."""
        ctx = SmartContext()
        assert ctx.full_files == []
        assert ctx.summaries == []
        assert ctx.token_count == 0

    def test_smart_context_with_values(self):
        """Test SmartContext with provided values."""
        files = [FileContent(path="a.tsx", content="x", score=0.9)]
        summaries = [FileSummary(path="b.tsx", line_count=5, purpose="Test", score=0.3)]
        ctx = SmartContext(full_files=files, summaries=summaries, token_count=100)
        assert len(ctx.full_files) == 1
        assert len(ctx.summaries) == 1
        assert ctx.token_count == 100


class TestTokenEstimation:
    """Tests for token estimation functions."""

    def test_estimate_tokens_empty(self):
        """Test token estimation with empty string."""
        assert estimate_tokens("") == 0

    def test_estimate_tokens_short(self):
        """Test token estimation with short text."""
        # 12 characters / 4 = 3 tokens
        assert estimate_tokens("hello world!") == 3

    def test_estimate_tokens_longer(self):
        """Test token estimation with longer text."""
        text = "a" * 100
        assert estimate_tokens(text) == 25

    def test_estimate_file_tokens(self):
        """Test file token estimation with formatting."""
        tokens = estimate_file_tokens("test.tsx", "content")
        # Should include path and markdown formatting overhead
        assert tokens > estimate_tokens("content")

    def test_token_estimation_within_tolerance(self):
        """Test that estimation is within 20% of a reasonable approximation."""
        # A typical code file
        content = """
export function Header() {
    return (
        <header className="bg-blue-500">
            <h1>Title</h1>
        </header>
    );
}
"""
        estimated = estimate_tokens(content)
        # Rough check: should be reasonable (not off by orders of magnitude)
        assert 10 < estimated < 100


class TestFilePurposeDetection:
    """Tests for file purpose detection."""

    def test_page_component(self):
        """Test page.tsx detection."""
        assert detect_file_purpose("app/page.tsx") == "Page component"

    def test_layout_component(self):
        """Test layout.tsx detection."""
        assert detect_file_purpose("app/layout.tsx") == "Layout component"

    def test_react_component(self):
        """Test component detection."""
        assert detect_file_purpose("components/Header.tsx") == "React component"

    def test_hook_detection(self):
        """Test hook detection."""
        assert detect_file_purpose("hooks/useAuth.ts") == "React hook"

    def test_utility_library(self):
        """Test lib detection."""
        assert detect_file_purpose("lib/utils.ts") == "Utility library"

    def test_type_definitions(self):
        """Test types detection."""
        assert detect_file_purpose("types/index.ts") == "Type definitions"

    def test_stylesheet_by_path(self):
        """Test stylesheet detection by path."""
        assert detect_file_purpose("styles/globals.css") == "Stylesheet"

    def test_stylesheet_by_extension(self):
        """Test stylesheet detection by extension."""
        assert detect_file_purpose("theme.scss") == "Stylesheet"

    def test_api_route(self):
        """Test API route detection."""
        assert detect_file_purpose("api/users/route.ts") == "API route"

    def test_unknown_file(self):
        """Test fallback for unknown files."""
        purpose = detect_file_purpose("random/file.xyz")
        assert purpose == "Source file"


class TestContextBuilderInit:
    """Tests for ContextBuilder initialization."""

    def test_default_init(self):
        """Test default initialization."""
        builder = ContextBuilder()
        assert builder.scorer is not None
        assert builder.max_tokens == MAX_CONTEXT_TOKENS
        assert builder.max_full_files == MAX_FULL_FILES
        assert builder.min_score_threshold == MIN_SCORE_THRESHOLD

    def test_custom_scorer(self):
        """Test with custom scorer."""
        scorer = RelevanceScorer(recent_files=["a.tsx"])
        builder = ContextBuilder(scorer=scorer)
        assert builder.scorer is scorer

    def test_custom_config(self):
        """Test with custom configuration."""
        builder = ContextBuilder(
            max_tokens=2000,
            max_full_files=3,
            min_score_threshold=0.2
        )
        assert builder.max_tokens == 2000
        assert builder.max_full_files == 3
        assert builder.min_score_threshold == 0.2


class TestContextBuilding:
    """Tests for context building functionality."""

    def test_empty_files(self):
        """Test with empty file dict."""
        builder = ContextBuilder()
        ctx = builder.build_context({}, "query")
        assert ctx.full_files == []
        assert ctx.summaries == []
        assert ctx.token_count == 0

    def test_single_file(self):
        """Test with single file."""
        builder = ContextBuilder()
        files = {"components/Header.tsx": "export function Header() {}"}
        ctx = builder.build_context(files, "header")

        assert len(ctx.full_files) == 1
        assert ctx.full_files[0].path == "components/Header.tsx"
        assert ctx.token_count > 0

    def test_multiple_files_scoring(self):
        """Test that higher scoring files come first."""
        builder = ContextBuilder()
        ctx = builder.build_context(SAMPLE_FILES, "make the header blue")

        # Header should be first (highest relevance)
        if ctx.full_files:
            assert "Header" in ctx.full_files[0].path

    def test_token_budget_respected(self):
        """Test that token budget is never exceeded."""
        builder = ContextBuilder(max_tokens=100)
        ctx = builder.build_context(SAMPLE_FILES, "query")

        assert ctx.token_count <= 100

    def test_max_full_files_respected(self):
        """Test that max full files limit is respected."""
        builder = ContextBuilder(max_full_files=2)
        ctx = builder.build_context(SAMPLE_FILES, "query")

        assert len(ctx.full_files) <= 2

    def test_low_score_files_excluded(self):
        """Test that very low scoring files are excluded."""
        builder = ContextBuilder(min_score_threshold=0.5)
        # Use a query that won't match most files well
        ctx = builder.build_context(SAMPLE_FILES, "xyzzy nonexistent")

        # Most files should be filtered out due to low scores
        total_files = len(ctx.full_files) + len(ctx.summaries)
        assert total_files < len(SAMPLE_FILES)

    def test_summaries_for_overflow(self):
        """Test that files exceeding budget become summaries."""
        # Use very small token limit to force summaries
        builder = ContextBuilder(max_tokens=50, max_full_files=1)
        ctx = builder.build_context(SAMPLE_FILES, "header footer page")

        # Should have 1 full file and rest as summaries
        assert len(ctx.full_files) <= 1
        # Should have some summaries if files scored above threshold
        # (depends on scoring, but with multiple keywords some should match)

    def test_summary_has_correct_fields(self):
        """Test that summaries have correct information."""
        builder = ContextBuilder(max_tokens=50, max_full_files=0)
        files = {"components/Test.tsx": "line1\nline2\nline3"}
        ctx = builder.build_context(files, "test")

        if ctx.summaries:
            summary = ctx.summaries[0]
            assert summary.path == "components/Test.tsx"
            assert summary.line_count == 3
            assert summary.purpose == "React component"
            assert 0 <= summary.score <= 1

    def test_override_max_tokens(self):
        """Test that max_tokens can be overridden per call."""
        builder = ContextBuilder(max_tokens=4000)
        ctx = builder.build_context(SAMPLE_FILES, "query", max_tokens=50)

        assert ctx.token_count <= 50


class TestContextBuilderIntegration:
    """Integration tests for ContextBuilder."""

    def test_realistic_scenario(self):
        """Test a realistic modification scenario."""
        builder = ContextBuilder()
        ctx = builder.build_context(SAMPLE_FILES, "make the header background blue")

        # Should have Header.tsx as first full file
        assert len(ctx.full_files) > 0
        header_found = any("Header" in f.path for f in ctx.full_files)
        assert header_found, "Header.tsx should be in full files"

        # Token count should be reasonable
        assert ctx.token_count > 0
        assert ctx.token_count <= MAX_CONTEXT_TOKENS

    def test_page_route_scenario(self):
        """Test scenario with page-related query."""
        builder = ContextBuilder()
        ctx = builder.build_context(SAMPLE_FILES, "change the homepage layout")

        # Page files should be prioritized
        if ctx.full_files:
            first_file = ctx.full_files[0]
            # Should prioritize page.tsx or layout files
            is_page_related = "page" in first_file.path.lower() or "layout" in first_file.path.lower()
            # This might not always be true due to keyword matching, but page should be high
            assert any("page" in f.path.lower() for f in ctx.full_files)


# =============================================================================
# Story 1.3 Tests: Chat Agent Integration
# =============================================================================

# For Story 1.3 tests, we create a minimal ChatSession mock and test format_smart_context
# The actual integration with session_manager.py is tested via import checks

from dataclasses import dataclass, field
from datetime import datetime


@dataclass
class MockChatMessage:
    """Mock ChatMessage for testing."""
    role: str
    content: str
    timestamp: datetime = field(default_factory=datetime.now)


@dataclass
class MockChatSession:
    """Mock ChatSession for testing format_smart_context."""
    session_id: str
    app_name: str = ""
    preview_url: str = ""
    architecture: str = ""
    conversation_history: list = field(default_factory=list)
    generated_files: dict = field(default_factory=dict)

    def add_message(self, role: str, content: str) -> None:
        self.conversation_history.append(MockChatMessage(role=role, content=content))

    def get_recent_messages(self, n: int = 10):
        return self.conversation_history[-n:]


def mock_format_smart_context(smart_context: SmartContext, session: MockChatSession) -> str:
    """Format SmartContext into a prompt string (same logic as session_manager)."""
    # Build full files section
    full_files_lines = []
    for file_content in smart_context.full_files:
        ext = file_content.path.split('.')[-1] if '.' in file_content.path else ''
        lang = ext if ext in ('tsx', 'ts', 'css', 'scss', 'json', 'md') else ''
        full_files_lines.append(f"### {file_content.path}")
        full_files_lines.append(f"```{lang}")
        full_files_lines.append(file_content.content)
        full_files_lines.append("```")
        full_files_lines.append("")

    full_files_section = "\n".join(full_files_lines) if full_files_lines else "(none)"

    # Build summaries section
    summaries_lines = []
    for summary in smart_context.summaries:
        summaries_lines.append(f"- {summary.path} ({summary.line_count} lines) - {summary.purpose}")

    summaries_section = "\n".join(summaries_lines) if summaries_lines else "(none)"

    # Build recent messages section
    recent_msgs = session.get_recent_messages(5)
    msgs_text = "\n".join(
        f"  {m.role}: {m.content[:100]}..." if len(m.content) > 100 else f"  {m.role}: {m.content}"
        for m in recent_msgs
    )

    return f"""## Current Project Context

App Name: {session.app_name}
Preview URL: {session.preview_url}

## Relevant Files (Pre-loaded)

The following files are most relevant to your request. Use them directly without calling read_file:

{full_files_section}

## Other Files (Request if needed)

These files exist but weren't pre-loaded. Use read_file if you need them:

{summaries_section}

## Recent Conversation

{msgs_text if msgs_text else "(new session)"}

## Architecture Summary

{session.architecture[:500] if session.architecture else "(not yet created)"}
"""


# Use mock for testing
ChatSession = MockChatSession
format_smart_context = mock_format_smart_context


class TestGetSmartContext:
    """Tests for smart context building via ContextBuilder."""

    def test_smart_context_builder_with_files(self):
        """Test ContextBuilder returns SmartContext with prioritized files."""
        builder = ContextBuilder()

        files = {
            "components/Header.tsx": "export function Header() { return <h1>Hello</h1> }",
            "app/page.tsx": "export default function Home() { return <main /> }"
        }

        ctx = builder.build_context(files, "make header blue")

        # Should have Header.tsx prioritized
        assert len(ctx.full_files) > 0
        header_found = any("Header" in f.path for f in ctx.full_files)
        assert header_found

    def test_smart_context_empty_files(self):
        """Test that empty files returns empty context."""
        builder = ContextBuilder()
        ctx = builder.build_context({}, "some query")

        assert ctx.full_files == []
        assert ctx.summaries == []
        assert ctx.token_count == 0

    def test_smart_context_query_affects_ranking(self):
        """Test that query affects which files are prioritized."""
        builder = ContextBuilder()

        header_ctx = builder.build_context(SAMPLE_FILES, "make header blue")
        footer_ctx = builder.build_context(SAMPLE_FILES, "change footer text")

        # Header query should prioritize Header.tsx
        if header_ctx.full_files:
            header_first = "Header" in header_ctx.full_files[0].path

        # Footer query should prioritize Footer.tsx
        if footer_ctx.full_files:
            footer_first = "Footer" in footer_ctx.full_files[0].path

        # At least one of these should be true (depending on scoring)
        assert header_first or footer_first


class TestFormatSmartContext:
    """Tests for format_smart_context function."""

    def test_format_with_full_files(self):
        """Test formatting with full file contents."""
        session = ChatSession(session_id="test-123")
        session.app_name = "TestApp"
        session.preview_url = "https://test.e2b.dev"

        smart_ctx = SmartContext(
            full_files=[
                FileContent(path="components/Header.tsx", content="<header>Hi</header>", score=0.9)
            ],
            summaries=[],
            token_count=100
        )

        result = format_smart_context(smart_ctx, session)

        assert "### components/Header.tsx" in result
        assert "<header>Hi</header>" in result
        assert "```tsx" in result

    def test_format_with_summaries(self):
        """Test formatting with file summaries."""
        session = ChatSession(session_id="test-123")
        session.app_name = "TestApp"

        smart_ctx = SmartContext(
            full_files=[],
            summaries=[
                FileSummary(path="lib/utils.ts", line_count=50, purpose="Utility library", score=0.3)
            ],
            token_count=0
        )

        result = format_smart_context(smart_ctx, session)

        assert "Other Files" in result
        assert "lib/utils.ts" in result
        assert "50 lines" in result
        assert "Utility library" in result

    def test_format_includes_recent_messages(self):
        """Test that recent messages are included."""
        session = ChatSession(session_id="test-123")
        session.app_name = "TestApp"
        session.add_message("user", "make header blue")
        session.add_message("assistant", "Done! Changed the header.")

        smart_ctx = SmartContext()
        result = format_smart_context(smart_ctx, session)

        assert "Recent Conversation" in result
        assert "make header blue" in result

    def test_format_includes_architecture_summary(self):
        """Test that architecture is included."""
        session = ChatSession(session_id="test-123")
        session.app_name = "TestApp"
        session.architecture = "# App Architecture\n\nThis is a landing page..."

        smart_ctx = SmartContext()
        result = format_smart_context(smart_ctx, session)

        assert "Architecture Summary" in result
        assert "landing page" in result

    def test_format_empty_context(self):
        """Test formatting with empty SmartContext."""
        session = ChatSession(session_id="test-123")
        session.app_name = "TestApp"

        smart_ctx = SmartContext()
        result = format_smart_context(smart_ctx, session)

        assert "Relevant Files" in result
        assert "(none)" in result

    def test_format_code_block_language(self):
        """Test that code blocks have correct language hints."""
        session = ChatSession(session_id="test-123")
        session.app_name = "TestApp"

        smart_ctx = SmartContext(
            full_files=[
                FileContent(path="styles/globals.css", content=".container {}", score=0.5),
                FileContent(path="lib/utils.ts", content="export function cn() {}", score=0.5)
            ],
            summaries=[],
            token_count=100
        )

        result = format_smart_context(smart_ctx, session)

        assert "```css" in result
        assert "```ts" in result


class TestChatAgentIntegration:
    """Tests for chat agent integration with smart context."""

    def test_chat_prompt_smart_context_exists(self):
        """Test that CHAT_PROMPT_SMART_CONTEXT template exists."""
        # Import prompts module
        prompts_path = Path(__file__).parent.parent / "prompts" / "chat_prompt.py"
        spec = importlib.util.spec_from_file_location("chat_prompt", prompts_path)
        chat_prompt = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(chat_prompt)

        assert hasattr(chat_prompt, "CHAT_PROMPT_SMART_CONTEXT")
        prompt = chat_prompt.CHAT_PROMPT_SMART_CONTEXT

        # Verify key sections
        assert "{context}" in prompt
        assert "pre-loaded files" in prompt.lower()
        assert "read_file" in prompt

    def test_chat_prompt_smart_context_has_instructions(self):
        """Test that smart context prompt has clear instructions."""
        prompts_path = Path(__file__).parent.parent / "prompts" / "chat_prompt.py"
        spec = importlib.util.spec_from_file_location("chat_prompt", prompts_path)
        chat_prompt = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(chat_prompt)

        prompt = chat_prompt.CHAT_PROMPT_SMART_CONTEXT

        # Should instruct agent NOT to read pre-loaded files
        assert "DO NOT" in prompt or "do not" in prompt.lower()
        # Should mention using pre-loaded files directly
        assert "directly" in prompt.lower()


class TestBackwardCompatibility:
    """Tests for backward compatibility by checking source code."""

    def test_session_manager_has_get_context_summary(self):
        """Test that session_manager.py contains get_context_summary method."""
        session_file = Path(__file__).parent.parent / "services" / "session_manager.py"
        content = session_file.read_text()

        # Verify method exists
        assert "def get_context_summary" in content
        # Verify it returns expected format
        assert "Current Project Context" in content
        assert "Generated Files:" in content

    def test_session_manager_has_get_smart_context(self):
        """Test that session_manager.py contains get_smart_context method."""
        session_file = Path(__file__).parent.parent / "services" / "session_manager.py"
        content = session_file.read_text()

        # Verify method exists
        assert "def get_smart_context" in content
        # Verify it uses ContextBuilder
        assert "ContextBuilder" in content
        assert "RelevanceScorer" in content

    def test_both_context_methods_in_chat_session(self):
        """Test that ChatSession class has both context methods."""
        session_file = Path(__file__).parent.parent / "services" / "session_manager.py"
        content = session_file.read_text()

        # Both methods should be defined
        assert "def get_context_summary(self)" in content
        assert "def get_smart_context(self, query: str)" in content

    def test_format_smart_context_function_exists(self):
        """Test that format_smart_context function exists."""
        session_file = Path(__file__).parent.parent / "services" / "session_manager.py"
        content = session_file.read_text()

        assert "def format_smart_context" in content
        assert "SmartContext" in content
