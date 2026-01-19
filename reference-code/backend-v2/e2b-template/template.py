# template.py
from e2b import Template, wait_for_url


template = (
    Template()
    .from_node_image("22-slim")  # Node 22 LTS for Next.js 16
    .set_workdir("/home/user/nextjs-app")

    # Create Next.js 16 app (includes Tailwind v4 by default)
    .run_cmd('npx create-next-app@latest . --ts --tailwind --no-eslint --app --no-src-dir --import-alias "@/*" --use-npm --yes')

    # Install shadcn/ui
    .run_cmd("npx shadcn@latest init -d")
    .run_cmd("npx shadcn@latest add --all")

    # Move to working directory
    .run_cmd("mv /home/user/nextjs-app/* /home/user/ && rm -rf /home/user/nextjs-app")
    .set_workdir("/home/user")

    # Start dev server (Turbopack is default in Next.js 16)
    .set_start_cmd("npx next dev", wait_for_url('http://localhost:3000'))
)
