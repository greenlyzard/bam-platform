import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import type { Metadata } from "next";

const heading = { fontFamily: "'Cormorant Garamond', serif" } as const;

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const name = slug.split("-").map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
  return {
    title: `${name} | Ballet Academy and Movement`,
    description: `Learn more about ${name}, instructor at Ballet Academy and Movement in San Clemente, CA.`,
  };
}

export default async function PublicTeacherProfilePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const supabase = await createClient();

  // Parse slug: "first-last" or "first-last-name"
  const parts = slug.split("-");
  if (parts.length < 2) notFound();
  const firstName = parts[0];
  const lastName = parts.slice(1).join("-");

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, first_name, last_name, avatar_url, title, bio_short, bio_full, years_experience, education, social_instagram, social_linkedin")
    .ilike("first_name", firstName)
    .ilike("last_name", lastName)
    .single();
  if (!profile) notFound();

  // Verify active teacher role
  const { data: role } = await supabase
    .from("profile_roles")
    .select("id")
    .eq("user_id", profile.id)
    .eq("role", "teacher")
    .eq("is_active", true)
    .single();
  if (!role) notFound();

  const [discR, affR, photoR] = await Promise.all([
    supabase.from("teacher_disciplines").select("*, icon_library(*)").eq("teacher_id", profile.id).order("sort_order"),
    supabase.from("teacher_affiliations").select("*, icon_library(*)").eq("teacher_id", profile.id).order("sort_order"),
    supabase.from("teacher_photos").select("*").eq("teacher_id", profile.id).eq("is_active", true).order("sort_order"),
  ]);

  const disciplines = discR.data ?? [];
  const affiliations = affR.data ?? [];
  const photos = photoR.data ?? [];
  const companies = affiliations.filter((a: any) => a.affiliation_type === "company");
  const schools = affiliations.filter((a: any) => a.affiliation_type === "school");
  const intensives = affiliations.filter((a: any) => a.affiliation_type === "intensive");
  const specialties = disciplines.filter((d: any) => !d.is_certified);
  const certifications = disciplines.filter((d: any) => d.is_certified);
  const fullName = `${profile.first_name} ${profile.last_name}`;
  const initials = (profile.first_name?.[0] ?? "") + (profile.last_name?.[0] ?? "");

  return (
    <div className="min-h-screen bg-cream">
      {/* Back link */}
      <div className="max-w-5xl mx-auto px-4 pt-6">
        <a href="/teachers" className="text-sm text-lavender hover:text-lavender-dark transition-colors">&larr; All Teachers</a>
      </div>

      {/* Hero */}
      <section className="max-w-5xl mx-auto px-4 py-10 flex flex-col items-center text-center">
        <div className="w-48 h-48 md:w-64 md:h-64 rounded-full bg-lavender-light overflow-hidden flex items-center justify-center">
          {profile.avatar_url
            ? <img src={profile.avatar_url} alt={fullName} className="w-full h-full object-cover" />
            : <span className="text-6xl font-light text-lavender font-heading">{initials}</span>}
        </div>
        <h1 className="text-3xl md:text-4xl font-light text-charcoal mt-6 font-heading">{fullName}</h1>
        {profile.title && <p className="text-lg text-lavender mt-2">{profile.title}</p>}
        {profile.bio_short && <p className="text-mist mt-3 max-w-2xl leading-relaxed">{profile.bio_short}</p>}
      </section>

      {/* Divider */}
      <div className="text-center py-4">
        <p className="text-mist italic text-sm">Dedicated to the joy of dance &amp; movement</p>
      </div>

      <div className="max-w-5xl mx-auto px-4 space-y-12 pb-20">
        {/* Bio */}
        {profile.bio_full && (
          <section>
            <p className="text-charcoal leading-relaxed whitespace-pre-line">{profile.bio_full}</p>
            {profile.years_experience && (
              <p className="text-sm text-mist mt-4"><span className="text-charcoal font-medium">{profile.years_experience}+</span> years of teaching experience</p>
            )}
          </section>
        )}

        {/* Professional Experience */}
        {companies.length > 0 && <AffSection title="Professional Experience" items={companies} />}

        {/* Training & Education */}
        {schools.length > 0 && <AffSection title="Training &amp; Education" items={schools} />}

        {/* Summer Intensives */}
        {intensives.length > 0 && (
          <section>
            <h2 className="text-2xl font-light text-charcoal mb-4 font-heading">Summer Intensives</h2>
            <div className="flex flex-wrap gap-4">
              {intensives.map((item: any) => (
                <div key={item.id} className="flex items-center gap-3 bg-white border border-silver rounded-xl px-4 py-3">
                  <IconCircle url={item.icon_library?.icon_url} alt={item.name} size={48} />
                  <div>
                    <span className="text-sm text-charcoal font-medium">{item.name}</span>
                    {(item.location || item.years) && (
                      <p className="text-[10px] text-mist">{[item.location, item.years].filter(Boolean).join(" | ")}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Specialties */}
        {specialties.length > 0 && (
          <section>
            <h2 className="text-2xl font-light text-charcoal mb-4 font-heading">Specialties</h2>
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-4">
              {specialties.map((d: any) => (
                <div key={d.id} className="flex flex-col items-center text-center gap-2">
                  <IconCircle url={d.icon_library?.icon_url} alt={d.name} size={48} />
                  <span className="text-xs text-charcoal">{d.name}</span>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Certified Instructor */}
        {certifications.length > 0 && (
          <section>
            <h2 className="text-2xl font-light text-charcoal mb-4 font-heading">Certified Instructor</h2>
            <div className="flex flex-wrap gap-4">
              {certifications.map((d: any) => (
                <div key={d.id} className="flex items-center gap-3 bg-white border border-silver rounded-xl px-4 py-3">
                  <IconCircle url={d.icon_library?.icon_url} alt={d.name} size={40} />
                  <span className="text-sm text-charcoal font-medium">{d.name}</span>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Photo Gallery */}
        {photos.length > 0 && (
          <section>
            <h2 className="text-2xl font-light text-charcoal mb-4 font-heading">Gallery</h2>
            <div className="columns-2 md:columns-3 gap-3 space-y-3">
              {photos.map((p: any) => (
                <div key={p.id} className="break-inside-avoid">
                  <img src={p.photo_url} alt={p.caption ?? fullName} className="w-full rounded-lg" />
                  {p.caption && <p className="text-xs text-mist mt-1 text-center">{p.caption}</p>}
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Social links */}
        {(profile.social_instagram || profile.social_linkedin) && (
          <div className="flex gap-4 justify-center pt-4">
            {profile.social_instagram && (
              <a href={`https://instagram.com/${profile.social_instagram.replace(/^@/, "")}`} target="_blank" rel="noopener noreferrer"
                className="text-sm text-lavender hover:text-lavender-dark transition-colors">Instagram</a>
            )}
            {profile.social_linkedin && (
              <a href={profile.social_linkedin.startsWith("http") ? profile.social_linkedin : `https://linkedin.com/in/${profile.social_linkedin}`} target="_blank" rel="noopener noreferrer"
                className="text-sm text-lavender hover:text-lavender-dark transition-colors">LinkedIn</a>
            )}
          </div>
        )}

        {/* Footer */}
        <footer className="border-t border-silver pt-8 text-center text-sm text-mist">
          Ballet Academy and Movement &middot; San Clemente, CA
        </footer>
      </div>
    </div>
  );
}

function IconCircle({ url, alt, size }: { url?: string | null; alt: string; size: number }) {
  const px = `${size}px`;
  return (
    <div className="rounded-full bg-lavender-light overflow-hidden flex items-center justify-center" style={{ width: px, height: px }}>
      {url ? <img src={url} alt={alt} className="w-full h-full object-cover rounded-full" /> : <span className="text-sm font-medium text-lavender">{alt.charAt(0)}</span>}
    </div>
  );
}

function AffSection({ title, items }: { title: string; items: any[] }) {
  return (
    <section>
      <h2 className="text-2xl font-light text-charcoal mb-4 font-heading" dangerouslySetInnerHTML={{ __html: title }} />
      <div className="flex gap-6 overflow-x-auto pb-2">
        {items.map((item: any) => (
          <div key={item.id} className="flex flex-col items-center text-center min-w-[80px]">
            <IconCircle url={item.icon_library?.icon_url} alt={item.name} size={48} />
            <span className="text-xs text-charcoal mt-2 leading-tight">{item.name}</span>
            {(item.role || item.years) && <span className="text-[10px] text-mist leading-tight">{[item.role, item.years].filter(Boolean).join(" | ")}</span>}
          </div>
        ))}
      </div>
    </section>
  );
}
