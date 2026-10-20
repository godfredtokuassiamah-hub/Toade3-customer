// Supabase Storage access for the app.
//
// SECURITY: the app ONLY uses the supabase-js Storage API with the signed-in
// user's session; access is governed by Storage RLS policies
// (supabase/migrations/0002_storage.sql). The S3-compatible endpoint and its
// access keys (see supabase/SETUP.md) grant broad storage access and must
// NEVER appear in app code, .env, or any EXPO_PUBLIC_ var — those are bundled
// into the app and readable by anyone. S3 keys are for server-side/CI only.
import { decode } from "base64-arraybuffer";
import * as FileSystem from "expo-file-system/legacy";

import { supabase } from "../lib/supabase";

// Bucket names. food-images is public-read (menu photos); avatars is private,
// each user writing only under avatars/<their uid>/.
export const BUCKETS = {
  food: "food-images",
  avatars: "avatars",
} as const;

export type BucketName = (typeof BUCKETS)[keyof typeof BUCKETS];

// avatars/<userId>/<filename> — matches the RLS policy's folder check.
export function avatarPath(userId: string, filename: string): string {
  return `${userId}/${filename}`;
}

// Public CDN URL for a public bucket object (no request; builds a URL).
export function getPublicImageUrl(bucket: BucketName, path: string): string {
  return supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl;
}

// Time-limited URL for a private object (e.g. an avatar).
export async function getSignedImageUrl(
  bucket: BucketName,
  path: string,
  expiresInSeconds = 3600,
): Promise<string> {
  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrl(path, expiresInSeconds);
  if (error) throw error;
  return data.signedUrl;
}

// Upload a local file (e.g. a picked image) to Storage. React Native has no
// Blob/File from a uri, so read the file as base64 and decode to an
// ArrayBuffer, which supabase-js accepts.
export async function uploadImage(
  bucket: BucketName,
  path: string,
  file: { uri: string; contentType: string },
): Promise<string> {
  const base64 = await FileSystem.readAsStringAsync(file.uri, {
    encoding: "base64",
  });
  const { error } = await supabase.storage
    .from(bucket)
    .upload(path, decode(base64), {
      contentType: file.contentType,
      upsert: true,
    });
  if (error) throw error;
  return path;
}
