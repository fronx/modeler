# Database Setup Guide

This guide covers setting up the local PostgreSQL database for Modeler's cognitive spaces.

## Prerequisites

- **Docker Desktop** - Required for running local Supabase
- **Supabase CLI** - Already installed globally (`npm install -g supabase`)

## Quick Start

```bash
# 1. Start Docker Desktop (if not running)
open -a Docker

# 2. Start local Supabase stack
supabase start

# 3. Apply database migrations
supabase db reset
```

That's it! Your local database is ready with the cognitive spaces schema.

## Database Connection Details

Once running, you can connect to your local PostgreSQL database:

```
Host: 127.0.0.1
Port: 54322
Database: postgres
Username: postgres
Password: postgres

Connection String: postgresql://postgres:postgres@127.0.0.1:54322/postgres
```

## Database Schema

### Spaces Table

The core table for storing cognitive spaces as JSON documents:

```sql
CREATE TABLE spaces (
    id TEXT PRIMARY KEY,                    -- Unique space identifier
    title TEXT NOT NULL,                    -- Human-readable space name
    description TEXT,                       -- Optional description
    data JSONB NOT NULL,                    -- The cognitive space structure
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

**Key Features:**
- **JSONB Storage**: Flexible JSON storage with indexing
- **GIN Indexes**: Fast querying of JSON structure and content
- **Auto Timestamps**: Automatic `created_at` and `updated_at` tracking
- **Primary Key**: Text-based IDs (matching existing space naming)

## Migration System

### Creating New Migrations

```bash
# Create a new migration file
supabase migration new migration_name

# Edit the generated file in supabase/migrations/
# Example: supabase/migrations/20250918093447_create_spaces_table.sql
```

### Applying Migrations

**For Development:**
```bash
supabase db reset  # Resets database and applies all migrations
```

**For Production (when we deploy):**
```bash
supabase db push   # Applies pending migrations to linked project
```

### Migration Files

All migration files are stored in `supabase/migrations/` and tracked in Git:

```
supabase/migrations/
└── 20250918093447_create_spaces_table.sql  # Initial spaces table
```

## Fresh Installation Setup

Anyone can recreate the database from scratch:

```bash
# 1. Clone the repository
git clone <repository-url>
cd modeler

# 2. Start Docker Desktop
open -a Docker

# 3. Initialize and start Supabase
supabase start

# 4. Apply all migrations
supabase db reset
```

The database will be created with the exact same schema as the original development environment.

## Troubleshooting

### Docker Issues

If you get "Docker daemon not running":
```bash
# Start Docker Desktop
open -a Docker
# Wait for Docker to fully start, then retry
```

### Supabase Service Issues

If some services show as "Stopped":
```bash
# Check status
supabase status

# The database itself runs even if other services are stopped
# You only need the database (port 54322) for basic functionality
```

### Database Connection Issues

If you can't connect to the database:
```bash
# Check if Supabase is running
supabase status

# Should show:
# DB URL: postgresql://postgres:postgres@127.0.0.1:54322/postgres
```

### Migration Issues

If migrations fail:
```bash
# Reset everything and start fresh
supabase db reset

# This will:
# 1. Drop the database
# 2. Recreate it
# 3. Apply all migrations in order
```

## Next Steps

Once the database is running:

1. **Build API endpoints** to interact with the `spaces` table
2. **Create JSON schema validation** for cognitive space data
3. **Connect the Next.js dashboard** to the database
4. **Migrate existing file-based spaces** to database storage

---

*This setup provides a solid foundation for the database-driven cognitive modeling system while maintaining simplicity for local development.*