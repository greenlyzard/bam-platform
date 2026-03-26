import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import Link from "next/link";

const heading = { fontFamily: "'Cormorant Garamond', serif" } as const;

export default async function PublicTeacherProfilePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const supabase = await createClient();

  // Parse slug: "first-last" -> first_name / last_name
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

  // Verify active teacher
  const { data: tp } = await supabase.from("teacher_profiles").select("id, is_active").eq("id", profile.id).eq("is_active", true).single();
  if (!tp) notFound();

  const [discR, affR, photoR, classR] = await Promise.all([
    supabase.from("teacher_disciplines").select("*, icon_library(*)").eq("teacher_id", profile.id).order("sort_order"),
    supabase.from("teacher_affiliations").select("*, icon_library(*)").eq("teacher_id", profile.id).order("sort_order"),
    supabase.from("teacher_photos").select("*").eq("teacher_id", profile.id).eq("is_active", true).order("sort_order"),
    supabase.from("class_teachers").select("id", { count: "exact", head: true }).eq("teacher_id", profile.id),
  ]);

  const disciplines = discR.data ?? [];
  const affiliations = affR.data ?? [];
  const photos = photoR.data ?? [];
  const classCount = classR.count ?? 0;
  const companies = affiliations.filter((a: any) => a.affiliation_type === "company");
  const schools = affiliations.filter((a: any) => a.affiliation_type === "school");
  const intensives = affiliations.filter((a: any) => a.affiliation_type === "intensive");
  const certifications = disciplines.filter((d: any) => d.is_certified);
  const fullName = `${profile.first_name} ${profile.last_name}`;
  const initials = (profile.first_name?.[0] ?? "") + (profile.last_name?.[0] ?? "");

  return (
    <div className="min-h-screen bg-cream">
      <div className="max-w-5xl mx-auto px-4 pt-6">
        <Link href="/teachers" className="text-sm text-lavender hover:text-lavender-dark transition-colors">&larr; All Teachers</Link>
      </div>

      {/* Hero */}
      <section className="max-w-5xl mx-auto px-4 py-10 flex flex-col md:flex-row gap-8 items-center md:items-start">
        <div className="w-full md:w-1/2 aspect-square rounded-2xl bg-lavender-light overflow-hidden flex-shrink-0 flex items-center justify-center">
          {profile.avatar_url
            ? <img src={profile.avatar_url} alt={fullName} className="w-full h-full object-cover" />
            : <span className="text-6xl font-light text-lavender" style={heading}>{initials}</span>}
        </div>
        <div className="flex-1 text-center md:text-left">
          <h1 className="text-4xl md:text-5xl font-light text-charcoal" style={heading}>{fullName}</h1>
          {profile.title && <p className="text-lg text-lavender mt-2">{profile.title}</p>}
          {profile.bio_short && !profile.bio_full && <p className="text-mist mt-4 leading-relaxed">{profile.bio_short}</p>}
        </div>
      </section>

      <div className="max-w-5xl mx-auto px-4 space-y-12 pb-20">
        {profile.bio_full && <section><p className="text-charcoal leading-relaxed whitespace-pre-line">{profile.bio_full}</p></section>}

        {companies.length > 0 && <AffSection title="Professional Experience" items={companies} />}
        {schools.length > 0 && <AffSection title="Training &amp; Education" items={schools} />}
        {intensives.length > 0 && <AffSection title="Summer Intensives" items={intensives} />}

        {/* Specialties */}
        {disciplines.length > 0 && (
          <section>
            <h2 className="text-2xl font-light text-charcoal mb-4" style={heading}>Specialties</h2>
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-4">
              {disciplines.map((d: any) => {
                const ic = d.icon_library;
                return (
                  <div key={d.id} className="flex flex-col items-center text-center gap-2">
                    <IconCircle url={ic?.icon_url} alt={d.name} size={48} />
                    <span className="text-xs text-charcoal">{d.name}</span>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* Certifications */}
        {certifications.length > 0 && (
          <section>
            <h2 className="text-2xl font-light text-charcoal mb-4" style={heading}>Certified Instructor</h2>
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
            <h2 className="text-2xl font-light text-charcoal mb-4" style={heading}>Gallery</h2>
            <div className="columns-2 md:columns-3 gap-4 space-y-4">
              {photos.map((p: any) => (
                <div key={p.id} className="break-inside-avoid">
                  <img src={p.photo_url} alt={p.caption ?? fullName} className="w-full rounded-lg" />
                  {p.caption && <p className="text-xs text-mist mt-1 text-center">{p.caption}</p>}
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Footer */}
        <footer className="border-t border-silver pt-8 flex flex-wrap gap-6 text-sm text-mist">
          {profile.years_experience && <div><span className="text-charcoal font-medium">{profile.years_experience}+</span> years experience</div>}
          {classCount > 0 && <div><span className="text-charcoal font-medium">{classCount}</span> classes taught</div>}
          {profile.education && <div>{profile.education}</div>}
          {profile.social_instagram && (
            <a href={`https://instagram.com/${profile.social_instagram.replace(/^@/, "")}`} target="_blank" rel="noopener noreferrer" className="text-lavender hover:text-lavender-dark transition-colors">Instagram</a>
          )}
          {profile.social_linkedin && (
            <a href={profile.social_linkedin.startsWith("http") ? profile.social_linkedin : `https://linkedin.com/in/${profile.social_linkedin}`} target="_blank" rel="noopener noreferrer" className="text-lavender hover:text-lavender-dark transition-colors">LinkedIn</a>
          )}
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
      <h2 className="text-2xl font-light text-charcoal mb-4" style={heading} dangerouslySetInnerHTML={{ __html: title }} />
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
