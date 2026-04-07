# Staff Resource Library — Spec

**Status:** Ready for implementation  
**Phase:** 2 — Internal Operations  
**Related Modules:** TEACHER_PORTAL.md, SAAS.md, MODULES.md  
**Source:** DMP competitive gap analysis, April 2026

---

## 1. Overview

The Staff Resource Library is an internal document store accessible to admin and teaching staff. It replaces ad-hoc Google Drive folder sharing with a structured, searchable, permission-controlled repository built into the BAM Platform.

At launch, Amanda's syllabi, technique progression guides, dress code documents, teacher handbooks, mandated reporter training materials, and class music playlists all live outside the platform. This module centralizes them.

**This is not a parent-facing or student-facing feature.** It is strictly internal.

---

## 2. Access Control

| Role | Access |
|---|---|
| Super Admin / Admin | Full CRUD — create folders, upload, delete, manage permissions |
| Lead Teachers | Read access to `all_staff` and `lead_teachers_only` folders |
| All Teachers | Read access to `all_staff` folders only |
| Parents / Students | No access |

---

## 3. Document Types Supported

| Type | Description | Storage |
|---|---|---|
| `pdf` | Syllabi, policy docs, certificates, handbooks | Supabase Storage |
| `google_drive` | Google Docs/Sheets/Slides links | External URL stored |
| `video_link` | YouTube, Vimeo, or Cloudflare Stream link | External URL stored |
| `text_note` | Plain markdown note (inline content) | Stored in DB |
| `music_link` | Spotify playlist, Apple Music, YouTube Music | External URL stored |

---

## 4. Folder Structure — BAM Default Seed

On tenant provisioning, seed these default folders:

```
Studio Policies (all_staff)
  ├── Teacher Handbook
  ├── Dress Code
  ├── Makeup Policy
  └── Mandated Reporter Protocol

Curriculum Guides (lead_teachers_only)
  ├── Pre-Ballet / Level 1
  ├── Level 2A / 2B / 2C
  ├── Level 3A / 3B / 3C
  └── Level 4 / Company

Class Music (all_staff)
  ├── Pre-Ballet Playlists
  ├── Level 1–2 Playlists
  └── Company / Level 3–4 Playlists

Teaching Resources (all_staff)
  ├── Technique Videos
  ├── Exercise Sequences
  └── Assessment Templates

Mandated Reporter Training (all_staff)
  └── California Mandated Reporter Certificate Template

Performance Materials (lead_teachers_only)
  ├── Nutcracker
  └── Spring Showcase
```

---

## 5. Database Schema

```sql
CREATE TABLE IF NOT EXISTS staff_library_folders (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        uuid NOT NULL REFERENCES tenants(id),
  name             text NOT NULL,
  description      text,
  parent_folder_id uuid REFERENCES staff_library_folders(id),
  access_level     text NOT NULL DEFAULT 'all_staff'
    CHECK (access_level IN ('all_staff','admin_only','lead_teachers_only')),
  sort_order       integer DEFAULT 0,
  is_active        boolean DEFAULT true,
  created_at       timestamptz DEFAULT now(),
  updated_at       timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS staff_library_documents (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        uuid NOT NULL REFERENCES tenants(id),
  folder_id        uuid REFERENCES staff_library_folders(id),
  title            text NOT NULL,
  description      text,
  document_type    text NOT NULL
    CHECK (document_type IN ('pdf','google_drive','video_link','text_note','music_link')),
  file_url         text,             -- Supabase Storage path OR external URL
  file_size_bytes  integer,
  content_text     text,             -- for text_note type only
  version          integer DEFAULT 1,
  is_active        boolean DEFAULT true,
  uploaded_by      uuid REFERENCES profiles(id),
  created_at       timestamptz DEFAULT now(),
  updated_at       timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS staff_library_document_versions (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id      uuid NOT NULL REFERENCES staff_library_documents(id) ON DELETE CASCADE,
  tenant_id        uuid NOT NULL REFERENCES tenants(id),
  version          integer NOT NULL,
  file_url         text,
  uploaded_by      uuid REFERENCES profiles(id),
  created_at       timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_library_folders_tenant   ON staff_library_folders(tenant_id);
CREATE INDEX IF NOT EXISTS idx_library_documents_tenant ON staff_library_documents(tenant_id);
CREATE INDEX IF NOT EXISTS idx_library_documents_folder ON staff_library_documents(folder_id);
```

### RLS
- Admin/Super Admin: full CRUD on all rows scoped to `tenant_id`
- Teachers: SELECT only, with `access_level` check:
  ```sql
  -- Lead teacher policy
  CREATE POLICY "lead_teachers_library_read" ON staff_library_documents
    FOR SELECT USING (
      is_teacher() AND
      (SELECT access_level FROM staff_library_folders WHERE id = folder_id)
        IN ('all_staff', 'lead_teachers_only')
    );
  
  -- All teacher policy
  CREATE POLICY "teachers_library_read" ON staff_library_documents
    FOR SELECT USING (
      is_teacher() AND
      (SELECT access_level FROM staff_library_folders WHERE id = folder_id) = 'all_staff'
    );
  ```

---

## 6. UI

### Admin View — `/admin/resources/library`
- Left sidebar: folder tree with access level badges
- Main area: document list for selected folder
- Per document: title, type badge, uploaded date, uploader, file size, Download + Edit + Delete actions
- "+ New Folder" and "+ Upload Document" buttons
- Version history accessible via document detail modal

### Teacher View — `/teach/library`
- Same folder tree but access-filtered — admin_only folders not shown
- Read-only — no upload, no delete
- Download button for PDFs
- Preview panel for text_note type (inline markdown render)
- Link opens externally for google_drive / video_link / music_link

---

## 7. Search

Full-text search across document `title` and `description` within the teacher's accessible folders.

```sql
-- Add GIN index for search
CREATE INDEX IF NOT EXISTS idx_library_documents_search
  ON staff_library_documents
  USING GIN(to_tsvector('english', title || ' ' || COALESCE(description, '')));
```

---

## 8. API Routes

| Method | Route | Auth | Description |
|---|---|---|---|
| GET | `/api/library/folders` | Teacher+ | List folders (access-filtered) |
| POST | `/api/library/folders` | Admin+ | Create folder |
| GET | `/api/library/folders/[id]/documents` | Teacher+ | List documents in folder |
| POST | `/api/library/documents` | Admin+ | Upload/create document |
| GET | `/api/library/documents/[id]` | Teacher+ | Get document detail |
| PATCH | `/api/library/documents/[id]` | Admin+ | Update document metadata |
| DELETE | `/api/library/documents/[id]` | Admin+ | Soft-delete (is_active = false) |
| GET | `/api/library/search?q=` | Teacher+ | Search across accessible documents |

---

## 9. Build Notes for Claude Code

Build order:
1. Migration — `staff_library_folders`, `staff_library_documents`, `staff_library_document_versions`
2. Seed — BAM default folder structure on `supabase/seed.sql`
3. Admin UI at `/admin/resources/library` — folder tree + document list + upload
4. Teacher UI at `/teach/library` — read-only filtered view
5. Search endpoint + UI
6. Add "Library" link to teacher portal nav (secondary section, below Schedule)

Storage bucket: `staff-library` (private — admin uploads, signed URLs for teacher access)
