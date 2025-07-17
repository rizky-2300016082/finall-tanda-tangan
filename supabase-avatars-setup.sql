-- Create a bucket for avatars if it doesn't exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

-- Set up Row Level Security (RLS) for the avatars bucket
-- Drop existing policies to avoid conflicts if they were partially created
DROP POLICY IF EXISTS "Public read for avatars" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated user insert for avatars" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated user update for avatars" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated user delete for avatars" ON storage.objects;

-- Allow public read access to everyone
CREATE POLICY "Public read for avatars" ON storage.objects FOR SELECT USING (bucket_id = 'avatars');

-- Allow authenticated users to upload their own avatar
CREATE POLICY "Authenticated user insert for avatars" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'avatars' AND auth.uid() = owner);

-- Allow authenticated users to update their own avatar
CREATE POLICY "Authenticated user update for avatars" ON storage.objects FOR UPDATE USING (bucket_id = 'avatars' AND auth.uid() = owner);

-- Allow authenticated users to delete their own avatar
CREATE POLICY "Authenticated user delete for avatars" ON storage.objects FOR DELETE USING (bucket_id = 'avatars' AND auth.uid() = owner);
