# CLAUDE.md

Angular SPA for an internal product-management admin panel. Consumes a Laravel
REST API that lives in a separate repository and is already complete.

**Read `README.md` first.** It holds the folder structure, the auth flow, the
permission model, the route table, the design system, and the build order.
Everything in it applies to every change you make here.

**Also read `docs/api-README.md`** — a copy of the backend's README. It is the
API contract: every endpoint, its shape, its validation rules, and the
permission that gates it. Never guess a response shape; look it up there.

## Precedence

The rules in this file and in `README.md` override any general Angular
convention wherever they conflict.

Pre-approved, do not ask again:

1. **No component library.** No Angular Material, no PrimeNG, no bootstrap.
   The shared components in `shared/components/` are ours. Build what's
   missing rather than installing something.
2. **No NgModules.** Standalone components only.
3. **No tests for now.** Do not write specs unless I explicitly ask.

## Non-negotiables

- **The frontend hides. The backend forbids.** Angular hides nav links,
  buttons, and icons the user lacks permission for. That is UX only. Never
  treat a hidden control as a security measure, and never skip a check
  because the backend has one.
- **Permission strings live in four places only:** `NAV_ITEMS`, route `data`,
  the layout `canMatch` guards, and `*hasPermission`. Never scattered through
  component logic, never duplicated as literals.
- **`AuthService.hasPermission()` is the single gate.** Sidebar, buttons, row
  icons, and guards all call it. Do not add a second source of truth.
- **Features never import from other features.** Shared code moves to
  `shared/`. `core/` is never imported by `shared/`.
- **`shared/` stays dumb.** No API calls, no permission logic, no knowledge of
  any feature.
- **Typed models for every API response.** No `any`.
- **No browser storage for auth.** The session is an httpOnly cookie. Nothing
  auth-related goes in localStorage or sessionStorage.

## Layouts and guards

Two layouts, selected by `canMatch` — never one layout with conditionals
inside it.

- `AdminLayoutComponent` — users holding `users.view` or `roles.view`.
  Full sidebar: Dashboard, Products, Categories, Users, Roles.
- `CatalogLayoutComponent` — everyone else. Dashboard, Products, Categories.

Both are declared at `path: ''` with different `canMatch` guards. Angular
takes the first that matches, so admin routes are simply not matched for a
catalog user — their components and lazy chunks never load at all. That is
why `canMatch` and not `canActivate`: with `canActivate` the first path match
wins and the guard can only reject it afterwards, by which point the chunk
has already downloaded.

Route shape:

    { path: 'login', canMatch: [guestGuard], loadComponent: Login }
    { path: '403', ... }
    { path: '', canMatch: [adminGuard],   loadComponent: AdminLayout,   children: [...] }
    { path: '', canMatch: [catalogGuard], loadComponent: CatalogLayout, children: [...] }
    { path: '**', ... }

Order matters: `login` and `403` must be declared before the two empty-path
layouts. An empty path matches any URL as a prefix, and the catalog layout has a
catch-all child, so a shell declared first would swallow /login and render 403
at it — leaving no way to sign in. (Only the catalog layout carries that child.
The admin layout declares every route, so an unmatched path there genuinely does
not exist and falling through to the outer `**` as a 404 is the honest answer.)    

Inside a layout, `*hasPermission` still governs individual buttons and row
actions, and each child route carries its own permission guard. The layout
decides which shell; the permission decides what's inside it. A viewer and a
product-manager share the catalog shell but see different buttons.

**Never use `canActivate` in this project.**

Guards depend on permissions already being loaded, so the `/me` bootstrap must
resolve before the first route is matched. Without it, `adminGuard` runs
against an empty permission list and drops a super admin into the catalog
layout.

## Conventions

- New control flow only: `@if`, `@for`, `@switch`. Not `*ngIf` / `*ngFor`.
- `inject()` over constructor injection.
- Signals for component and app state. RxJS for HTTP streams only — do not mix
  them for local state.
- One component per file; the file name matches the selector.
- Every list screen ships with four states: loading skeleton, empty (no
  records), empty (no filter results), and error. Not just the happy path.
- Every interactive element gets default, hover, active, focus-visible, and
  disabled states.
- Colours, spacing, radius, and type sizes come from the CSS custom properties
  in `styles.css`. Never a hardcoded hex or px value in a component.

## Talking to the API

- Base URL from `environment.ts`. Components never build URLs; feature
  services do.
- `withCredentials: true` on every request — Sanctum SPA cookie mode.
- `GET /sanctum/csrf-cookie` before the first authenticated request.
- **On 419, re-fetch the CSRF cookie and retry the request once.** A 419 means
  the CSRF token is stale, not that the user is logged out. Do not send them
  to the login page.
- Product create and update send `FormData` because of the image. Update posts
  with `_method=PUT` — PHP does not parse multipart bodies on a real `PUT`.
- **`price` arrives as a string** (`"39.50"`). That is deliberate — money is
  never a float. Parse it for display; never for arithmetic without care.
- Send `Accept-Language` on every request from the current locale. The API
  returns validation and business-rule messages in that language.

### Endpoints that feed forms

Three endpoints exist only to populate selects. They are separate from the
list endpoints because they open to narrower permissions:

- `GET /api/categories/options` — the category select on the product form
- `GET /api/roles/options` — the role select on the user form
- `GET /api/permissions` — the grouped matrix on the role form

Use these, not the full list endpoints, wherever a dropdown or matrix is being
filled. A user who can create products may not hold `categories.view`.

## Build order

One step complete before the next:

1. Shell — the two layouts, sidebar, topbar, and the canMatch routing skeleton
2. Auth — login, `AuthService`, interceptors, the `/me` bootstrap, and the
   layout guards
3. `hasPermission` directive and the permission-filtered sidebar
4. Products, end to end — list, filters, pagination, form, upload, details,
   delete
5. Categories, Users, Roles — same pattern, less surface
6. Dashboard, 403, 404
7. Empty, loading, and error states across every list

Products is first among features and is the fullest one: filters, pagination,
file upload, a relation. Everything after it is a smaller version of the same
work. Build it properly and copy its shape.

## Working style

- Ask before installing a package.
- Ask before changing anything already agreed in `README.md` — if something
  there looks wrong, say so instead of silently doing it differently.
- One feature's changes at a time. Don't scaffold six components at once.
- Don't add comments that restate what the code already says.
- Don't create documentation or summary files unless I ask.
- Verify against the running API, not against assumptions. The backend is
  complete and its Postman collection documents every response shape.
- After completing any step, update the `## Current status` section below to
  reflect what now exists and what the next step is. Do this without being
  asked — a stale status section is worse than none, because the next session
  starts from a wrong picture.

## Environment

The Laravel API runs on `http://localhost:8000` via `php artisan serve`, not
on its Herd `.test` domain. That is deliberate: `SameSite=lax` session cookies
are only sent between hosts sharing a registrable domain, and
`localhost:4200` and `product-management-api.test` do not. Both sides must sit
under `localhost`.

`upload_tmp_dir` must be set in the PHP ini that serves the API. Without it PHP
cannot create the temporary file for an upload and every image comes back
`The image failed to upload.`, with a raw PHP warning prepended to the JSON.

Seeded login: `admin@example.com` / `password`. `DemoDataSeeder` adds five more,
all with the same password: `manager@` (product-manager), `editor@`
(product-editor), `inventory@` (inventory-staff), `viewer@` (viewer), and
`deactivated@` (product-manager, `is_active` false).

## Current status

**Every screen in `README.md` exists and every step of the build order is done.**
Two backend changes are being folded in on top of that. Data localization is done;
multiple product images is the next task and is not started.

### Outstanding: multiple product images

The API has dropped `image_path` for a Media Library gallery — up to eight images per
product, exactly one primary. List rows and `recent_products` carry
`primary_image_url`; the details endpoint carries an `images` array of
`{ id, url, thumb_url, is_primary, order }`. Five endpoints under
`/api/products/{id}/images`, all gated by `products.update`. Two business rules to
surface: no ninth image, and the last image cannot be deleted.

Until that lands, `Product` still declares the dead `image_path` and `image_url`
fields and every product renders the no-image placeholder, because the API no longer
sends either key.

### What is here

Angular 19.2, standalone, zone-based change detection. Tailwind 4.3 with the design
tokens in a `@theme` block in `src/styles.css`, alongside the shared control classes
(`.btn-primary`, `.btn-quiet`, `.btn-danger-text`, `.field`, `.icon-btn`, `.page-btn`,
`.toggle`, `.ratio`).

Product and category `name` and `description` are bilingual: the API stores and
returns both languages at once as `{ en, ar }`, and the shape does not vary with
`Accept-Language` — that header still picks the language of what the *system* says.
`TranslatedText` in `core/models/` is the type, `LocaleService.text()` resolves it,
and the `tx` pipe is that same resolution for templates. Both forms carry an input
per language, and search matches either one because the API decides.

Two shells chosen by `canMatch`; login with the `/me` bootstrap in
`provideAppInitializer`; four interceptors (credentials, locale, progress, error);
the `hasPermission` directive and a permission-filtered sidebar; Products, Categories,
Users and Roles end to end; a permission-driven Dashboard; real 403 and 404; English
and Arabic with full RTL; and a global loading bar.

Shared: `data-table`, `page-header`, `pagination`, `status-badge`, `confirm-dialog`,
`empty-state`, `table-skeleton`, `toast-host`, `progress-bar`, and `pipes/price.pipe.ts`.

### Decisions that look wrong until you know why

- **`adminGuard` returns a bare `false`, never a `UrlTree`.** Falling through is the
  mechanism that lets the catalog shell pick up the user the admin shell declined.
- **`catalogFallbackGuard` gates the catalog layout's 403 catch-all.** Without it an
  admin's typo lands in the catalog shell and reads "not yours" about a page that is
  nobody's, instead of a truthful 404.
- **The `t` pipe is impure.** Its key never changes, so a pure pipe would never re-run
  when the locale does.
- **Switching language reloads the page.** API-worded strings would otherwise stay in
  the previous language until each screen happened to refetch, leaving half a screen
  in each.
- **`LOCALE_ID` comes from the stored preference.** That is safe precisely because the
  switch reloads; it is what makes `DatePipe` format in Arabic.
- **Numeric ratios are wrapped in `.ratio`.** Two LTR numbers around a neutral slash
  get reordered in an RTL paragraph, so `2 / 4` renders as `4 / 2` without the isolate.
- **The Actions column is projected, not configured.** Gating it with `*hasPermission`
  through the `actionsHeader` slot keeps permission strings in their four homes; a
  `columns` flag would have been a fifth.
- **`tx` lives in `core/pipes/`, not `shared/pipes/`, unlike `price`.** It injects
  `LocaleService` to know which language to resolve, and `shared/` may not import
  `core/`. The dividing line is the service dependency, not the fact that it is a pipe.
- **`TranslatedText` types both halves as `string | null`.** Names are non-empty in
  both languages by the API's own validation, but descriptions are nullable per
  language and the key is dropped entirely when neither is written. One permissive
  type that says what can actually arrive beats two that have to be kept in step.
- **`LocaleService.text()` falls back to the other language.** A row translated on one
  side only would otherwise render as a blank cell, and a blank cell reads as a broken
  record rather than as missing text.
- **The translated form controls are named after the API's columns.** `name_en`,
  `name_ar`, `description_en`, `description_ar` — so a 422 keyed on a column lands on
  its own input by name alone, with no mapping table to keep in step.
- **`shared/` takes every label as an input.** It cannot import `core/`, so it cannot
  translate; the defaults are English and every feature overrides them.
- **The roles form builds `resource.action` strings.** That is payload being sent back,
  not a gate being checked, so it is not a fifth home for permission strings.

### Known limitations

- The native file input renders its own "Choose File / No file chosen" chrome in the
  browser's language. Replacing it means a custom control over a hidden input.
- If an upload fails server-side, PHP may prepend an HTML warning to the JSON, which
  makes the 422 unparseable — the form then shows its generic error rather than the
  specific reason.
- The Arabic copy has not been reviewed by a native speaker.
- There are no tests, per the standing rule in this file.
