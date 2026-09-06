# HackTrack MMU E2E Test Plan

## Application Overview

HackTrack MMU is a Next.js (pages router) admin/member-tracking app for a university hackerspace, backed by a Rails REST API. Auth is password-only (no usernames): POST /api/v1/login with {session:{password, remember_me}} returns {token, isAdmin, valid_until}. Two known passwords: "secretarial slave" (admin, isAdmin:true, full CRUD + Control Panel) and "hacking things together" (viewer, isAdmin:false, read-only). Wrong password returns 401 {"message":"Invalid password"}. Auth state is a `token` cookie (plus isAdmin/validUntil cookies) mirrored in a zustand store; a global AuthRedirectHandler in _app.tsx calls GET /api/v1/sessions/verify on every route change and, if invalid/missing (and route isn't "/" or "/login"), waits 200ms, clears the store, and router.replace("/login") with a toast ("You must be signed in to access this page." for a forced bounce, or "Logout successfully! Redirecting you to main page" after a manual logout via localStorage "manualLogout" flag). The "/" route is a public marketing/landing page that NEVER redirects regardless of auth state (confirmed both logged-in and logged-out). All toasts (component: src/components/Toast/index.tsx) auto-dismiss after exactly 5000ms, so any test asserting on toast text must snapshot/assert immediately after the triggering action, never via a text-based wait that could run after dismissal.

Routes: /login (password box #password, show/hide eye icon, Remember me checkbox, submit, 4-image carousel rotating every 5s), /dashboard (SWR-backed Meetups/Hackathons/Active Members sections with skeleton loading; admin-only Control Panel with New Meetup / New Project / New Update buttons — NOTE: a "New Member" action component exists in source (NewMemberActionButton) but is never rendered anywhere in the app; this is effectively dead/unwired code and there is no way to create a member from the UI), /members (search with 300ms debounce, Filter popover with Status + Sort By selects, paginated member cards, click-to-open detail modal with Projects/Talks lists and admin-only inline Edit/Delete), /meetups (paginated Regular Meetups + Hackathons grids, click-to-open detail modal, admin-only Edit Meetup/Delete Meetup and per-update edit/delete), /onboarding (desktop table / mobile card list depending on viewport <=768px, Filter popover, inline status-change dropdown, View/Edit/Delete per row) — IMPORTANT FINDING: unlike every other admin surface, the Onboarding PAGE itself performs no isAdmin check; a logged-in viewer whose nav link is hidden can still open /onboarding directly by URL and sees the full table including status dropdown and View/Edit/Delete controls (client-side only; server-side enforcement is unverified), /member/[id]/edit (pre-filled form incl. nested "Other Information"; Name and Email are native-required so submitting blank ones is silently blocked by the browser, no custom validation message) — IMPORTANT FINDING: GET /api/v1/members/:id for a non-existent id (e.g. 999999) returns HTTP 200 with a null body rather than 404, so the edit page silently renders a completely blank form with no error message instead of the app's usual "Error occurred" state. Dark mode is driven purely by the OS/browser `prefers-color-scheme` media query (useDarkMode hook) — there is no in-app toggle button, so it must be tested via emulated color-scheme rather than a UI control. Below the `lg` breakpoint the top nav collapses to a hamburger button that opens a slide-in Sidebar with an overlay, mirroring the desktop links (Onboarding link and "Admin Mode" label only for admins).

## Test Scenarios

### 1. Authentication

**Seed:** `seed.spec.ts`

#### 1.1. Admin login succeeds and redirects to dashboard

**File:** `tests/authentication/login-admin-success.spec.ts`

**Steps:**
  1. Navigate to /login
    - expect: Password textbox, Remember me checkbox, and Login button are visible
    - expect: 4-image carousel container is present
  2. Fill #password with "secretarial slave"
    - expect: Field shows masked dots (type=password by default)
  3. Click Login
    - expect: Toast 'Login successfully! Redirecting you to main page' is visible immediately after click (assert right after the click, before any wait, since it auto-dismisses at 5s)
    - expect: URL becomes /dashboard
    - expect: Nav bar shows 'Admin Mode' label and a Control Panel heading

#### 1.2. Viewer login succeeds and redirects to dashboard with read-only nav

**File:** `tests/authentication/login-viewer-success.spec.ts`

**Steps:**
  1. Navigate to /login
    - expect: Login form is visible
  2. Fill #password with "hacking things together" and click Login
    - expect: URL becomes /dashboard
  3. Inspect the nav bar
    - expect: 'Admin Mode' label is NOT present
    - expect: 'Onboarding' nav link is NOT present
    - expect: Dashboard/Members/Meetups links and Logout button are present

#### 1.3. Invalid password shows error toast and stays on login

**File:** `tests/authentication/login-invalid-password.spec.ts`

**Steps:**
  1. Navigate to /login
    - expect: Login form is visible
  2. Fill #password with "wrong-password-123" and click Login
    - expect: POST /api/v1/login responds 401 with body {"message":"Invalid password"}
    - expect: Toast reads exactly 'Invalid password. Try again.' and is visible ~71ms after submit — assert immediately after the click, never via a text-based wait (toast auto-dismisses ~5.4s after appearing, so a late check will see nothing)
    - expect: URL remains /login

#### 1.4. Empty password blocks submission via native required validation

**File:** `tests/authentication/login-empty-password-validation.spec.ts`

**Steps:**
  1. Navigate to /login
    - expect: Password field is present and empty
  2. Click Login without typing a password
    - expect: Browser's native 'required' validation prevents form submission (no POST /api/v1/login network request fires)
    - expect: URL remains /login

#### 1.5. Show/hide password toggle switches input type

**File:** `tests/authentication/login-password-visibility-toggle.spec.ts`

**Steps:**
  1. Navigate to /login and fill #password with 'secretarial slave'
    - expect: Input type is 'password' (masked) and the Eye icon button is visible
  2. Click the eye icon toggle button
    - expect: Input type becomes 'text' and the typed password 'secretarial slave' is visible in plain text; icon switches to EyeOff
  3. Click the toggle button again
    - expect: Input type reverts to 'password' (masked)

#### 1.6. Remember me checkbox sets a longer-lived token cookie

**File:** `tests/authentication/login-remember-me-cookie-expiry.spec.ts`

**Steps:**
  1. Navigate to /login, check the 'Remember me' checkbox, fill password 'secretarial slave', and click Login
    - expect: Login succeeds and lands on /dashboard
  2. Read the 'token' cookie's expiry attribute
    - expect: Cookie expiry is set roughly 30 days in the future (per Cookies.set(token, {expires:30}) in useAuthStore), not a session cookie

#### 1.7. Visiting /login while already authenticated redirects to dashboard

**File:** `tests/authentication/login-redirect-if-authenticated.spec.ts`

**Steps:**
  1. Navigate to /login, log in as admin ('secretarial slave')
    - expect: Lands on /dashboard
  2. Navigate directly to /login again while the token cookie is still valid
    - expect: Page immediately redirects back to /dashboard (login.tsx's useEffect checks the token cookie and pushes to /dashboard before rendering the form)

#### 1.8. Login page image carousel cycles through all 4 images

**File:** `tests/authentication/login-image-carousel-rotates.spec.ts`

**Steps:**
  1. Navigate to /login on a viewport >= md breakpoint (carousel column is hidden below md)
    - expect: 'Login visual 1' image has opacity-100 (active) and the other 3 have opacity-0
  2. Wait 5.5 seconds
    - expect: 'Login visual 2' is now the active (opacity-100) image, confirming the 5-second auto-rotate interval

#### 1.9. Logout clears session, shows toast, and redirects to login

**File:** `tests/authentication/logout-clears-session.spec.ts`

**Steps:**
  1. Navigate to /login and log in as admin
    - expect: Lands on /dashboard
  2. Click the 'Logout' button in the nav bar
    - expect: DELETE /api/v1/logout is called
    - expect: localStorage 'manualLogout' flag is set to 'true' just before redirect
    - expect: URL becomes /login
    - expect: Toast 'Logout successfully! Redirecting you to main page' appears — assert immediately after the click
  3. Attempt to navigate back to /dashboard using browser back or direct URL
    - expect: Redirected back to /login since the token cookie/store was cleared

### 2. Dashboard

**Seed:** `seed.spec.ts`

#### 2.1. Admin dashboard loads summary sections with skeleton then real data

**File:** `tests/dashboard/dashboard-loads-summary-sections.spec.ts`

**Steps:**
  1. Navigate to /login and log in as admin
    - expect: Redirected to /dashboard
  2. Observe the page immediately after navigation completes
    - expect: Skeleton placeholder cards are briefly visible for Meetups/Hackathons/Members while SWR fetches /api/v1/dashboard/meetups, /hackathons, /members
  3. Wait for skeletons to resolve
    - expect: 'Meetups' section shows real meetup cards with a 'View All' link to /meetups
    - expect: 'Hackathons' section shows real hackathon cards
    - expect: 'Active Members' section shows real member cards with 'View All' link to /members
    - expect: 'Control Panel' heading is visible above the sections since the user is admin

#### 2.2. Admin Control Panel exposes exactly New Meetup, New Project, New Update (no New Member button)

**File:** `tests/dashboard/dashboard-control-panel-buttons.spec.ts`

**Steps:**
  1. Navigate to /login, log in as admin, land on /dashboard
    - expect: Control Panel section is visible
  2. Enumerate buttons inside the Control Panel grid
    - expect: Exactly three buttons are present: 'New Meetup', 'New Project', 'New Update'
    - expect: No 'New Member' button exists anywhere on the dashboard (there is no UI path to create a member; this documents current behavior, not necessarily desired behavior)

#### 2.3. New Meetup modal happy path creates a regular meetup

**File:** `tests/dashboard/dashboard-new-meetup-happy-path.spec.ts`

**Steps:**
  1. Navigate to /login, log in as admin, land on /dashboard
    - expect: Dashboard loaded
  2. Click 'New Meetup'
    - expect: Modal titled 'New Meetup' opens with Number (pre-filled with next meetup number), Date (pre-filled to today), a searchable Host dropdown grouped 'Yet To Host'/'Have Hosted', and Category radios defaulting to 'Regular Meetup'
  3. Select any host from the Host dropdown and click Submit
    - expect: POST /api/v1/meetups is called with the regular-meetup payload
    - expect: Toast 'Successfully added meetup!' appears immediately
    - expect: Modal closes and the new meetup card appears in the Meetups section
    - expect: NOTE FOR TEST DATA: this test creates a real meetup record; if run against shared seed data, prefer running it against an isolated/test database or clean up via the corresponding delete-meetup flow afterward

#### 2.4. New Meetup modal blocks submission without a host

**File:** `tests/dashboard/dashboard-new-meetup-validation.spec.ts`

**Steps:**
  1. Navigate to /login, log in as admin, land on /dashboard, click 'New Meetup'
    - expect: Modal opens with Host field empty
  2. Click Submit without selecting a host
    - expect: No POST /api/v1/meetups request fires
    - expect: Toast 'Host field is required.' appears immediately after the click
    - expect: Modal remains open

#### 2.5. Switching category to Hackathon swaps the pre-filled Number

**File:** `tests/dashboard/dashboard-new-meetup-category-switch.spec.ts`

**Steps:**
  1. Navigate to /login, log in as admin, open 'New Meetup' modal
    - expect: Number field shows the next regular-meetup number, 'Regular Meetup' radio is checked
  2. Click the 'Hackathon' radio button
    - expect: Number field value updates to the next hackathon number instead

#### 2.6. New Project modal blocks submission with empty name

**File:** `tests/dashboard/dashboard-new-project-empty-name-validation.spec.ts`

**Steps:**
  1. Navigate to /login, log in as admin, land on /dashboard, click 'New Project'
    - expect: Modal titled 'New Project' opens with an empty Name field, Members multi-select, Category radios (Project/Group Project), and an 'Is Project Completed?' checkbox
  2. Click Submit with Name left blank
    - expect: No POST /api/v1/projects request fires
    - expect: Toast 'Project Name is required.' appears immediately
    - expect: Modal remains open

#### 2.7. New Project modal blocks submission with no members selected

**File:** `tests/dashboard/dashboard-new-project-no-members-validation.spec.ts`

**Steps:**
  1. Navigate to /login, log in as admin, open 'New Project' modal
    - expect: Modal open
  2. Type a project name (e.g. 'QA Test Project') but leave the Members multi-select empty, then click Submit
    - expect: No POST /api/v1/projects request fires
    - expect: Toast 'Select at least one member for the project' appears immediately
    - expect: Modal remains open

#### 2.8. New Project modal happy path creates a project

**File:** `tests/dashboard/dashboard-new-project-happy-path.spec.ts`

**Steps:**
  1. Navigate to /login, log in as admin, open 'New Project' modal
    - expect: Modal open
  2. Type a project name (e.g. 'QA Test Project'), select at least one member from the Members dropdown, leave Category as 'Project', click Submit
    - expect: POST /api/v1/projects fires with the project payload
    - expect: Toast 'Successfully added project!' appears immediately
    - expect: Modal closes
    - expect: NOTE FOR TEST DATA: creates a real project attached to a real seeded member — clean up via that member's card delete-project action afterward if run against shared data

#### 2.9. New Update modal enforces sequential required-field validation (mislabeled Member error)

**File:** `tests/dashboard/dashboard-new-update-sequential-validation.spec.ts`

**Steps:**
  1. Navigate to /login, log in as admin, land on /dashboard, click 'New Update'
    - expect: Modal titled 'New Update' opens with Category radios (Idea Talk/Progress Talk), Member/Project/Date searchable dropdowns, and a Description textarea, all empty
  2. Click Submit with everything empty
    - expect: Toast reads 'Host field is required.' immediately — NOTE: this is a copy-paste bug in the source; the message should say 'Member field is required.' since it is actually validating the Member dropdown, not a host
    - expect: No POST /api/v1/updates request fires
  3. Select a Member, then click Submit again
    - expect: Toast 'Project field is required.' appears
  4. Select a Project, then click Submit again
    - expect: Toast 'Date field is required.' appears
  5. Select a Date, then click Submit again
    - expect: Toast 'Description field is required.' appears

#### 2.10. New Update modal happy path creates an update

**File:** `tests/dashboard/dashboard-new-update-happy-path.spec.ts`

**Steps:**
  1. Navigate to /login, log in as admin, open 'New Update' modal
    - expect: Modal open
  2. Select a Member, then select a Project from that member's populated project list, select a Date, type a Description, and click Submit
    - expect: POST /api/v1/updates fires with the update payload
    - expect: Toast 'Successfully added updates!' appears immediately
    - expect: Modal closes
    - expect: NOTE FOR TEST DATA: creates a real update record attached to seeded meetup/project/member

#### 2.11. Opening and cancelling each Control Panel modal makes no network mutation

**File:** `tests/dashboard/dashboard-cancel-modals-no-side-effects.spec.ts`

**Steps:**
  1. Navigate to /login, log in as admin, land on /dashboard
    - expect: Control Panel visible
  2. Open 'New Meetup' modal and click the '×' close button without filling anything
    - expect: Modal closes, no POST /api/v1/meetups request was made
  3. Open 'New Project' modal and close it via '×'
    - expect: No POST /api/v1/projects request was made
  4. Open 'New Update' modal and close it via '×'
    - expect: No POST /api/v1/updates request was made
    - expect: Dashboard counts/cards are unchanged from before the test

#### 2.12. Dashboard shows an error state when the meetups API call fails

**File:** `tests/dashboard/dashboard-api-failure-state.spec.ts`

**Steps:**
  1. Navigate to /login and log in as admin
    - expect: Login succeeds
  2. Intercept/route GET requests matching /api/v1/dashboard/meetups to fail with a 500 response, then reload /dashboard
    - expect: Page renders the 'Error loading dashboard meetups.' heading instead of the normal dashboard layout

### 3. Members

**Seed:** `seed.spec.ts`

#### 3.1. Members list loads with cards and pagination controls

**File:** `tests/members/members-list-loads.spec.ts`

**Steps:**
  1. Navigate to /login, log in as admin, click 'Members' in the nav
    - expect: URL is /members
    - expect: Skeleton member cards appear briefly then resolve to real member cards
    - expect: Default status chips 'Active' and 'Socially Active' are shown next to the heading
    - expect: A pagination control shows '1 - N' with a disabled previous button on page 1

#### 3.2. Searching for an existing member returns matching results

**File:** `tests/members/members-search-returns-results.spec.ts`

**Steps:**
  1. Navigate to /login, log in as admin, go to /members
    - expect: Member cards loaded
  2. Type a known seeded member's name (e.g. 'Chong Wei Jie') into the Search members input and wait ~500ms for the debounce
    - expect: GET /api/v1/members/search?query=... fires
    - expect: The grid now shows only matching card(s) for that name
    - expect: The bottom pagination control is hidden while searching

#### 3.3. Searching for a non-existent member shows an empty result set

**File:** `tests/members/members-search-no-results.spec.ts`

**Steps:**
  1. Navigate to /login, log in as admin, go to /members
    - expect: Member cards loaded
  2. Type a nonsense query (e.g. 'zzzznonexistentmember') into the search box and wait for the debounce
    - expect: The member card grid becomes empty (no cards render)
    - expect: No error is thrown/shown
    - expect: Clicking the 'x' clear icon restores the full member list

#### 3.4. Filter popover changes the status filter and refetches

**File:** `tests/members/members-filter-by-status.spec.ts`

**Steps:**
  1. Navigate to /login, log in as admin, go to /members, click 'Filter'
    - expect: Popover opens with a Status select (defaulting to 'Active') and a Sort By select (defaulting to 'Recent Talks')
  2. Change Status to 'Duplicate' and click the 'Filter' button inside the popover
    - expect: GET /api/v1/members/filtered?...status[]=duplicate... fires
    - expect: Popover closes
    - expect: Displayed status chip(s) update to reflect the new filter
    - expect: Pagination resets to page 1

#### 3.5. Filter popover Clear button resets to default statuses

**File:** `tests/members/members-filter-clear-resets-defaults.spec.ts`

**Steps:**
  1. Navigate to /login, log in as admin, go to /members, open Filter, change Status to something else, and click Filter to apply
    - expect: List updates to the new filter
  2. Reopen the Filter popover and click 'Clear'
    - expect: Status resets to 'All' selection internally but the applied filter reverts to the default statuses (Active, Socially Active)
    - expect: Sort resets to the default ('recent_talks')
    - expect: Popover closes and the member list reflects the default filter

#### 3.6. Sort By option changes member ordering

**File:** `tests/members/members-sort-order-changes.spec.ts`

**Steps:**
  1. Navigate to /login, log in as admin, go to /members, note the name of the first card
    - expect: Default sort is 'Recent Talks'
  2. Open Filter, change Sort By to 'Alphabetical', click Filter
    - expect: GET request includes sort_by=alphabetical
    - expect: The first card's name changes to reflect alphabetical ordering (likely different from the initial first card)

#### 3.7. Pagination next/previous buttons navigate between pages

**File:** `tests/members/members-pagination-navigation.spec.ts`

**Steps:**
  1. Navigate to /login, log in as admin, go to /members
    - expect: Pagination shows page 1 of N (N > 1) with previous button disabled
  2. Click the next-page (chevron right) button
    - expect: GET /api/v1/members/filtered?page=2... fires
    - expect: The card grid updates to a different set of members
    - expect: Previous button becomes enabled
  3. Click the previous-page button
    - expect: Returns to page 1's member set
    - expect: Previous button disabled again

#### 3.8. Clicking a member card opens its detail modal with Projects and Talks

**File:** `tests/members/members-card-opens-detail-modal.spec.ts`

**Steps:**
  1. Navigate to /login, log in as admin, go to /members
    - expect: Cards loaded
  2. Click on any member card
    - expect: Page title updates to "HackTrack - <name>'s profile"
    - expect: A modal opens showing the member's name, an 'Edit' icon link to /member/<id>/edit, a 'Projects' section, a 'Talks' section listing updates with category/author/date, and an 'Other Information' section
  3. Click 'Close'
    - expect: Modal closes, member list remains visible underneath

#### 3.9. Edit member happy path saves changes and returns to previous page

**File:** `tests/members/members-edit-happy-path.spec.ts`

**Steps:**
  1. Navigate to /login, log in as admin, go to /members, open a member's detail modal, click the Edit icon link
    - expect: Navigates to /member/<id>/edit with the form pre-filled from the member's current data
  2. Change the 'Comment' textarea to a new value and click 'Save Changes'
    - expect: PATCH /api/v1/members/<id> fires with the updated comment
    - expect: Page navigates back (router.back()) to /members

#### 3.10. Edit member blocks submission when Name or Email is cleared

**File:** `tests/members/members-edit-required-field-validation.spec.ts`

**Steps:**
  1. Navigate to /login, log in as admin, open a member's edit page directly via /member/<known-id>/edit
    - expect: Form pre-filled with existing Name and Email
  2. Select all text in the Name field and delete it, then click 'Save Changes'
    - expect: Browser's native required-field validation blocks submission (no PATCH request fires)
    - expect: Page remains on the edit form
  3. Click 'Cancel'
    - expect: Navigates back without persisting the empty Name (original data is unaffected since nothing was saved)

#### 3.11. Editing a non-existent member id silently renders a blank form (edge case / bug)

**File:** `tests/members/members-edit-invalid-id.spec.ts`

**Steps:**
  1. Navigate to /login, log in as admin, navigate directly to /member/999999/edit (an id that does not exist)
    - expect: GET /api/v1/members/999999 responds 200 OK with a null body (backend quirk — not a 404)
    - expect: Because the SWR call never errors, the page skips its 'Error occurred' state and instead renders the 'Edit Member' form with every field blank/empty and no error message shown to the user
    - expect: This documents a real gap: there is no user-facing indication that member 999999 does not exist

#### 3.12. Members page shows an error state when the members API call fails

**File:** `tests/members/members-api-failure-state.spec.ts`

**Steps:**
  1. Navigate to /login and log in as admin
    - expect: Login succeeds
  2. Intercept GET requests matching /api/v1/members/filtered to fail with a 500 response, then navigate to /members
    - expect: The dedicated ErrorPage component renders instead of the member grid

### 4. Meetups

**Seed:** `seed.spec.ts`

#### 4.1. Meetups page loads Regular Meetups and Hackathons sections

**File:** `tests/meetups/meetups-list-loads.spec.ts`

**Steps:**
  1. Navigate to /login, log in as admin, click 'Meetups' in the nav
    - expect: URL is /meetups
    - expect: Skeleton cards (28 placeholders each) appear briefly for both 'Regular Meetups' and 'Hackathons' sections
    - expect: Real meetup and hackathon cards render after loading, each showing number, host, date, and update count

#### 4.2. Pagination navigates between pages of meetups

**File:** `tests/meetups/meetups-pagination-navigation.spec.ts`

**Steps:**
  1. Navigate to /login, log in as admin, go to /meetups
    - expect: Pagination control shows page '1 - N'
  2. Click the next-page chevron
    - expect: GET /api/v1/meetups/?page=2 fires
    - expect: Meetup and hackathon card sets update to a different page of data
  3. Click the previous-page chevron
    - expect: Returns to the original page 1 data

#### 4.3. Clicking a meetup card opens its detail modal with updates

**File:** `tests/meetups/meetups-card-opens-detail-modal.spec.ts`

**Steps:**
  1. Navigate to /login, log in as admin, go to /meetups
    - expect: Cards loaded
  2. Click on a meetup card that has at least one update
    - expect: Page title updates to include the meetup number
    - expect: Modal opens showing Host, Date, update count, an 'Updates' list with each update's description/category/author, and (as admin) 'Edit Meetup' and 'Delete Meetup' buttons plus per-update edit/delete icons

#### 4.4. Edit Meetup happy path updates number, host, and date

**File:** `tests/meetups/meetups-edit-happy-path.spec.ts`

**Steps:**
  1. Navigate to /login, log in as admin, open a meetup's detail modal, click 'Edit Meetup'
    - expect: Form shows Number (spinbutton), a searchable Host dropdown, and a Date field pre-filled with current values
  2. Change the Date to a different valid date and click 'Save'
    - expect: PATCH /api/v1/meetups/<id> fires with the updated payload
    - expect: Toast 'Meetup edited successfully!' appears immediately
    - expect: Modal returns to the list/detail view showing the new date

#### 4.5. Edit Meetup Cancel discards changes

**File:** `tests/meetups/meetups-edit-cancel-discards.spec.ts`

**Steps:**
  1. Navigate to /login, log in as admin, open a meetup's detail modal, click 'Edit Meetup'
    - expect: Edit form shown with current values
  2. Change the Number field value, then click 'Cancel' instead of 'Save'
    - expect: No PATCH request fires
    - expect: View returns to the meetup detail screen showing the original (unchanged) number

#### 4.6. Delete Meetup confirmation modal can be cancelled without deleting

**File:** `tests/meetups/meetups-delete-confirmation-cancel.spec.ts`

**Steps:**
  1. Navigate to /login, log in as admin, open a meetup's detail modal
    - expect: 'Delete Meetup' button visible
  2. Click 'Delete Meetup'
    - expect: A native browser confirm() dialog appears with text mentioning associated updates will also be deleted
  3. Dismiss/cancel the confirm dialog
    - expect: No DELETE /api/v1/meetups/<id> request fires
    - expect: The meetup remains in the list unchanged

#### 4.7. Edit an update from within the meetup modal

**File:** `tests/meetups/meetups-edit-update-happy-path.spec.ts`

**Steps:**
  1. Navigate to /login, log in as admin, open a meetup detail modal that has at least one update, click the edit icon on that update
    - expect: Edit-update form shown with Category, Member/Project/Date dropdowns, and Description pre-filled
  2. Change the Description text and save
    - expect: PATCH /api/v1/updates/<id> fires
    - expect: Toast 'Update edited successfully!' appears immediately
    - expect: Modal shows the updated description

#### 4.8. Delete an update confirmation can be cancelled

**File:** `tests/meetups/meetups-delete-update-cancel.spec.ts`

**Steps:**
  1. Navigate to /login, log in as admin, open a meetup detail modal with at least one update
    - expect: Delete icon visible next to the update
  2. Click the delete icon for an update
    - expect: A native confirm() dialog appears asking to confirm deletion of the update
  3. Dismiss/cancel the dialog
    - expect: No DELETE /api/v1/updates/<id> request fires
    - expect: The update remains listed

#### 4.9. Meetups page shows an error state when the meetups API call fails

**File:** `tests/meetups/meetups-api-failure-state.spec.ts`

**Steps:**
  1. Navigate to /login and log in as admin
    - expect: Login succeeds
  2. Intercept GET requests matching /api/v1/meetups to fail with a 500 response, then navigate to /meetups
    - expect: The ErrorPage component renders instead of the meetup/hackathon grids

### 5. Onboarding

**Seed:** `seed.spec.ts`

#### 5.1. Onboarding table loads on desktop viewport with default First-Talk-Given-and-earlier filter

**File:** `tests/onboarding/onboarding-table-loads-desktop.spec.ts`

**Steps:**
  1. Navigate to /login, log in as admin, click 'Onboarding' in the nav (desktop viewport, e.g. 1280x800)
    - expect: URL is /onboarding
    - expect: A table renders with columns Name, Contact Number, Register Date, Comment, Status, Options
    - expect: Default status chips show Registered/Contacted/First Talk Given
    - expect: Each row has View, Edit, and Delete controls plus a Status select

#### 5.2. Onboarding switches to a mobile card list under 768px

**File:** `tests/onboarding/onboarding-mobile-card-view.spec.ts`

**Steps:**
  1. Navigate to /login, log in as admin, resize the viewport to 375x812, navigate to /onboarding
    - expect: The desktop <table> is replaced by a stacked card list (OnboardingMobileCard), each card showing name, contact, created date, an inline status dropdown, and View/Edit/Delete buttons
    - expect: A hamburger menu button is present in place of the full desktop nav

#### 5.3. Searching the onboarding list filters by name

**File:** `tests/onboarding/onboarding-search-results.spec.ts`

**Steps:**
  1. Navigate to /login, log in as admin, go to /onboarding
    - expect: Rows loaded
  2. Type a known onboarding member's name into the Search members box and wait for the debounce
    - expect: Only matching row(s) remain, further narrowed by the current status filter client-side
    - expect: Pagination control is hidden while searching

#### 5.4. Empty onboarding search shows a 'No members found' message

**File:** `tests/onboarding/onboarding-search-empty-state.spec.ts`

**Steps:**
  1. Navigate to /login, log in as admin, go to /onboarding
    - expect: Rows loaded
  2. Type a nonsense query into search and wait for the debounce
    - expect: Table body (or card list) shows a 'No members found' message spanning the row/section instead of any data rows

#### 5.5. Filter popover narrows onboarding list by a single status

**File:** `tests/onboarding/onboarding-filter-by-status.spec.ts`

**Steps:**
  1. Navigate to /login, log in as admin, go to /onboarding, open the Filter popover
    - expect: Status selector includes 'All' plus every MemberStatus option, and a Sort By selector with Latest/Earliest Registered, Recent Talks, Alphabetical
  2. Select 'Registered' only and click Filter
    - expect: GET /api/v1/members/filtered?status[]=registered... fires
    - expect: Only rows/cards with status REGISTERED are shown
    - expect: Pagination resets to page 1

#### 5.6. Clicking View opens the onboarding member detail modal

**File:** `tests/onboarding/onboarding-view-member-modal.spec.ts`

**Steps:**
  1. Navigate to /login, log in as admin, go to /onboarding
    - expect: Rows loaded
  2. Click 'View' on any row
    - expect: Modal opens showing the member's name, current Status heading, Contact Information (email/contact number/discord with copy-to-clipboard and mailto/WhatsApp links), Comment, and Other Information (Register Date/Time, Student ID, etc., each falling back to a 'Not Provided' indicator when empty)

#### 5.7. Promoting onboarding status advances to the next stage

**File:** `tests/onboarding/onboarding-promote-status.spec.ts`

**Steps:**
  1. Navigate to /login, log in as admin, go to /onboarding, open the View modal for a member whose status is 'Registered' or 'Contacted'
    - expect: An enabled (blue) up-arrow 'Promote' button is visible
  2. Click the promote (up-arrow) button
    - expect: PUT /api/v1/members/<id> fires with the next status
    - expect: Toast 'Member status updated successfully' appears immediately
    - expect: The Status heading in the modal updates to the new stage

#### 5.8. Demoting onboarding status reverts to the previous stage

**File:** `tests/onboarding/onboarding-demote-status.spec.ts`

**Steps:**
  1. Navigate to /login, log in as admin, go to /onboarding, open the View modal for a member whose status is 'Contacted' or 'First Talk Given'
    - expect: An enabled (yellow) down-arrow 'Demote' button is visible
  2. Click the demote (down-arrow) button
    - expect: PUT /api/v1/members/<id> fires with the previous status
    - expect: Toast 'Member status updated successfully' appears immediately
    - expect: Status heading updates to the earlier stage

#### 5.9. Member at final onboarding status (First Talk Given) shows the 'assign in edit page' tick instead of a promote arrow

**File:** `tests/onboarding/onboarding-final-status-assign-tick.spec.ts`

**Steps:**
  1. Navigate to /login, log in as admin, go to /onboarding, open the View modal for a member whose status is 'First Talk Given'
    - expect: A green checkmark button labeled 'Assign Status in Edit Page' is shown linking to /member/<id>/edit?source=onboarding
    - expect: The up-arrow (promote) is disabled/greyed since there is no further onboarding stage
    - expect: A banner reads 'Select Tick Icon to Assign Status in Edit Page.'
  2. Click the checkmark
    - expect: Navigates to /member/<id>/edit?source=onboarding

#### 5.10. Delete confirmation modal can be cancelled without deleting a seeded onboarding member

**File:** `tests/onboarding/onboarding-delete-confirmation-cancel.spec.ts`

**Steps:**
  1. Navigate to /login, log in as admin, go to /onboarding
    - expect: Rows loaded
  2. Click 'Delete' on any row
    - expect: A modal titled 'Delete Member' appears with the warning text "Doing so cannot be reversed!" and Cancel/Delete buttons
  3. Click 'Cancel'
    - expect: Modal closes
    - expect: No DELETE /api/v1/members/<id> request fires
    - expect: The row still appears in the table

#### 5.11. Edit link from onboarding row navigates to the member edit page with a source query param

**File:** `tests/onboarding/onboarding-edit-link-navigates.spec.ts`

**Steps:**
  1. Navigate to /login, log in as admin, go to /onboarding
    - expect: Rows loaded
  2. Click 'Edit' on any row
    - expect: Navigates to /member/<id>/edit?source=onboarding with the member's form pre-filled

### 6. Navigation & Layout

**Seed:** `seed.spec.ts`

#### 6.1. Desktop nav shows admin-only links and Admin Mode label for admin

**File:** `tests/navigation/nav-desktop-admin-links.spec.ts`

**Steps:**
  1. Navigate to /login, log in as admin, at a desktop viewport (e.g. 1280x800)
    - expect: Top nav bar shows Dashboard, Members, Meetups, Onboarding links, an 'Admin Mode' text label, and a Logout button
    - expect: The mobile hamburger button is not visible at this width

#### 6.2. Mobile hamburger button opens and closes the slide-in sidebar

**File:** `tests/navigation/nav-mobile-sidebar-toggle.spec.ts`

**Steps:**
  1. Navigate to /login, log in as admin, resize viewport to 375x812
    - expect: Top nav collapses to just the logo and a hamburger (Menu icon) button; full-width desktop links are hidden
  2. Click the hamburger button
    - expect: Icon switches to an X (close) icon
    - expect: A sidebar panel slides in from the left with a semi-transparent overlay behind it, containing Dashboard/Members/Meetups/Onboarding links, 'Admin Mode' text, and a Logout button
  3. Click the overlay (outside the sidebar) or the X button
    - expect: Sidebar slides back off-screen and the overlay disappears

#### 6.3. Sidebar links navigate correctly on mobile

**File:** `tests/navigation/nav-mobile-sidebar-links-navigate.spec.ts`

**Steps:**
  1. Navigate to /login, log in as admin, resize to 375x812, open the sidebar via the hamburger button
    - expect: Sidebar open with nav links visible
  2. Click 'Members' inside the sidebar
    - expect: URL becomes /members
    - expect: Sidebar closes automatically (route change) or remains until manually closed depending on implementation — verify actual resulting state matches page navigation

#### 6.4. Root route always shows the public landing page regardless of auth state

**File:** `tests/navigation/nav-root-route-landing-page.spec.ts`

**Steps:**
  1. With no cookies set (logged out), navigate to /
    - expect: Landing page renders with the animated 'Hacktrack MMU' title, tagline 'Remembering and celebrating every shared talk', and a 'Login →' button — no redirect occurs
  2. Log in as admin (navigate to /login, submit 'secretarial slave'), then navigate back to /
    - expect: Still shows the same public landing page (does NOT auto-redirect to /dashboard) — this is the same behavior as logged-out, confirming '/' never checks auth
  3. Click the 'Login →' button on the landing page
    - expect: Navigates to /login

#### 6.5. Dark mode follows the OS/browser prefers-color-scheme setting (no in-app toggle)

**File:** `tests/navigation/nav-dark-mode-system-preference.spec.ts`

**Steps:**
  1. Emulate color-scheme: light and navigate to /login
    - expect: Page renders with light-theme classes/background (bg-white) and the standard (non-white) hackerspace logo
  2. Emulate color-scheme: dark and reload /login
    - expect: Page renders with dark-theme classes/background (dark:bg-[#111]) and the white logo variant (hackerspaceLogoWhite.svg)
    - expect: Confirm there is no manual sun/moon toggle button anywhere in the UI — dark mode is purely automatic

#### 6.6. Responsive layout switches from grid/table to stacked cards at the mobile breakpoint

**File:** `tests/navigation/nav-responsive-breakpoint-layout.spec.ts`

**Steps:**
  1. Navigate to /login, log in as admin, go to /onboarding at a desktop width (1280px)
    - expect: A <table> element renders the onboarding rows
  2. Resize the viewport down to 375px width without navigating away
    - expect: Table is replaced by the stacked OnboardingMobileCard list (breakpoint is max-width: 768px per the useMediaQuery hook)
  3. Resize back up to 1280px
    - expect: Table view returns

### 7. Authorization

**Seed:** `seed.spec.ts`

#### 7.1. Unauthenticated access to a protected route redirects to login with a warning toast

**File:** `tests/authorization/unauthenticated-redirect-to-login.spec.ts`

**Steps:**
  1. With no cookies set, navigate directly to /dashboard
    - expect: GET /api/v1/sessions/verify fails (no/invalid token)
    - expect: After ~200ms, the page redirects to /login
    - expect: Toast 'You must be signed in to access this page.' appears — assert immediately after the redirect, not via a delayed wait, since it auto-dismisses at 5s
  2. Repeat by navigating directly to /members and to /meetups with no cookies set
    - expect: Both also redirect to /login with the same behavior

#### 7.2. An invalid/garbage token cookie is treated as unauthenticated and redirects to login

**File:** `tests/authorization/invalid-token-redirect.spec.ts`

**Steps:**
  1. Set a 'token' cookie to an arbitrary invalid string (e.g. 'invalid_garbage_token_12345') and an 'isAdmin' cookie to 'true', then navigate to /members
    - expect: GET /api/v1/sessions/verify responds unsuccessfully for the bogus token
    - expect: Page redirects to /login within ~200ms
    - expect: The login form (not the members page) is what the user ultimately sees

#### 7.3. Admin sees Onboarding link and Admin Mode label; viewer does not

**File:** `tests/authorization/admin-vs-viewer-nav-visibility.spec.ts`

**Steps:**
  1. Navigate to /login, log in with admin password 'secretarial slave'
    - expect: Nav shows 'Onboarding' link and 'Admin Mode' text
  2. Log out, then log in again with viewer password 'hacking things together'
    - expect: Nav no longer shows an 'Onboarding' link or 'Admin Mode' text; Dashboard/Members/Meetups links and Logout remain

#### 7.4. Viewer dashboard has no Control Panel and no create-action buttons

**File:** `tests/authorization/viewer-dashboard-no-control-panel.spec.ts`

**Steps:**
  1. Navigate to /login, log in as viewer ('hacking things together')
    - expect: Lands on /dashboard
  2. Inspect the dashboard content
    - expect: No 'Control Panel' heading and no New Meetup/New Project/New Update buttons are present
    - expect: Meetups/Hackathons/Active Members sections still render read-only

#### 7.5. Viewer member and meetup detail modals hide all edit/delete controls

**File:** `tests/authorization/viewer-hides-edit-delete-controls.spec.ts`

**Steps:**
  1. Navigate to /login, log in as viewer, go to /members, click any member card
    - expect: Modal opens showing Projects/Talks/Other Information, but with NO 'Edit' icon link at the top and NO per-project/per-update edit or delete icon buttons (compare directly against the admin version of this same modal, which does show them)
  2. Close that modal, go to /meetups, click any meetup card
    - expect: Modal shows Host/Date/Updates but NO 'Edit Meetup'/'Delete Meetup' buttons and NO per-update edit/delete icons

#### 7.6. Viewer can access /onboarding directly by URL despite the nav link being hidden (authorization gap)

**File:** `tests/authorization/viewer-can-access-onboarding-directly.spec.ts`

**Steps:**
  1. Navigate to /login, log in as viewer ('hacking things together')
    - expect: Nav bar does NOT show an 'Onboarding' link
  2. Navigate directly to the URL /onboarding
    - expect: FINDING: the page loads fully rather than redirecting or showing a forbidden state — the onboarding table renders with the same Name/Contact/Register Date/Comment/Status/Options columns as the admin sees, including a working inline Status change dropdown and View/Edit/Delete buttons for every row
    - expect: This documents that the onboarding page performs no client-side isAdmin gate (unlike /members and /meetups modals); note in the report whether the underlying PUT/DELETE/PATCH calls succeed or are rejected server-side, since that determines the real severity of this gap

#### 7.7. A member edit page reached without admin rights still exposes Save Changes (no client-side role gate)

**File:** `tests/authorization/viewer-can-open-member-edit-page.spec.ts`

**Steps:**
  1. Navigate to /login, log in as viewer, navigate directly to /member/<known-id>/edit
    - expect: The edit form loads and is pre-filled just as it is for admin, with an enabled 'Save Changes' button — there is no client-side check that redirects a viewer away from this page

#### 7.8. Session expiring mid-session (verify call starts failing) bounces the user to login

**File:** `tests/authorization/session-expiry-mid-session.spec.ts`

**Steps:**
  1. Navigate to /login, log in as admin, land on /dashboard
    - expect: Dashboard loaded normally with a valid token
  2. Intercept/route GET /api/v1/sessions/verify to start returning a failure (e.g. 401) for all subsequent calls, then trigger a route change (e.g. click 'Members' in the nav)
    - expect: AuthRedirectHandler's next verify check fails
    - expect: After ~200ms the app clears the auth store and redirects to /login
    - expect: Toast 'You must be signed in to access this page.' appears immediately after the redirect
