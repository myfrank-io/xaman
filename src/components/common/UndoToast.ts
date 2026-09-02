import { toast } from "sonner";

/**
 * Success toast carrying an « Annuler ». 8 s and not the usual 6: wet fingers
 * and full sun make 5 s far too short (ux-flows §5.5).
 * The toast is not the safety net — the trash is — but it is what carries the undo.
 */
export function undoToast({
  message,
  description,
  undoLabel,
  onUndo,
  duration = 8000,
}: {
  message: string;
  description?: string;
  undoLabel: string;
  onUndo: () => void;
  duration?: number;
}) {
  return toast.success(message, {
    description,
    duration,
    action: { label: undoLabel, onClick: onUndo },
  });
}
