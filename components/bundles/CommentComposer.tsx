"use client";

import { useState } from "react";
import { Loader2Icon, SendIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { commentSchema } from "@/lib/validations";
import { useAddComment } from "@/hooks/useBundleDetail";

const COMMENT_MAX_LENGTH = 2000;

/**
 * The composer under the feed. The text is checked by the same Zod schema the
 * endpoint uses, so the message the buyer sees is the one the server would give.
 */
export function CommentComposer({ bundleId }: { bundleId: string }) {
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const add = useAddComment(() => {
    setText("");
    setError(null);
  });

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const parsed = commentSchema.safeParse({ text });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Check the comment");
      return;
    }
    setError(null);
    add.mutate({ id: bundleId, text: parsed.data.text });
  };

  return (
    <form onSubmit={submit} className="space-y-2">
      <Textarea
        value={text}
        onChange={(event) => setText(event.target.value)}
        placeholder="Leave a note for the team — a decision, a warning, what to change next…"
        aria-label="New comment"
        aria-invalid={error ? true : undefined}
        rows={3}
        maxLength={COMMENT_MAX_LENGTH}
        className="resize-y"
        disabled={add.isPending}
      />

      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className={error ? "text-xs text-destructive" : "text-xs text-muted-foreground"}>
          {error ?? (text.length > COMMENT_MAX_LENGTH - 200 ? `${COMMENT_MAX_LENGTH - text.length} characters left` : "Comments are visible to the whole team.")}
        </p>
        <Button type="submit" size="sm" disabled={add.isPending || text.trim().length === 0}>
          {add.isPending ? <Loader2Icon className="animate-spin" /> : <SendIcon />}
          {add.isPending ? "Sending…" : "Comment"}
        </Button>
      </div>
    </form>
  );
}
