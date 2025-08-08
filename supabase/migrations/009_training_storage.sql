-- Create storage bucket for training images
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'training-images',
  'training-images',
  true,
  10485760, -- 10MB limit
  ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
);

-- Set up RLS policies for training images bucket
CREATE POLICY "Users can upload their own training images"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'training-images' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can view their own training images"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'training-images' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can delete their own training images"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'training-images' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Enable RLS on storage.objects
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;