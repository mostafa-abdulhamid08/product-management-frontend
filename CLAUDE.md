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

    { path: '', canMatch: [adminGuard],   loadComponent: AdminLayout,   children: [...] }
    { path: '', canMatch: [catalogGuard], loadComponent: CatalogLayout, children: [...] }
    { path: 'login', canMatch: [guestGuard], loadComponent: Login }
    { path: '403', ... }
    { path: '**', ... }

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

Seeded login: `admin@example.com` / `password`.

## Current status

Project exists. `ng new` has run: Angular 19.2, standalone, CSS, zone-based change
detection. Tailwind 4.3 is installed and wired up — `@import "tailwindcss"` plus a
`.postcssrc.json`, no JS config file. The design tokens from `README.md` live in
`src/styles.css` inside a `@theme` block, so each one is both a CSS custom property
and a Tailwind utility.

`src/app/` is still the CLI default: `AppComponent`, an empty `app.routes.ts`, an
`app.config.ts` with only `provideRouter` and `provideZoneChangeDetection`. No
`core/`, `layout/`, `features/` or `shared/` yet, and no `environments/`.

The shell design is settled and written up in `README.md`: two layouts chosen by
`canMatch`, guards returning `UrlTree` except `adminGuard`, and a 403 catch-all as
the last child of each layout.

Next: step 1 of the build order — the two layouts, sidebar, topbar, and the
`canMatch` routing skeleton.
