import { createSupabaseServerClient } from "../supabase/server";

export const ATTACHMENTS_BUCKET = "attachments";

export async function uploadPrivateFile(
  bucket: string,
  path: string,
  file: File | Blob,
  contentType: string
) {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.storage.from(bucket).upload(path, file, {
    contentType,
    upsert: false,
  });

  if (error) {
    throw error;
  }
  return data;
}

export async function getSignedFileUrl(bucket: string, path: string, expiresInSeconds = 3600) {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, expiresInSeconds);

  if (error) {
    throw error;
  }
  return data.signedUrl;
}
