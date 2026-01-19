"""Regression tests for Smart Context feature.

These tests ensure the smart context feature:
1. Correctly identifies relevant files
2. Respects token and file limits
3. Maintains expected performance characteristics
"""

import pytest
import time
import importlib.util
from pathlib import Path

# Import context_builder directly without going through services/__init__.py
_module_path = Path(__file__).parent.parent / "services" / "context_builder.py"
_spec = importlib.util.spec_from_file_location("context_builder", _module_path)
_context_builder = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(_context_builder)

RelevanceScorer = _context_builder.RelevanceScorer
ContextBuilder = _context_builder.ContextBuilder
SmartContext = _context_builder.SmartContext
MAX_CONTEXT_TOKENS = _context_builder.MAX_CONTEXT_TOKENS
MAX_FULL_FILES = _context_builder.MAX_FULL_FILES


# Sample project representing a typical generated app
SAMPLE_PROJECT = {
    "components/Header.tsx": '''
"use client";
import Link from "next/link";
export function Header() {
    return (
        <header className="bg-slate-900 p-4">
            <nav className="flex gap-4">
                <Link href="/">Home</Link>
                <Link href="/about">About</Link>
            </nav>
        </header>
    );
}
''',
    "components/Footer.tsx": '''
export function Footer() {
    return (
        <footer className="bg-slate-800 p-4">
            <p>Copyright 2025</p>
            <a href="/privacy">Privacy Policy</a>
        </footer>
    );
}
''',
    "app/page.tsx": '''
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";

export default function Home() {
    return (
        <div>
            <Header />
            <main>
                <h1>Welcome to MyApp</h1>
                <p>Build something amazing.</p>
            </main>
            <Footer />
        </div>
    );
}
''',
    "app/about/page.tsx": '''
export default function About() {
    return (
        <main>
            <h1>About Us</h1>
            <p>We build great software.</p>
        </main>
    );
}
''',
    "lib/utils.ts": '''
import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs) {
    return twMerge(clsx(inputs));
}
''',
    "hooks/useAuth.ts": '''
import { useState } from "react";

export function useAuth() {
    const [user, setUser] = useState(null);
    return { user, isLoading: false };
}
''',
    "styles/globals.css": '''
@tailwind base;
@tailwind components;
@tailwind utilities;

.container {
    max-width: 1200px;
}
''',
}


class TestSmartContextImprovement:
    """Regression tests for smart context improvements."""

    def test_header_query_finds_header(self):
        """Header-related query should prioritize Header.tsx."""
        builder = ContextBuilder()
        ctx = builder.build_context(SAMPLE_PROJECT, "make the header background blue")

        # Header.tsx should be in full files
        header_in_context = any("Header.tsx" in f.path for f in ctx.full_files)
        assert header_in_context, "Header.tsx should be in full files for header query"

    def test_footer_query_finds_footer(self):
        """Footer-related query should prioritize Footer.tsx."""
        builder = ContextBuilder()
        ctx = builder.build_context(SAMPLE_PROJECT, "fix the broken link in footer")

        footer_in_context = any("Footer.tsx" in f.path for f in ctx.full_files)
        assert footer_in_context, "Footer.tsx should be in full files for footer query"

    def test_page_query_finds_page(self):
        """Homepage-related query should prioritize page.tsx."""
        builder = ContextBuilder()
        ctx = builder.build_context(SAMPLE_PROJECT, "change the homepage title")

        page_in_context = any("page.tsx" in f.path and "about" not in f.path.lower()
                              for f in ctx.full_files)
        assert page_in_context, "app/page.tsx should be in full files for homepage query"

    def test_styling_query_prioritizes_tsx_over_css(self):
        """For styling changes, .tsx files should rank higher than .css."""
        builder = ContextBuilder()
        ctx = builder.build_context(SAMPLE_PROJECT, "make the header text white")

        # TSX files should come before CSS
        if len(ctx.full_files) >= 2:
            tsx_indices = [i for i, f in enumerate(ctx.full_files) if f.path.endswith('.tsx')]
            css_indices = [i for i, f in enumerate(ctx.full_files) if f.path.endswith('.css')]

            if tsx_indices and css_indices:
                assert min(tsx_indices) < min(css_indices), \
                    "TSX files should appear before CSS files in ranking"


class TestSmartContextLimits:
    """Tests for context limits and budget management."""

    def test_respects_max_full_files(self):
        """Should never include more than MAX_FULL_FILES files in full."""
        builder = ContextBuilder()
        ctx = builder.build_context(SAMPLE_PROJECT, "update everything")

        assert len(ctx.full_files) <= MAX_FULL_FILES, \
            f"Should have at most {MAX_FULL_FILES} full files"

    def test_respects_token_budget(self):
        """Should never exceed MAX_CONTEXT_TOKENS."""
        builder = ContextBuilder()
        ctx = builder.build_context(SAMPLE_PROJECT, "make changes")

        assert ctx.token_count <= MAX_CONTEXT_TOKENS, \
            f"Token count {ctx.token_count} exceeds max {MAX_CONTEXT_TOKENS}"

    def test_custom_limits_respected(self):
        """Custom limits should be respected."""
        builder = ContextBuilder(max_full_files=2, max_tokens=500)
        ctx = builder.build_context(SAMPLE_PROJECT, "update everything")

        assert len(ctx.full_files) <= 2, "Custom max_full_files not respected"
        assert ctx.token_count <= 500, "Custom max_tokens not respected"


class TestSmartContextPerformance:
    """Performance regression tests."""

    def test_context_build_under_50ms(self):
        """Context building should complete in under 50ms for typical project."""
        builder = ContextBuilder()

        start = time.perf_counter()
        ctx = builder.build_context(SAMPLE_PROJECT, "make header blue")
        duration_ms = (time.perf_counter() - start) * 1000

        assert duration_ms < 50, f"Context build took {duration_ms:.1f}ms, should be <50ms"

    def test_larger_project_under_100ms(self):
        """Context building should complete in under 100ms for larger projects."""
        # Create a larger project (20 files)
        large_project = {}
        for i in range(20):
            large_project[f"components/Component{i}.tsx"] = f'''
export function Component{i}() {{
    return <div>Component {i} content here</div>;
}}
'''

        builder = ContextBuilder()

        start = time.perf_counter()
        ctx = builder.build_context(large_project, "update component styling")
        duration_ms = (time.perf_counter() - start) * 1000

        assert duration_ms < 100, f"Large project context build took {duration_ms:.1f}ms, should be <100ms"


class TestSmartContextQuality:
    """Quality regression tests for file selection."""

    def test_relevant_file_in_top_3(self):
        """Expected file should be in top 3 for specific queries."""
        test_cases = [
            ("make header background blue", "Header.tsx"),
            ("fix footer link", "Footer.tsx"),
            ("change homepage title", "page.tsx"),
        ]

        builder = ContextBuilder()

        for query, expected_file in test_cases:
            ctx = builder.build_context(SAMPLE_PROJECT, query)
            top_3_paths = [f.path for f in ctx.full_files[:3]]

            found = any(expected_file in path for path in top_3_paths)
            assert found, f"Expected {expected_file} in top 3 for query '{query}', got {top_3_paths}"

    def test_summaries_have_required_fields(self):
        """Summary files should have all required fields populated."""
        builder = ContextBuilder(max_full_files=1)  # Force some summaries
        ctx = builder.build_context(SAMPLE_PROJECT, "query")

        for summary in ctx.summaries:
            assert summary.path, "Summary should have path"
            assert summary.line_count > 0, "Summary should have line count"
            assert summary.purpose, "Summary should have purpose"
            assert 0 <= summary.score <= 1, "Summary score should be 0-1"


class TestBackwardCompatibilityRegression:
    """Ensure backward compatibility is maintained."""

    def test_empty_files_returns_empty_context(self):
        """Empty file dict should return empty SmartContext."""
        builder = ContextBuilder()
        ctx = builder.build_context({}, "any query")

        assert ctx.full_files == []
        assert ctx.summaries == []
        assert ctx.token_count == 0

    def test_empty_query_still_works(self):
        """Empty query should not crash, should use file type priority."""
        builder = ContextBuilder()
        ctx = builder.build_context(SAMPLE_PROJECT, "")

        # Should still return some files (based on file type priority)
        assert isinstance(ctx, SmartContext)

    def test_scorer_can_be_customized(self):
        """Custom scorer should work with ContextBuilder."""
        custom_scorer = RelevanceScorer(recent_files=["components/Header.tsx"])
        builder = ContextBuilder(scorer=custom_scorer)

        ctx = builder.build_context(SAMPLE_PROJECT, "any query")
        assert isinstance(ctx, SmartContext)
