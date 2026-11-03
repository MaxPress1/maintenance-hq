import { ActionForm } from "@/components/ui/action-form";
import { archiveRecord } from "./actions";

export function ArchiveForm({ table, record }: { table: "sites" | "assets"; record: { id: string; updated_at: string; archived_at: string | null } }) {
  return <ActionForm action={archiveRecord} submitLabel={record.archived_at ? "Відновити з архіву" : "Архівувати"}
    confirmMessage={record.archived_at ? "Відновити запис?" : "Архівувати запис? Дані та історія збережуться."}>
    <input type="hidden" name="table" value={table} />
    <input type="hidden" name="id" value={record.id} />
    <input type="hidden" name="updated_at" value={record.updated_at} />
    <input type="hidden" name="operation" value={record.archived_at ? "restore" : "archive"} />
  </ActionForm>;
}
