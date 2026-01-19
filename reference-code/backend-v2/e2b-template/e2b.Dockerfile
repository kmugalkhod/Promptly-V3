# template.py
from e2b import Template, wait_for_url

template = (
Template()
.from_node_image("21-slim")
.set_workdir("/home/user/nextjs-app")
.run_cmd(
'npx create-next-app@latest . --ts --tailwind --no-eslint --app --no-src-dir --import-alias "@/*" --use-npm --yes'
)
.run_cmd("npx shadcn@latest init -d")
.run_cmd("npx shadcn@latest add --all")
.run_cmd("mv /home/user/nextjs-app/* /home/user/ && rm -rf /home/user/nextjs-app")
.set_workdir("/home/user")
.set_start_cmd("npx next dev --turbo", wait_for_url('http://localhost:3000'))
)