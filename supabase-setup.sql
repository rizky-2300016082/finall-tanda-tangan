
-- Create documents table only if it doesn't exist
CREATE TABLE IF NOT EXISTS documents (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  filename text NOT NULL,
  file_path text NOT NULL,
  signed_file_path text,
  sender_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  recipient_email text,
  signature_areas jsonb,
  public_link text UNIQUE,
  status text DEFAULT 'pending_setup' CHECK (status IN ('pending_setup', 'sent', 'signed')),
  created_at timestamp with time zone DEFAULT now(),
  signed_at timestamp with time zone
);

-- Create contacts table
CREATE TABLE IF NOT EXISTS contacts (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    email TEXT,
    phone TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(user_id, email)
);

-- Create indexes for better performance (only if they don't exist)
CREATE INDEX IF NOT EXISTS documents_sender_id_idx ON documents(sender_id);
CREATE INDEX IF NOT EXISTS documents_public_link_idx ON documents(public_link);
CREATE INDEX IF NOT EXISTS documents_status_idx ON documents(status);
CREATE INDEX IF NOT EXISTS contacts_user_id_idx ON contacts(user_id);


-- Enable Row Level Security
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;


-- Drop existing policies if they exist to avoid conflicts
DROP POLICY IF EXISTS "Users can view their own documents" ON documents;
DROP POLICY IF EXISTS "Users can insert their own documents" ON documents;
DROP POLICY IF EXISTS "Users can update their own documents" ON documents;
DROP POLICY IF EXISTS "Public access to documents with valid link" ON documents;
DROP POLICY IF EXISTS "Public update for signing documents" ON documents;
DROP POLICY IF EXISTS "Delete own documents" ON documents;
DROP POLICY IF EXISTS "Allow anon signers to update document status and signed path" ON documents;

DROP POLICY IF EXISTS "Users can view their own contacts" ON contacts;
DROP POLICY IF EXISTS "Users can insert their own contacts" ON contacts;
DROP POLICY IF EXISTS "Users can update their own contacts" ON contacts;
DROP POLICY IF EXISTS "Users can delete their own contacts" ON contacts;


-- Create policies for documents table
CREATE POLICY "Users can view their own documents" ON documents
  FOR SELECT USING (auth.uid() = sender_id);

CREATE POLICY "Users can insert their own documents" ON documents
  FOR INSERT WITH CHECK (auth.uid() = sender_id);

CREATE POLICY "Users can update their own documents" ON documents
  FOR UPDATE USING (auth.uid() = sender_id);

CREATE POLICY "Public access to documents with valid link" ON documents
  FOR SELECT USING (public_link IS NOT NULL AND public_link != '');

CREATE POLICY "Allow anon signers to update document status and signed path"
ON documents
FOR UPDATE
TO anon
USING (
    public_link IS NOT NULL AND
    public_link != '' AND
    status IN ('pending_setup', 'sent')
);

CREATE POLICY "Delete own documents" ON documents
  FOR DELETE USING (auth.uid() = sender_id);


-- Create policies for contacts table
CREATE POLICY "Users can view their own contacts" ON contacts
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own contacts" ON contacts
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own contacts" ON contacts
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own contacts" ON contacts
  FOR DELETE USING (auth.uid() = user_id);

-- Create storage bucket for documents (only if it doesn't exist)
INSERT INTO storage.buckets (id, name, public) 
VALUES ('documents', 'documents', false)
ON CONFLICT (id) DO NOTHING;

-- Drop existing storage policies if they exist to avoid conflicts
DROP POLICY IF EXISTS "Authenticated users can upload documents" ON storage.objects;
DROP POLICY IF EXISTS "Users can view their own document files" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own document files" ON storage.objects;
DROP POLICY IF EXISTS "Public download of signed documents" ON storage.objects;
DROP POLICY IF EXISTS "Allow anon upload of signed documents" ON storage.objects;

-- Create storage policies
CREATE POLICY "Authenticated users can upload documents" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'documents' AND auth.role() = 'authenticated');

CREATE POLICY "Users can view their own document files" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'documents' AND
    EXISTS (
      SELECT 1 FROM public.documents d
      WHERE (d.file_path = name OR d.signed_file_path = name) AND d.sender_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete their own document files" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'documents' AND
    EXISTS (
      SELECT 1 FROM public.documents d
      WHERE (d.file_path = name OR d.signed_file_path = name) AND d.sender_id = auth.uid()
    )
  );

CREATE POLICY "Public download of signed documents" ON storage.objects
  FOR SELECT
  USING (
    bucket_id = 'documents' AND
    EXISTS (
      SELECT 1 FROM public.documents d
      WHERE d.signed_file_path = name AND d.status = 'signed'
    )
  );

-- TEMPORARY DEBUGGING POLICY for anon uploads. This is less secure.
CREATE POLICY "Allow anon upload of signed documents"
ON storage.objects
FOR INSERT
TO anon
WITH CHECK ( bucket_id = 'documents' );
