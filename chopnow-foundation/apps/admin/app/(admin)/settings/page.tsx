import type { Metadata } from "next";
import { cookies } from "next/headers";
import { createSupabaseServerClient } from "@chopnow/lib";
import { MarkupSettingForm } from "./markup-setting-form";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  const cookieStore = await cookies();
  const supabase = createSupabaseServerClient(cookieStore);

  const { data: markupSetting } = await supabase
    .from("platform_settings")
    .select("*")
    .eq("key", "global_markup_percent")
    .single();

  const currentMarkup = markupSetting ? Number(markupSetting.value) : 8;

  return (
    <div className="mx-auto max-w-xl space-y-5 p-4 sm:p-6">
      <div>
        <h1 className="text-lg font-extrabold text-foreground">Settings</h1>
        <p className="text-[12px] text-muted-foreground">Platform-wide configuration</p>
      </div>

      <MarkupSettingForm currentMarkup={currentMarkup} />
    </div>
  );
}
