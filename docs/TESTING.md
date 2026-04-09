# Testing Strategy — BAM Platform

**Status:** Ready for implementation  
**Phase:** Infrastructure  
**Decision Log Date:** April 8, 2026

---

## 1. Why This Exists

Every bug Derek finds requires:
1. Manually navigating to the feature
2. Taking a screenshot
3. Sharing it in Claude Chat
4. Waiting for diagnosis

Automated testing replaces this loop. Tests run on every push to main, catch regressions before they reach Amanda, and give Claude Code a way to verify its own work without human screenshots.

---

## 2. Testing Stack

| Tool | Purpose |
|---|---|
| **Playwright** | Browser automation — clicks, forms, navigation |
| **GitHub Actions** | Runs tests on every push to main |
| **Supabase test fixtures** | Seed data for tests (separate test tenant) |
| **Vercel Preview URLs** | Tests run against preview deployments, not production |

---

## 3. Test Tenant Setup

All automated tests run against a dedicated test tenant — never against BAM's production data.

**Test tenant:**
- `tenant_id`: generated at test setup
- `slug`: `bam-test`
- Seeded with: test admin user, test parent user, test teacher, test students, test classes

**Test users (seeded via Supabase auth API):**
- `admin@bam-test.com` / password in GitHub Secrets
- `parent@bam-test.com` / password in GitHub Secrets
- `teacher@bam-test.com` / password in GitHub Secrets

Tests log in as these users — never as Amanda or Derek.

---

## 4. Test Coverage Priority

### P0 — Enrollment Pipeline (must pass before every deploy)

```
test: new inbound email creates lead in pipeline
  1. POST to /api/communications/inbound with mock Resend payload
  2. Verify lead created in leads table with pipeline_stage='inquiry'
  3. Navigate to /admin/enrollment/pipeline as admin
  4. Verify lead card appears in Inquiry column

test: lead can be moved between stages
  1. Create a test lead at 'inquiry' stage
  2. Open lead drawer
  3. Move to 'trial_requested' via dropdown
  4. Verify stage history shows the move with timestamp

test: lead name is editable
  1. Open lead drawer for unknown lead
  2. Click first name field
  3. Type "Jennifer"
  4. Click Save Changes
  5. Verify lead card shows "Jennifer" on kanban
```

### P0 — Authentication & Access Control

```
test: parent cannot access admin routes
  1. Log in as parent@bam-test.com
  2. Navigate to /admin/enrollment/pipeline
  3. Verify redirect to /portal or 403

test: teacher cannot access financial data
  1. Log in as teacher@bam-test.com
  2. Navigate to /admin/timesheets (own) → verify access
  3. Navigate to /admin/timesheets (other teacher) → verify 403
```

### P1 — Schedule & Classes

```
test: schedule page loads with classes
  1. Log in as admin
  2. Navigate to /admin/classes
  3. Verify at least one class card renders
  4. Toggle "Privates" pill
  5. Verify private sessions appear/disappear

test: attendance can be marked
  1. Navigate to /admin/attendance
  2. Select today's class
  3. Mark first student as present
  4. Verify attendance record saved in DB
```

### P1 — Parent Portal

```
test: parent sees their students
  1. Log in as parent@bam-test.com
  2. Navigate to /portal/students
  3. Verify test student appears

test: parent sees outstanding documents
  1. Seed a pending document for the test family
  2. Log in as parent
  3. Navigate to /portal/documents
  4. Verify the document appears in "To Do" tab
```

### P2 — Communications

```
test: inbound SMS creates lead
  1. POST to /api/webhooks/quo with mock Quo payload
  2. Verify lead created or matched correctly

test: cancellation email triggers high priority alert
  1. POST to /api/communications/inbound with body mentioning "cancel"
  2. Verify classifier returns special_type='cancellation'
  3. Verify admin notification created with priority='high'
```

---

## 5. File Structure

```
/tests/
  /e2e/
    enrollment-pipeline.spec.ts
    auth-access-control.spec.ts
    schedule-classes.spec.ts
    parent-portal.spec.ts
    communications.spec.ts
  /api/
    inbound-webhook.spec.ts
    classifier.spec.ts
  /fixtures/
    seed.ts          — creates test tenant, users, classes
    teardown.ts      — cleans up test data after run
  /helpers/
    auth.ts          — login helpers for each role
    api.ts           — mock webhook payload builders
playwright.config.ts
```

---

## 6. Playwright Config

```typescript
// playwright.config.ts
import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 4 : 2,
  reporter: [
    ['html', { open: 'never' }],
    ['github'],           // GitHub Actions annotations
    ['list']
  ],
  use: {
    baseURL: process.env.TEST_BASE_URL || 'http://localhost:3000',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'mobile',
      use: { ...devices['iPhone 14'] },
    },
  ],
  globalSetup: './tests/fixtures/seed.ts',
  globalTeardown: './tests/fixtures/teardown.ts',
})
```

---

## 7. GitHub Actions Workflow

```yaml
# .github/workflows/test.yml
name: E2E Tests

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    timeout-minutes: 20

    env:
      TEST_BASE_URL: ${{ secrets.VERCEL_PREVIEW_URL }}
      SUPABASE_URL: ${{ secrets.NEXT_PUBLIC_SUPABASE_URL }}
      SUPABASE_SERVICE_KEY: ${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}
      TEST_ADMIN_EMAIL: admin@bam-test.com
      TEST_ADMIN_PASSWORD: ${{ secrets.TEST_ADMIN_PASSWORD }}
      TEST_PARENT_EMAIL: parent@bam-test.com
      TEST_PARENT_PASSWORD: ${{ secrets.TEST_PARENT_PASSWORD }}

    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Install Playwright browsers
        run: npx playwright install chromium

      - name: Run E2E tests
        run: npx playwright test

      - name: Upload test results
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: playwright-report
          path: playwright-report/
          retention-days: 7
```

---

## 8. Example Test File

```typescript
// tests/e2e/enrollment-pipeline.spec.ts
import { test, expect } from '@playwright/test'
import { loginAsAdmin } from '../helpers/auth'
import { createTestLead } from '../helpers/api'

test.describe('Enrollment Pipeline', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page)
  })

  test('pipeline page loads and shows kanban columns', async ({ page }) => {
    await page.goto('/admin/enrollment/pipeline')
    await expect(page.getByText('Enrollment Pipeline')).toBeVisible()
    await expect(page.getByText('INQUIRY')).toBeVisible()
    await expect(page.getByText('TRIAL REQUESTED')).toBeVisible()
    await expect(page.getByText('ENROLLED')).toBeVisible()
  })

  test('inbound email creates lead in inquiry column', async ({ page, request }) => {
    // Send mock inbound email via API
    const response = await request.post('/api/communications/inbound', {
      headers: {
        'svix-id': 'test-id',
        'svix-timestamp': String(Date.now()),
        'svix-signature': 'v1,test-signature',
      },
      data: {
        type: 'email.received',
        data: {
          from: 'Test Parent <testparent@gmail.com>',
          to: ['inbound@balletacademyandmovement.com'],
          subject: 'Ballet classes for my daughter',
          text: 'Hi, I am interested in ballet classes for my 6 year old daughter.',
        }
      }
    })

    await page.goto('/admin/enrollment/pipeline')
    await expect(page.getByText('testparent@gmail.com')).toBeVisible({ timeout: 10000 })
  })

  test('lead drawer opens on card click', async ({ page }) => {
    // Seed a test lead first
    await createTestLead({ email: 'drawer-test@gmail.com' })
    
    await page.goto('/admin/enrollment/pipeline')
    await page.getByText('drawer-test@gmail.com').click()
    
    await expect(page.getByText('Lead Details')).toBeVisible()
    await expect(page.getByText('Book Trial')).toBeVisible()
    await expect(page.getByText('Create Student')).toBeVisible()
  })

  test('stage can be moved via dropdown', async ({ page }) => {
    await createTestLead({ email: 'stage-test@gmail.com', stage: 'inquiry' })
    
    await page.goto('/admin/enrollment/pipeline')
    await page.getByText('stage-test@gmail.com').click()
    
    // Move to trial_requested
    await page.getByRole('combobox', { name: /move to stage/i }).selectOption('trial_requested')
    await page.getByRole('button', { name: 'Move Stage' }).click()
    
    // Verify stage history updated
    await expect(page.getByText('Moved to Trial Requested')).toBeVisible()
  })
})
```

---

## 9. Claude Code Instructions for Writing Tests

When Claude Code writes new features, it should automatically write the corresponding test. Add this to CLAUDE.md:

```markdown
## Testing Requirements

After building any new feature:
1. Write a Playwright test in /tests/e2e/ covering the happy path
2. Write a test for the most likely failure case
3. Run: npx playwright test tests/e2e/[new-file].spec.ts
4. Tests must pass before committing

Test file naming: [feature-name].spec.ts
Use helpers from /tests/helpers/ for auth and API calls
Never test against production — use TEST_BASE_URL env var
```

---

## 10. Claude Code Performance — Parallel Agent Strategy

Based on how the platform is structured, these modules can be built in parallel (no file conflicts):

| Session A | Session B | Session C |
|---|---|---|
| Tuition & Auto-Pay | SEO Landing Pages | Playwright test setup |
| Contract signing | Help Center content | GitHub Actions config |
| Parent checkout | Teacher onboarding | Test fixtures/seed |

**Rules for parallel sessions:**
1. Each session starts with `git pull origin main`
2. Each session works in a different directory/route group
3. Only ONE session pushes at a time — coordinate via this chat
4. After each session: `git add -A && git commit && git push`
5. Next session pulls before starting

---

## 11. Decisions Log

| # | Decision |
|---|---|
| 1 | Playwright chosen over Cypress — faster, better Next.js support, free |
| 2 | Tests run against Vercel preview deployments, never production |
| 3 | Dedicated test tenant — never touches BAM's real data |
| 4 | P0 tests block deployment — if they fail, the push doesn't go to production |
| 5 | Screenshots and videos captured on failure — no more manual screenshots for debugging |
| 6 | Claude Code required to write tests alongside every new feature |
| 7 | Mobile viewport tested in CI — iPhone 14 profile |
| 8 | GitHub Actions runs on every push to main and every PR |
