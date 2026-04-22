import { supabase } from './supabase';

export type StorageBucket = 'media' | 'avatars' | 'documents';

// Storage buckets configuration
const STORAGE_BUCKETS: Record<StorageBucket, { public: boolean; maxSize: number }> = {
  media: { public: true, maxSize: 10 * 1024 * 1024 }, // 10MB
  avatars: { public: true, maxSize: 2 * 1024 * 1024 }, // 2MB
  documents: { public: false, maxSize: 25 * 1024 * 1024 }, // 25MB
};

// Upload file to Supabase Storage
export async function uploadFile(
  bucket: StorageBucket,
  path: string,
  file: File,
  options?: {
    upsert?: boolean;
    contentType?: string;
  }
) {
  const bucketConfig = STORAGE_BUCKETS[bucket];
  
  if (file.size > bucketConfig.maxSize) {
    throw new Error(`File size exceeds maximum of ${bucketConfig.maxSize / 1024 / 1024}MB`);
  }

  const { data, error } = await supabase.storage
    .from(bucket)
    .upload(path, file, {
      upsert: options?.upsert ?? false,
      contentType: options?.contentType ?? file.type,
    });

  if (error) throw error;
  return data;
}

// Get public URL for file
export function getPublicUrl(bucket: StorageBucket, path: string) {
  const { data } = supabase.storage
    .from(bucket)
    .getPublicUrl(path);

  return data.publicUrl;
}

// Get signed URL for private files
export async function getSignedUrl(bucket: StorageBucket, path: string, expiresIn = 60) {
  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrl(path, expiresIn);

  if (error) throw error;
  return data.signedUrl;
}

// Delete file
export async function deleteFile(bucket: StorageBucket, path: string) {
  const { error } = await supabase.storage
    .from(bucket)
    .remove([path]);

  if (error) throw error;
}

// Upload message media
export async function uploadMessageMedia(
  conversationId: string,
  messageId: string,
  file: File,
  mediaType: 'image' | 'video' | 'audio' | 'file'
) {
  const extension = file.name.split('.').pop() || 'bin';
  const path = `${conversationId}/${messageId}.${extension}`;
  
  const data = await uploadFile('media', path, file);
  const publicUrl = getPublicUrl('media', data.path);
  
  return {
    path: data.path,
    url: publicUrl,
    mediaType,
  };
}

// Upload avatar
export async function uploadAvatar(userId: string, file: File) {
  const extension = file.name.split('.').pop() || 'png';
  const path = `${userId}/avatar.${extension}`;
  
  const data = await uploadFile('avatars', path, file);
  const publicUrl = getPublicUrl('avatars', data.path);
  
  return {
    path: data.path,
    url: publicUrl,
  };
}

// List files in a folder
export async function listFiles(bucket: StorageBucket, folder: string) {
  const { data, error } = await supabase.storage
    .from(bucket)
    .list(folder);

  if (error) throw error;
  return data;
}
