import { redirect } from "next/navigation";
import TestChatClient from "./TestChatClient";

export default function TestChatPage() {
  if (process.env.NODE_ENV !== "development") {
    redirect("/builder");
  }
  return <TestChatClient />;
}
