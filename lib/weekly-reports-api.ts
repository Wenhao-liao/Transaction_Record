import { isSupabaseConfigured, supabase, type WeeklyReport } from "@/lib/supabase";
import { AuthRequiredError, SupabaseConfigError } from "@/lib/trades-api";

async function ensureAuthenticated() {
  if (!isSupabaseConfigured) {
    throw new SupabaseConfigError();
  }

  const { data, error } = await supabase.auth.getUser();

  if (error || !data.user) {
    throw new AuthRequiredError();
  }
}

export async function getWeeklyReport(id: string) {
  await ensureAuthenticated();

  const { data, error } = await supabase.from("weekly_reports").select("*").eq("id", id).maybeSingle();

  if (error) {
    throw error;
  }

  return data as WeeklyReport | null;
}

export async function listWeeklyReports() {
  await ensureAuthenticated();

  const { data, error } = await supabase
    .from("weekly_reports")
    .select("*")
    .order("week_start", { ascending: false })
    .order("updated_at", { ascending: false });

  if (error) {
    throw error;
  }

  return (data || []) as WeeklyReport[];
}
