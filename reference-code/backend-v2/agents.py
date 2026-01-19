"""Agent factory functions for the website generator.

Provides factory functions for creating different agent types:
- Architecture Agent: Designs application structure
- Coder Agent: Implements designs in Next.js
- Chat Agent: Handles modifications and searches
"""

from langchain_anthropic import ChatAnthropic
from langchain.agents import create_agent

from tools import (
    read_file, write_file, update_file, install_packages,
    grep_code, list_project_files
)
from prompts import ARCHITECTURE_PROMPT, CODER_PROMPT, CHAT_PROMPT_WITH_CONTEXT, CHAT_PROMPT_SMART_CONTEXT

# Configuration
MODEL_ID = "claude-haiku-4-5-20251001"


def create_architecture_agent():
    """Create the Architecture Agent for designing the app structure."""
    model = ChatAnthropic(model=MODEL_ID)
    return create_agent(
        model,
        tools=[write_file],
        system_prompt=ARCHITECTURE_PROMPT,
        checkpointer=None,
        name="architecture_agent"
    )


def create_coder_agent():
    """Create the Coder Agent for implementing the design."""
    model = ChatAnthropic(model=MODEL_ID)
    return create_agent(
        model,
        tools=[read_file, write_file, update_file, install_packages],
        system_prompt=CODER_PROMPT,
        checkpointer=None,
        name="coder_agent"
    )


def create_chat_agent(context_summary: str, use_smart_context: bool = False):
    """Create the Chat Agent for handling modifications.

    Args:
        context_summary: Project context string (from get_context_summary() or get_smart_context())
        use_smart_context: If True, uses the smart context prompt template which
                          instructs the agent to use pre-loaded files directly.
    """
    model = ChatAnthropic(model=MODEL_ID)

    # Choose prompt template based on context type
    if use_smart_context:
        prompt_with_context = CHAT_PROMPT_SMART_CONTEXT.format(context=context_summary)
    else:
        prompt_with_context = CHAT_PROMPT_WITH_CONTEXT.format(context=context_summary)

    tools = [
        read_file, write_file, update_file,
        grep_code, list_project_files, install_packages
    ]

    return create_agent(
        model,
        tools=tools,
        system_prompt=prompt_with_context,
        checkpointer=None,
        name="chat_agent"
    )
