-- Create the spaces table for storing cognitive spaces as JSONB documents

CREATE TABLE spaces (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT,
    data JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add indexes for common queries
CREATE INDEX spaces_data_gin ON spaces USING GIN (data);
CREATE INDEX spaces_created_at_idx ON spaces (created_at DESC);
CREATE INDEX spaces_updated_at_idx ON spaces (updated_at DESC);

-- Create a trigger to automatically update updated_at column
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_spaces_updated_at
    BEFORE UPDATE ON spaces
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Add a comment describing the table
COMMENT ON TABLE spaces IS 'Cognitive spaces stored as JSON documents with metadata';
COMMENT ON COLUMN spaces.data IS 'The cognitive space structure (thoughts, relationships, etc.) as JSONB';