APP_NAME: website-builder-ai

DESCRIPTION: AI-powered website generator where users describe their desired website and get instant HTML/CSS code to deploy.

DESIGN_STYLE: modern
- Cards with shadows for preview/output sections
- Rounded corners on input area and code blocks
- Subtle gray backgrounds to separate UI zones
- Clean typography for readability

PACKAGES:
- zustand: Global state for storing generated code, prompts, and UI mode (input/preview/code)
- react-markdown: Display generated HTML code with syntax highlighting
- lucide-react: (already included) for copy, refresh, download icons

ROUTES:
- / (main generator - input description, view preview, see generated code)
- /history (optional: recent generations - not MVP, can add later)

COMPONENTS:
- InputPrompt: Textarea for website description + Generate button
- PreviewPane: iFrame showing rendered HTML output
- CodePane: Generated HTML/CSS code with copy/download buttons
- Header: Logo, title, nav
- Layout: Split view (input left, preview/code right)
- GenerateButton: Triggers API call to AI model

API INTEGRATION (external - not component):
- POST /api/generate - sends prompt, returns HTML/CSS code
- Response: { html: string, css: string, success: boolean }

STATE MANAGEMENT (Zustand):
- prompt: string
- generatedCode: { html, css }
- loading: boolean
- error: string | null
- activeTab: 'preview' | 'code'
