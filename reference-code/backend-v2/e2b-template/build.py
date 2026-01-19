# build.py
from e2b import Template, default_build_logger
from template import template as nextjsTemplate
from dotenv import load_dotenv
# Load environment variables
load_dotenv()

Template.build(nextjsTemplate,
    alias="nextjs16-tailwind4",  # Next.js 16 + Tailwind v4
    cpu_count=4,
    memory_mb=4096,
    on_build_logs=default_build_logger(),
)