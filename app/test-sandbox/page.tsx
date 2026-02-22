import { redirect } from "next/navigation";
import TestSandboxClient from "./TestSandboxClient";

export default function TestSandboxPage() {
  if (process.env.NODE_ENV !== "development") {
    redirect("/builder");
  }
  return <TestSandboxClient />;
}
