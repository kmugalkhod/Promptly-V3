import { redirect } from "next/navigation";
import TestGenerateClient from "./TestGenerateClient";

export default function TestGeneratePage() {
  if (process.env.NODE_ENV !== "development") {
    redirect("/builder");
  }
  return <TestGenerateClient />;
}
