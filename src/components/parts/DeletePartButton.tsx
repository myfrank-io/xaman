import { TrashEntityButton } from "@/components/common/TrashEntityButton";

/**
 * « Mettre à la corbeille » a part (E5-4, D40 reversing D10). The name used to be the subject of
 * a confirmation; it is now the toast's second line, so the person still reads which line left.
 * Lives on the edit page only, never on the list.
 */
export function DeletePartButton({
  boatId,
  partId,
  name,
}: {
  boatId: string;
  partId: string;
  name: string;
}) {
  return <TrashEntityButton kind="part" boatId={boatId} id={partId} description={name} />;
}
