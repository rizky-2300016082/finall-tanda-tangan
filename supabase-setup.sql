
-- Create documents table
CREATE TABLE documents (
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

-- Create indexes for better performance
CREATE INDEX documents_sender_id_idx ON documents(sender_id);
CREATE INDEX documents_public_link_idx ON documents(public_link);
CREATE INDEX documents_status_idx ON documents(status);

-- Enable Row Level Security
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;

-- Create policies for documents table
CREATE POLICY "Users can view their own documents" ON documents
  FOR SELECT USING (auth.uid() = sender_id);

CREATE POLICY "Users can insert their own documents" ON documents
  FOR INSERT WITH CHECK (auth.uid() = sender_id);

CREATE POLICY "Users can update their own documents" ON documents
  FOR UPDATE USING (auth.uid() = sender_id);

CREATE POLICY "Anyone can view documents with public link" ON documents
  FOR SELECT USING (public_link IS NOT NULL AND status IN ('sent', 'signed'));

CREATE POLICY "Anyone can update documents for signing" ON documents
  FOR UPDATE USING (public_link IS NOT NULL AND status = 'sent');

CREATE POLICY "Delete own documents" ON documents
  FOR DELETE USING (auth.uid() = sender_id);

-- Create storage bucket for documents
INSERT INTO storage.buckets (id, name, public) VALUES ('documents', 'documents', false);

-- Create storage policies
CREATE POLICY "Authenticated users can upload documents" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'documents' AND auth.role() = 'authenticated');

CREATE POLICY "Users can view documents they own" ON storage.objects
  FOR SELECT USING (bucket_id = 'documents' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Anyone can view signed documents" ON storage.objects
  FOR SELECT USING (bucket_id = 'documents' AND (storage.foldername(name))[1] = 'signed');

CREATE POLICY "System can upload signed documents" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'documents' AND (storage.foldername(name))[1] = 'signed');
