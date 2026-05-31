import { Suspense } from "react";
import NewChatWorkspace from "@/components/chat/NewChatWorkspace";

export default function NewChatPage() {
  return (
    <Suspense>
      <NewChatWorkspace />
    </Suspense>
  );
}
