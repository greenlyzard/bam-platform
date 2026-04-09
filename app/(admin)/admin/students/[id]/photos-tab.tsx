"use client";

import { useEffect, useRef, useState } from "react";

interface Photo {
  name: string;
  path: string;
  url: string;
  created_at: string | null;
}

interface Album {
  id: string;
  label: string;
  album_url: string;
}

export function PhotosTab({
  studentId,
  initialAvatarUrl,
}: {
  studentId: string;
  initialAvatarUrl: string | null;
}) {
  const [avatarUrl, setAvatarUrl] = useState<string | null>(initialAvatarUrl);
  const [uploading, setUploading] = useState(false);
  const headshotRef = useRef<HTMLInputElement>(null);
  const studioRef = useRef<HTMLInputElement>(null);

  const [photos, setPhotos] = useState<Photo[]>([]);
  const [photosLoading, setPhotosLoading] = useState(true);
  const [albums, setAlbums] = useState<Album[]>([]);
  const [newAlbumLabel, setNewAlbumLabel] = useState("");
  const [newAlbumUrl, setNewAlbumUrl] = useState("");

  useEffect(() => {
    fetch(`/api/admin/students/${studentId}/photos`)
      .then((r) => r.json())
      .then((d) => setPhotos(d.photos ?? []))
      .finally(() => setPhotosLoading(false));

    fetch(`/api/admin/students/${studentId}/google-albums`)
      .then((r) => r.json())
      .then((d) => setAlbums(d.albums ?? []));
  }, [studentId]);

  async function uploadHeadshot(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch(`/api/admin/students/${studentId}/avatar`, {
      method: "POST",
      body: fd,
    });
    const data = await res.json();
    if (data.url) setAvatarUrl(data.url);
    setUploading(false);
  }

  async function uploadStudioPhotos(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files?.length) return;
    setUploading(true);
    for (const file of Array.from(files)) {
      const fd = new FormData();
      fd.append("file", file);
      await fetch(`/api/admin/students/${studentId}/photos`, {
        method: "POST",
        body: fd,
      });
    }
    const res = await fetch(`/api/admin/students/${studentId}/photos`);
    const d = await res.json();
    setPhotos(d.photos ?? []);
    setUploading(false);
  }

  async function deletePhoto(path: string) {
    await fetch(
      `/api/admin/students/${studentId}/photos?path=${encodeURIComponent(path)}`,
      { method: "DELETE" }
    );
    setPhotos((prev) => prev.filter((p) => p.path !== path));
  }

  async function addAlbum() {
    if (!newAlbumLabel.trim() || !newAlbumUrl.trim()) return;
    const res = await fetch(`/api/admin/students/${studentId}/google-albums`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ label: newAlbumLabel.trim(), album_url: newAlbumUrl.trim() }),
    });
    const json = await res.json();
    if (json.album) {
      setAlbums((prev) => [...prev, json.album]);
      setNewAlbumLabel("");
      setNewAlbumUrl("");
    }
  }

  async function deleteAlbum(id: string) {
    await fetch(`/api/admin/students/${studentId}/google-albums?album_id=${id}`, {
      method: "DELETE",
    });
    setAlbums((prev) => prev.filter((a) => a.id !== id));
  }

  return (
    <div className="space-y-8">
      {/* Headshot */}
      <section className="rounded-xl border border-silver bg-white p-5">
        <h2 className="font-heading text-lg text-charcoal">Headshot</h2>
        <p className="mb-4 text-sm text-slate">
          Used on profile, attendance roster, and class lists.
        </p>
        <div className="flex items-center gap-5">
          <div className="h-28 w-28 overflow-hidden rounded-full border-2 border-silver bg-cloud">
            {avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={avatarUrl} alt="Headshot" className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-xs text-mist">
                No photo
              </div>
            )}
          </div>
          <div>
            <input
              ref={headshotRef}
              type="file"
              accept="image/*"
              onChange={uploadHeadshot}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => headshotRef.current?.click()}
              disabled={uploading}
              className="h-12 rounded-lg bg-lavender px-5 text-sm font-semibold text-white hover:bg-lavender-dark disabled:opacity-50"
            >
              {uploading ? "Uploading…" : avatarUrl ? "Replace Headshot" : "Upload Headshot"}
            </button>
            <p className="mt-2 text-xs text-mist">JPEG/PNG · Max 2MB</p>
          </div>
        </div>
      </section>

      {/* Studio photos */}
      <section className="rounded-xl border border-silver bg-white p-5">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="font-heading text-lg text-charcoal">Studio Photos</h2>
            <p className="text-sm text-slate">Recital, comp, and class photos.</p>
          </div>
          <input
            ref={studioRef}
            type="file"
            accept="image/*"
            multiple
            onChange={uploadStudioPhotos}
            className="hidden"
          />
          <button
            type="button"
            onClick={() => studioRef.current?.click()}
            disabled={uploading}
            className="h-10 rounded-lg border border-silver bg-white px-4 text-sm font-semibold text-charcoal hover:bg-cloud disabled:opacity-50"
          >
            + Upload
          </button>
        </div>

        {photosLoading ? (
          <p className="text-xs text-mist">Loading…</p>
        ) : photos.length === 0 ? (
          <p className="text-sm text-mist">No studio photos yet.</p>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
            {photos.map((p) => (
              <div key={p.path} className="group relative overflow-hidden rounded-lg border border-silver">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p.url} alt="" className="aspect-square w-full object-cover" />
                <button
                  type="button"
                  onClick={() => deletePhoto(p.path)}
                  className="absolute right-1 top-1 rounded-full bg-charcoal/70 px-2 py-0.5 text-xs text-white opacity-0 transition-opacity group-hover:opacity-100"
                >
                  Delete
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Google Photos albums */}
      <section className="rounded-xl border border-silver bg-white p-5">
        <h2 className="font-heading text-lg text-charcoal">Google Photos Albums</h2>
        <p className="mb-4 text-sm text-slate">
          Paste a Google Photos shared album link.
        </p>

        <div className="mb-4 grid gap-2 sm:grid-cols-[1fr_2fr_auto]">
          <input
            type="text"
            placeholder="Album label (e.g. Nutcracker 2025)"
            value={newAlbumLabel}
            onChange={(e) => setNewAlbumLabel(e.target.value)}
            className="h-12 rounded-md border border-silver bg-white px-3 text-base text-charcoal focus:border-lavender focus:outline-none focus:ring-2 focus:ring-lavender/20"
          />
          <input
            type="url"
            placeholder="https://photos.google.com/share/…"
            value={newAlbumUrl}
            onChange={(e) => setNewAlbumUrl(e.target.value)}
            className="h-12 rounded-md border border-silver bg-white px-3 text-base text-charcoal focus:border-lavender focus:outline-none focus:ring-2 focus:ring-lavender/20"
          />
          <button
            type="button"
            onClick={addAlbum}
            className="h-12 rounded-lg bg-lavender px-4 text-sm font-semibold text-white hover:bg-lavender-dark"
          >
            Add
          </button>
        </div>

        {albums.length === 0 ? (
          <p className="text-sm text-mist">No albums linked.</p>
        ) : (
          <ul className="space-y-2">
            {albums.map((a) => (
              <li
                key={a.id}
                className="flex items-center justify-between rounded-lg border border-silver bg-cloud/30 p-3"
              >
                <a
                  href={a.album_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="min-w-0 flex-1 truncate text-sm font-medium text-lavender-dark hover:underline"
                >
                  {a.label}
                </a>
                <button
                  type="button"
                  onClick={() => deleteAlbum(a.id)}
                  className="text-xs text-slate hover:text-error"
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
