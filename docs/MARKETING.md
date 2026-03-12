# BAM Platform — Marketing System

## Overview

The BAM marketing system has three layers:
1. **Acquire** — get found (SEO, ads, social, word of mouth)
2. **Convert** — turn visitors into enrolled students (funnel, trial class, follow-up)
3. **Retain** — keep families for years (communication, experience, community)

---

## 1. Local SEO System

### Target Keywords (Priority Order)

| Keyword | Monthly Volume (Est.) | Intent | Page |
|---------|-----------------------|--------|------|
| ballet classes san clemente | 200-400 | High | /ballet-classes-san-clemente |
| ballet classes near me | High (local) | High | Homepage |
| ballet for toddlers san clemente | 100-200 | Very High | /ballet-classes-san-clemente |
| ballet laguna niguel | 100-200 | High | /ballet-classes-laguna-niguel |
| ballet dana point | 50-150 | High | /ballet-classes-dana-point |
| ballet ladera ranch | 100-200 | High | /ballet-classes-ladera-ranch |
| ballet san juan capistrano | 100-200 | High | /ballet-classes-san-juan-capistrano |
| ballet mission viejo | 200-400 | High | /ballet-classes-mission-viejo |
| ballet classes for 3 year old | 500+ | Very High | /pre-ballet |
| when should child start ballet | 1,000+ | Educational | Blog post |
| benefits of ballet for kids | 2,000+ | Educational | Blog post |
| ballet vs dance class | 500+ | Educational | Blog post |

### Landing Page Template (Per City)

Each city page follows this structure (never deviate):

```
H1: Ballet Classes in [City], CA — Ballet Academy and Movement

Hero section:
- Headline: Real ballet training for children in [City]
- Subhead: Small classes. Professional instruction. Nurturing environment.
- CTA: Book a Free Trial Class

Section 1: Programs (Ballet first, then jazz/contemporary/musical theatre)
Section 2: About Amanda (founder credibility)
Section 3: Why BAM (class size, credentials, culture)
Section 4: What Parents Say (testimonials)
Section 5: FAQ (city-specific where possible)
Section 6: Location + contact info

Schema: LocalBusiness, FAQPage, BreadcrumbList
```

### Schema Markup (Required on Every Page)

```json
{
  "@context": "https://schema.org",
  "@type": "LocalBusiness",
  "name": "Ballet Academy and Movement",
  "address": {
    "@type": "PostalAddress",
    "streetAddress": "400-C Camino De Estrella",
    "addressLocality": "San Clemente",
    "addressRegion": "CA",
    "postalCode": "92672"
  },
  "telephone": "(949) 229-0846",
  "url": "https://balletacademyandmovement.com",
  "priceRange": "$$",
  "openingHours": "Mo-Sa 09:00-20:00"
}
```

---

## 2. Lead Capture System

### Lead Sources (Track All in Klaviyo + Studio Pro)

| Source | Capture Method | Tag |
|--------|---------------|-----|
| Google organic | Form on landing page | source:google-organic |
| Google Ads | Form with UTM param | source:google-ads |
| Meta Ads | Meta lead form | source:meta-ads |
| Instagram bio | Linktree / landing page | source:instagram |
| TikTok | Link in bio | source:tiktok |
| Yelp | Phone call / website click | source:yelp |
| Referral | Referral form + code | source:referral |
| Walk-in | Front desk entry | source:walk-in |
| Word of mouth | Ask at first contact | source:word-of-mouth |

### Lead Capture Form (Minimal Friction)

```
Child's first name: ___________
Child's age: ___________
Parent email: ___________
How did you hear about us: [dropdown]

[Book a Free Trial Class →]
```

Never ask for: last name, phone (optional), address, payment info on first touch.

### Chatbot Behavior

The website chatbot should:
1. Greet warmly: "Hi! Is this for your little one? Tell me their age and I'll suggest the perfect class 🩰"
2. Collect: child age → suggest class → offer trial booking
3. Capture email before showing schedule
4. If outside class age (13+): "We focus on ages 3-12 — but we'd love to meet you! Let me connect you with Amanda directly."
5. If existing student inquiry: Route to parent portal login

Never be robotic. Always warm. Use "little dancer" or "your dancer" not "the student."

---

## 3. Klaviyo Email Sequences

### Sequence 1: New Lead → Trial Class
(Trigger: Lead form submitted)

**Email 1** — Immediate
- Subject: "We'd love to meet your little dancer 🩰"
- Body: Welcome from Amanda, what to expect at trial, what to bring
- CTA: Book trial class link

**Email 2** — Day 2
- Subject: "Which class is right for [child name]?"
- Body: Age-based recommendation, brief description of level
- CTA: See class schedule

**Email 3** — Day 4
- Subject: "What makes Ballet Academy and Movement different"
- Body: Small classes (10 max), Amanda's background, intensive acceptances
- CTA: Read more about BAM / Book trial

**Email 4** — Day 7
- Subject: "A few spots left in [recommended class]"
- Body: Light urgency, parent testimonial, easy booking
- CTA: Reserve your spot

**Email 5** — Day 14
- Subject: "One more thing from Amanda..."
- Body: Personal-feeling note from Amanda about why she started the studio
- CTA: Book before the season fills

**Email 6** — Day 21
- Subject: "Still thinking it over? Here's what other parents say."
- Body: 2-3 parent testimonials, FAQ answers
- CTA: Final trial class offer

### Sequence 2: Trial Booked → Show
(Trigger: Trial class scheduled)

**Email 1** — Immediately after booking
- Subject: "You're all set — here's what to bring"
- Body: Dress code, parking, what to expect, Amanda's welcome

**Email 2** — Day before
- Subject: "See you tomorrow! A few things to know 🩰"
- Body: Short reminder, parking note, what child will experience

### Sequence 3: Trial Attended → Enroll
(Trigger: Trial class completed — manual or Studio Pro webhook)

**Email 1** — Same day (4 hours after class)
- Subject: "It was so wonderful to meet [child name] today!"
- Body: Specific-feeling note, class recommendation, enrollment link
- CTA: Enroll now

**Email 2** — Day 2
- Subject: "Your spot in [class name] is being held"
- Body: What the first month looks like, what to buy
- CTA: Complete enrollment

**Email 3** — Day 5
- Subject: "We're releasing spots this Friday — quick note"
- Body: Soft urgency, reiterate what makes BAM special
- CTA: Secure enrollment

**Email 4** — Day 10
- Subject: "Last follow-up, we promise 🤍"
- Body: Final personal-feeling note, offer to answer questions
- CTA: Enroll or reply with questions

### Sequence 4: Enrolled → Onboarding
(Trigger: Enrollment completed)

**Email 1** — Immediate
- Subject: "Welcome to Ballet Academy and Movement! 🩰"
- Body: Full onboarding guide — what to bring, dress code, portal login, class schedule

**Email 2** — Day 3
- Subject: "Before your first class — a few things from Amanda"
- Body: Philosophy, what child will experience, how to support at home

**Email 3** — Day 7 (after first class)
- Subject: "How was the first class? 🌟"
- Body: Ask for feedback, remind about parent portal, share what's coming up

**Email 4** — Day 14
- Subject: "You're officially part of the BAM family"
- Body: Community welcome, introduce them to upcoming Nutcracker, referral program

### Sequence 5: Nutcracker Season
(Trigger: September — manual send to all enrolled families)

5-email sequence building from auditions → roles → rehearsal → performance week → tickets/streaming

---

## 4. Google Ads Strategy

### Campaign Structure

**Campaign 1: Brand**
- Keywords: "ballet academy and movement", "BAM ballet", "Amanda Cobb ballet"
- Budget: $3/day
- Goal: Protect brand from competitors bidding on name

**Campaign 2: Local Intent**
- Keywords: "ballet classes san clemente", "ballet near me", "toddler ballet [city]"
- Budget: $10/day
- Match types: Phrase + Exact
- Location targeting: 15-mile radius from studio

**Campaign 3: Competitor**
- Keywords: [competitor studio name] + "dance classes"
- Budget: $4/day
- Ad copy: "Looking for ballet in [city]? Try BAM — real classical training, class sizes capped at 10."
- Note: Never name competitors in ad copy

**Campaign 4: Remarketing**
- Audience: Website visitors who didn't convert
- Budget: $3/day
- Ad: "You visited Ballet Academy and Movement — your free trial is still available"

### Ad Copy Formula
```
Headline 1: Ballet Classes in [City] — Ages 3-12
Headline 2: Class Sizes Capped at 10 Students
Headline 3: Free Trial Class — Book Today

Description 1: Classical ballet training from a former professional ballerina. 
              Nurturing, small-group instruction in San Clemente.
Description 2: Students accepted to Royal Ballet, ABT & Stuttgart intensives. 
              See why BAM is San Clemente's most respected ballet studio.
```

---

## 5. Meta Ads Strategy

### Audiences

**Audience 1: Core**
- Age: 25–45
- Gender: Female (primary decision maker)
- Location: 15 miles from studio
- Interests: Ballet, dance, children's activities, parenting
- Parents of children ages 2–10

**Audience 2: Lookalike**
- Source: Email list of enrolled families
- Lookalike: 1% expansion in CA

**Audience 3: Retargeting**
- Website visitors (last 30 days)
- Instagram profile visitors
- Lead form openers who didn't submit

### Creative Strategy

**Video Ad (best performing format)**
- 15-30 seconds
- First 3 seconds: Beautiful dance moment — no text, just movement
- Middle: "Real ballet training for little dancers in [city]"
- End: "Small classes. Professional instruction. Free trial available."
- CTA button: "Learn More" → landing page

**Image Ad**
- Clean, elegant photography (no clip art, no cartoons)
- Lavender palette prominent
- One line of copy maximum
- "Ballet classes for ages 3–12 in San Clemente 🩰"

---

## 6. Social Media Content System

### Instagram Content Pillars (rotate weekly)

| Pillar | Frequency | Example Content |
|--------|-----------|-----------------|
| Technique | 1x/week | "The secret to a beautiful arabesque isn't the back leg — it's the standing hip" |
| Student Moments | 1x/week | Beautiful photo or clip from class (with consent form on file) |
| Behind the Scenes | 1x/week | Nutcracker rehearsal, classroom setup, Amanda teaching |
| Parent Education | 1x/week | "When should my child start ballet?" carousel post |
| Social Proof | 2x/month | Review spotlight, intensive acceptance announcement |
| Seasonal | As needed | Nutcracker auditions, enrollment opens, performance week |

### TikTok Content Strategy

TikTok reaches a different audience — it can reach parents who don't follow ballet accounts.

**Best performing formats for ballet studios:**
1. "POV: Your daughter's first ballet class" (parent-relatable)
2. Technique explanation in plain language ("What turnout actually means")
3. Before/after transformation (student at age 4 vs age 8)
4. "What a real ballet class looks like for 4-year-olds"
5. Amanda teaching — natural, warm, authoritative tone

**Caption formula for TikTok:**
- Hook (first line): Question or bold statement
- Body: 2-3 sentences max
- CTA: "Link in bio for a free trial class 🩰"

### Content Consent System
Before posting any student content:
- Blanket consent form included in enrollment paperwork
- Parents can opt out at any time
- Never post full name + face together
- Never post minors in changing/getting dressed situations
- Admin marks student profiles: "can post" / "no post" / "face only with consent"

---

## 7. Referral Program

### Mechanics
- Enrolled family refers new family
- New family books trial + enrolls in first paid month
- **Referring family:** 1 month tuition credit (applied to next invoice)
- **New family:** 15% off first month

### How to Share
- Parent portal "Refer a Friend" button generates unique link + copy-paste message
- Pre-written referral message: "We love Ballet Academy and Movement! If you're looking for ballet classes for your little one in [city], use my link to get 15% off your first month."
- Tracks via UTM + referral code in Klaviyo

### Admin View
- See all referrals, status, and credits pending
- One-click credit application
- Monthly referral report

---

## 8. Community Marketing (Offline)

### Partner Targets
| Partner Type | Why | Approach |
|-------------|-----|----------|
| Preschools + kindergartens | Direct pipeline to 3-5 year olds | Leave flyers, offer demo class |
| Pediatricians in San Clemente | Trusted by parents | "We recommend structured arts education" referral cards |
| Gymboree / My Gym | Parents of active toddlers | Cross-promotion |
| Orthodontists / dentists | Patient waiting room flyers | Paid placement |
| Local moms Facebook groups | High engagement channel | Owner posts, not ads |
| San Clemente Journal | Local paper still read by families | Story pitch on Amanda |
| School district arts programs | Introduce BAM as after-school option | Principal/PTA outreach |

### Event Marketing
- **Free Demo Day:** First Saturday of each month, 45-minute open class for prospective students
- **Nutcracker Open Rehearsal:** 1 public rehearsal with professional photos for families
- **Community Performance:** Spring performance at local outdoor venue for visibility

---

## 9. Reputation Management

### Google Reviews
- Target: 4.8+ average, 100+ reviews
- Request: After first performance, after Nutcracker, after trial class enrolls
- Template: "We're so grateful [child name] is part of the BAM family! If you have a moment, a Google review helps other families find us. [direct link]"
- Respond to every review within 24 hours

### Yelp
- Photos updated monthly
- Owner bio highlights Amanda's professional career
- Respond to every review (positive and negative)
- For negative: "We'd love to connect directly — please reach out to dance@bamsocal.com"

### Response to Negative Reviews
**Never:**
- Argue publicly
- Share private information about the family
- Be defensive

**Always:**
- Thank them for their feedback
- Express genuine concern
- Offer to resolve offline
- Show other readers you take concerns seriously
