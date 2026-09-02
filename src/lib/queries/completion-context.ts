import type { SupabaseClient } from "@supabase/supabase-js";

import type { CompletionMember } from "@/components/checklist/CompleteItemDialog";
import type { Database } from "@/types/database";

// Who can be named in « Réalisé par »: the boat's members, the signed-in user first.
export async function completionContext(
  supabase: SupabaseClient<Database>,
  boatId: string,
): Promise<{ members: CompletionMember[]; currentUserId: string; currentUserName: string }> {
  const [{ data: auth }, { data: members }] = await Promise.all([
    supabase.auth.getUser(),
    supabase
      .from("boat_members")
      .select("user_id, profiles!boat_members_user_id_fkey(full_name, email)")
      .eq("boat_id", boatId),
  ]);
  const list: CompletionMember[] = (members ?? []).map((member) => ({
    id: member.user_id,
    name: member.profiles?.full_name ?? member.profiles?.email ?? "",
  }));
  const currentUserId = auth.user?.id ?? "";
  const currentUserName =
    list.find((member) => member.id === currentUserId)?.name ?? auth.user?.email ?? "";
  return { members: list, currentUserId, currentUserName };
}
