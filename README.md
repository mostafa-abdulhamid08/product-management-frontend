# Product Management — Frontend

Angular SPA for the Product Management admin panel. Staff manage a product catalog; what each person sees is driven entirely by their permissions.

The Laravel API this talks to lives in a separate repository. Its README holds the API contract — endpoint shapes, validation rules, and the permission required by each route. Read it alongside this one.

---

## Tech stack

| Concern | Choice |
|---|---|
| Framework | Angular 19.2 (`@angular/core` 19.2.25, CLI 19.2.27), standalone components |
| Language | TypeScript 5.7 |
| Change detection | Zone-based — `provideZoneChangeDetection({ eventCoalescing: true })`, zone.js 0.15 |
| Styling | Tailwind CSS 4.3 + CSS custom properties for tokens, both in `src/styles.css` |
| State | Angular signals |
| HTTP | `HttpClient` with functional interceptors |
| Auth | Sanctum SPA cookie mode (`withCredentials: true`) |
| Localization | `Accept-Language` per request + local UI translation files |

Those are the versions `ng new` actually installed — check `package.json` before
quoting a version anywhere else.

Tailwind 4 has no JavaScript config file. It is enabled by `@import "tailwindcss"`
at the top of `src/styles.css` and a `.postcssrc.json` at the project root holding
`{ "plugins": { "@tailwindcss/postcss": {} } }` — that is the whole setup, and
`angular.json` needs no change. There is no `tailwind.config.js` to look for.

No component library. The shared components in this project are small enough to own, and owning them keeps the visual language consistent.

---

## The one rule that shapes everything

**The frontend hides. The backend forbids.**

Angular hides nav links, buttons, and icons the user has no permission for. That is UX — it keeps the screen honest and uncluttered. It is not security. Anyone can open a terminal and call the API directly; what stops them is the middleware in Laravel.

Never treat a hidden button as protection, and never skip a backend permission because the UI already hides the control.

---

## Folder structure

```
src/
├── app/
│   ├── core/                        singletons, loaded once
│   │   ├── directives/
│   │   │   └── has-permission.directive.ts
│   │   ├── pipes/
│   │   │   └── translate.pipe.ts     the `t` pipe — injects LocaleService
│   │   ├── guards/
│   │   │   ├── admin.guard.ts        canMatch — selects AdminLayout
│   │   │   ├── catalog.guard.ts      canMatch — selects CatalogLayout
│   │   │   ├── guest.guard.ts
│   │   │   └── permission.guard.ts   canMatch — on each child route
│   │   ├── interceptors/
│   │   │   ├── credentials.interceptor.ts
│   │   │   ├── error.interceptor.ts
│   │   │   ├── locale.interceptor.ts
│   │   │   └── progress.interceptor.ts
│   │   ├── services/
│   │   │   ├── auth.service.ts
│   │   │   ├── locale.service.ts
│   │   │   ├── progress.service.ts
│   │   │   └── toast.service.ts
│   │   └── models/
│   │       ├── user.model.ts
│   │       └── api-response.model.ts
│   │
│   ├── layout/                      two shells, one chosen per user
│   │   ├── admin-layout/            full sidebar — Users and Roles included
│   │   ├── catalog-layout/          catalog sidebar only
│   │   ├── sidebar/                 shared by both, filtered by permission
│   │   └── topbar/                  shared by both
│   │
│   ├── features/                    one folder per resource
│   │   ├── auth/
│   │   │   └── login/
│   │   ├── dashboard/
│   │   ├── products/
│   │   │   ├── pages/
│   │   │   │   ├── product-list/
│   │   │   │   ├── product-form/     handles both create and edit
│   │   │   │   └── product-details/
│   │   │   ├── services/
│   │   │   │   └── product.service.ts
│   │   │   └── models/
│   │   │       └── product.model.ts
│   │   ├── categories/
│   │   ├── users/
│   │   ├── roles/
│   │   └── errors/                   403 and 404 pages
│   │
│   ├── shared/                       reusable, no business logic
│   │   ├── components/
│   │   │   ├── data-table/
│   │   │   ├── page-header/
│   │   │   ├── pagination/
│   │   │   ├── status-badge/
│   │   │   ├── confirm-dialog/
│   │   │   ├── empty-state/
│   │   │   ├── progress-bar/
│   │   │   ├── table-skeleton/
│   │   │   └── toast-host/
│   │   ├── pipes/
│   │   │   └── price.pipe.ts
│   │   └── (no directives — see core/directives)
│   │
│   ├── app.routes.ts
│   └── app.config.ts
│
├── environments/
└── styles.css                        design tokens live here

public/
└── i18n/                             UI translation files
    ├── en.json
    └── ar.json
```

**What goes where**

**Pipes belong in `shared/`, directives did not.** A pipe is a display transform
with no service dependency — `price` takes a string and returns a string, and knows
nothing about auth or any feature, so it sits in `shared/pipes/` like any other dumb
reusable piece. `hasPermission` had to go to `core/` for the opposite reason: it
injects `AuthService`. The rule is not "directives here, pipes there" — it is
whether the thing reaches into `core/`.

**No `data-table` yet.** A generic table component is easy to get wrong before you
have seen more than one table, so Products writes its own markup. Extract it when
Categories and Users are in — three real tables show which parts actually repeat and
which only looked like they would.

- `core/` — anything instantiated once for the whole app. Never imported by `shared/`.
- `features/` — one folder per resource, mirroring the backend. Each owns its pages, its service, and its models. Features never import from each other.
- `shared/` — dumb, reusable pieces. No API calls, no permission logic, no knowledge of any feature.
- `layout/` — the shell every authenticated page renders inside.

Every feature follows the same shape. Build `products/` properly and the rest are smaller copies of it.

---

## Auth flow

Sanctum in SPA cookie mode. There is no token to store — the browser holds an httpOnly session cookie, which is why nothing sensitive ever lands in `localStorage`.

```
1. GET  /sanctum/csrf-cookie      once, before the first authenticated request
2. POST /api/login                { email, password }
3. GET  /api/me                   returns the user, their role, and their permissions
4. Permissions go into a signal — sidebar, buttons, and guards all read from it
5. POST /api/logout               clears the session, clears the signal
```

On a hard refresh the signal is empty but the cookie is still valid, so the app calls `/me` during bootstrap (`APP_INITIALIZER`) and **that call must resolve before the first route is matched** — not merely have been started.

This is load-bearing, because the layout guards read permissions synchronously
during matching. If routing runs first, `adminGuard` evaluates against an empty
array, fails, and a super admin lands in the catalog shell with Users and Roles
missing. Nothing errors; the app just quietly shows the wrong shell, which reads as
a permission bug rather than the timing bug it is. The same gap bounces a logged-in
user to `/login` on every reload.

### AuthService

```ts
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly _user = signal<User | null>(null);

  readonly user            = this._user.asReadonly();
  readonly isAuthenticated = computed(() => this._user() !== null);
  readonly permissions     = computed(() => this._user()?.permissions ?? []);

  hasPermission(permission: string): boolean {
    return this.permissions().includes(permission);
  }

  hasAny(...permissions: string[]): boolean {
    return permissions.some(p => this.hasPermission(p));
  }
}
```

`hasPermission` is the single gate for the whole UI. Nav links, buttons, table icons, and route guards all call it. One source, three uses.

---

## Permission-driven UI

### In templates

A structural directive keeps templates readable and stops permission strings from spreading through component classes:

```html
<button *hasPermission="'products.create'" class="btn-primary">
  Add Product
</button>

<button *hasPermission="'products.delete'" class="btn-danger-text">
  <i class="icon-trash"></i>
</button>
```

Pass an array where holding **any one** of several permissions is enough, which is
the same shape as the OR-gated form endpoints:

```html
<a *hasPermission="['roles.view', 'users.view']">Administration</a>
```

**It lives in `core/directives/`, not `shared/`.** It injects `AuthService`, and
two rules forbid that from `shared/`: shared code holds no permission logic, and
`shared/` never imports `core/`. A directive whose entire job is a permission
decision is core code that happens to be reusable.

### The sidebar

Built from a config array, not hardcoded markup. Each entry declares the permission that reveals it:

```ts
export const NAV_ITEMS = [
  { label: 'Dashboard',  route: '/dashboard',  icon: 'home',   permission: null },
  { label: 'Products',   route: '/products',   icon: 'box',    permission: 'products.view' },
  { label: 'Categories', route: '/categories', icon: 'tag',    permission: 'categories.view' },
  { label: 'Users',      route: '/users',      icon: 'users',  permission: 'users.view',  adminOnly: true },
  { label: 'Roles',      route: '/roles',      icon: 'shield', permission: 'roles.view',  adminOnly: true },
];
```

One array, still the only place these strings live. Each shell passes the slice it
owns to the shared `<app-sidebar>` — the catalog layout drops the `adminOnly`
entries, the admin layout passes all five — and the sidebar then filters whatever it
is given through `hasPermission`.

Both filters are doing real work, and they are not the same work. The shell decides
which section of the app exists for this user at all; `hasPermission` decides which
links inside that shell are reachable. A super admin sees five links; a
product-manager in the catalog shell sees three; a viewer sees three. Adding a
resource later means adding one line here.

### Two shells, chosen by `canMatch`

There are two layouts, and which one a user gets is itself a permission decision.
Not one layout with `@if` blocks inside it.

| Layout | Who gets it | Sidebar |
|---|---|---|
| `AdminLayoutComponent` | holds `users.view` **or** `roles.view` | Dashboard, Products, Categories, Users, Roles |
| `CatalogLayoutComponent` | everyone else | Dashboard, Products, Categories |

Both are declared at `path: ''`, separated only by their `canMatch` guard:

```ts
{ path: 'login', canMatch: [guestGuard], loadComponent: Login },
{ path: '403',                           loadComponent: Forbidden },

{ path: '', canMatch: [adminGuard], loadComponent: AdminLayout, children: [
    ...adminChildren,
]},

{ path: '', canMatch: [catalogGuard], loadComponent: CatalogLayout, children: [
    ...catalogChildren,
    { path: '**', canMatch: [catalogFallbackGuard], loadComponent: Forbidden },  // last, always
]},

{ path: '**', loadComponent: NotFound },
```

**`login` and `403` are declared before the layouts, and that ordering is
load-bearing.** An empty-path parent matches any URL as a prefix, so the catalog
shell — which carries a `**` child — matches *everything* for a signed-in user.
Declared after it, `/login` would never be reached: the catalog layout would claim
it and render 403 at it, leaving no way to sign in. Anything that must live outside
a shell goes above the two `path: ''` entries.

**Only the catalog layout gets the catch-all child.** The admin layout declares
every route in the app, so a path it does not match genuinely does not exist —
falling through to the outer `**` and reporting 404 is the honest answer there. Put
a catch-all in the admin layout and a super admin who typos `/prodcuts` is told
"not yours" about a page that is nobody's.

**Why `canMatch` and not `canActivate`.** `canActivate` runs *after* a path has
matched — the route is already chosen and its lazy chunk already fetched, and the
guard's only remaining move is to reject something the browser has downloaded.
`canMatch` runs *as part of* matching: a guard that returns `false` means the route
never matched, so Angular moves on to the next candidate and that chunk is never
requested. For a catalog user the admin layout and every screen under it simply do
not exist.

It is also the only thing that makes two routes at the same path work. Under
`canActivate` the first `path: ''` wins outright and the second is unreachable —
a rejected guard shows an error or an empty outlet, it does not fall through.

**Never use `canActivate` in this project.**

### What each guard returns

A `CanMatchFn` may return `true`, `false`, or a `UrlTree`, and the difference
between the last two is the whole routing design. `false` falls through to the next
candidate. A `UrlTree` redirects. Getting these backwards is how a user ends up at a
404 where a redirect was intended.

| Guard | Passes when | Fails with | Effect of failing |
|---|---|---|---|
| `adminGuard` | `hasAny('users.view', 'roles.view')` | `false` | falls through to the catalog shell |
| `catalogGuard` | authenticated | `UrlTree` → `/login` | last shell, so it must redirect rather than fall through |
| `permissionGuard` | route `data.permission` held | `UrlTree` → `/403` | shows the 403 screen inside the current shell |
| `guestGuard` | not authenticated | `UrlTree` → `/dashboard` | keeps a signed-in user off the login page |
| `catalogFallbackGuard` | user is *not* an admin | `false` | keeps the catalog catch-all from swallowing admins — see below |

**`adminGuard` returning a bare `false` is deliberate. Do not change it to a
redirect.** Every other guard here is terminal — nothing useful sits behind it, so
returning `false` would drop the user through to whatever happens to match next,
which is never what was wanted. `adminGuard` is the opposite case: falling through
*is* the mechanism. It is what lets a second route sit at the same `path: ''` and
pick up the user the first one declined. Give it a `UrlTree` and the catalog shell
becomes unreachable — every non-admin gets redirected somewhere instead of quietly
landing in the shell built for them.

The rule, stated once: **return `false` only when there is a deliberate next
candidate to fall through to.** In this route table that is true exactly once.

### The fallthrough trap: a mysterious 403

Falling through is what makes two shells at one path work. It is also the one
behaviour here that can waste an afternoon, because it turns a **routing** mistake
into what looks like a **permission** mistake.

A super admin opens `/roles` and gets 403 in the catalog shell, with three nav
links instead of five. Nothing is wrong with their permissions. What happened is:

1. `adminGuard` passed — they do hold `roles.view`.
2. The admin layout matched `path: ''` and tried its children against `roles`.
3. No child matched, because the route is missing from `adminChildren`.
4. A parent whose children do not match is **not** a match, so Angular backtracks
   and tries the next candidate.
5. The catalog layout matches, its catch-all child renders, and the user sees 403.

Every step is correct. The result is a screen saying "not yours" about a route that
is not anyone's, because it is not declared. **Debugging a 403 that makes no sense
starts in `app.routes.ts`, not in the permission list** — check the route exists as
a child of the layout you expect, and that its path is spelled the way you typed it
in the address bar.

This is the cost of the fallthrough, and it is worth paying: the alternative is a
single shell with conditionals inside it. But it is silent, so in development it is
made loud. `catalogGuard` warns on the console whenever it runs for a user who
holds admin permissions — that combination can only mean the admin layout matched
and then failed on its children:

```
[routes] admin route not found: /roles — falling through to the catalog shell,
which will render 403. This is a missing child route in app.routes.ts, not a
missing permission.
```

The check is wrapped in `isDevMode()`, so production stays silent.

### Child routes still carry their own permission

The layout decides which shell. The permission decides what is inside it. Each child
route declares its own, read from `data` by `permissionGuard` — also `canMatch`:

```ts
{
  path: 'users',
  canMatch: [permissionGuard],
  data: { permission: 'users.view' },
  loadComponent: () => import('./features/users/pages/user-list/user-list.component')
                         .then(m => m.UserListComponent),
}
```

This is what catches someone typing a URL into the address bar. Hiding the nav link
does not, and neither does the shell — a product-manager and a viewer share the
catalog shell, and `/products/create` is reachable for exactly one of them.

### 403, not 404, for a route that isn't yours

The catalog layout ends with a catch-all child rendering the 403 page. It must be
the **last** child in the array — a `**` sibling declared above a real route would
swallow it.

Without it, a viewer typing `/users` gets a 404: the admin layout does not match,
the catalog layout has no `users` child, so the parent match fails and the outer
`**` catches the URL. That is mechanically correct and tells the user the wrong
thing. "Broken link" is not the truth here — the page exists, it is simply not
theirs — and it throws away the 403 screen the design has specifically for this
case. The catch-all child means the catalog layout matches, and the 403 renders.

The admin layout deliberately has no such child, because there the 404 *is* honest:
that shell declares every route in the app, so an unmatched path is not a page
being withheld, it is a page that does not exist. Whether 404 or 403 is the truthful
answer depends on whether the shell is missing routes, and only the catalog one is.

**Leaving the catch-all off the admin layout is not enough on its own**, and this is
easy to get wrong. An admin is authenticated, so they match `catalogGuard` too: an
unmatched admin URL falls past the admin layout, lands in the catalog layout, and is
caught by *its* `**`. The result is a super admin being told "not yours" about a page
that is nobody's, in a shell missing half their nav. So the catch-all carries
`catalogFallbackGuard`, which passes only for a non-admin. With it, an admin's
unmatched path falls all the way through to the outer `**` and reports 404, which is
the truth.

| Situation | Result |
|---|---|
| Route in your shell, permission missing | `permissionGuard` → **403** |
| Catalog user, route only in the admin shell | catalog catch-all child → **403** |
| Admin user, route that exists nowhere | `catalogFallbackGuard` declines, outer `**` → **404** |
| Not signed in | `catalogGuard` → `/login` |

Two rendering contexts for one component, and it has to handle both. The top-level
`/403` renders bare, outside any shell, and is where `permissionGuard` redirects.
The catalog catch-all renders the same component *inside* the catalog shell, with
the sidebar still present — better for the user, who keeps their navigation and can
leave. So the 403 component must not assume a full-page canvas. (Pointing the
catch-all at `redirectTo: '/403'` instead would collapse this to one context, at
the cost of the in-shell version.)

Either way the backend still returns 403 to a direct API call. The screen a user
lands on is UX; the route is not what protects anything.

### The dashboard

The API returns only the counts the caller is allowed to see — an unauthorized count is absent from the response, not zeroed. So the dashboard **iterates the returned keys** instead of hardcoding four cards and hiding some:

```ts
cards = computed(() =>
  Object.entries(this.stats() ?? {})
    .filter(([key]) => key !== 'recent_products')
    .map(([key, value]) => ({ label: LABELS[key], value }))
);
```

Add a resource to the backend later and the dashboard picks it up with no frontend change.

---

## Routes

Every guard below is `canMatch`. There is no `canActivate` anywhere in the table.

| Path | Shell | `canMatch` | Permission |
|---|---|---|---|
| `/login` | none | `guestGuard` | — |
| `/dashboard` | both | — | — |
| `/products` | both | `permissionGuard` | `products.view` |
| `/products/create` | both | `permissionGuard` | `products.create` |
| `/products/:id` | both | `permissionGuard` | `products.view` |
| `/products/:id/edit` | both | `permissionGuard` | `products.update` |
| `/categories` | both | `permissionGuard` | `categories.view` |
| `/categories/create` | both | `permissionGuard` | `categories.create` |
| `/categories/:id/edit` | both | `permissionGuard` | `categories.update` |
| `/users` | admin | `permissionGuard` | `users.view` |
| `/users/create` | admin | `permissionGuard` | `users.create` |
| `/users/:id/edit` | admin | `permissionGuard` | `users.update` |
| `/roles` | admin | `permissionGuard` | `roles.view` |
| `/roles/create` | admin | `permissionGuard` | `roles.create` |
| `/roles/:id/edit` | admin | `permissionGuard` | `roles.update` |
| `/403` | none | — | — |
| `**` (child) | catalog | — | — (403, last child) |
| `**` (outer) | none | — | — (404) |

**Shell** is which layout declares the route as a child. The catalog children are a
subset of the admin children, declared once and spread into both `children` arrays
so the two shells cannot drift apart. The five admin-only rows exist under
`AdminLayoutComponent` alone — for a catalog user those paths fall to the catalog
layout's catch-all child and render 403. For an admin user nothing is missing, so
that layout has no catch-all and an unmatched path reaches the outer `**` as a 404.

`/dashboard` sits in both and carries no permission: the endpoint shapes its own
response to the caller, so every authenticated user has something to see there.

Every route is lazy loaded with `loadComponent`. Both shells render their children
into a `<router-outlet>`; `/login`, `/403` and `**` sit outside both.

There is no `/register` route. Accounts are created from the Users screen by someone holding `users.create`.

---

## HTTP layer

### Interceptors

**`credentialsInterceptor`** — sets `withCredentials: true` on every request and prefixes the API base URL from `environment.ts`.

**`localeInterceptor`** — sets `Accept-Language` from the currently selected locale on every request, so API messages come back in the user's language. See [Localization](#localization).

**`errorInterceptor`** — one place for every failure, so components never handle these individually:

| Status | Behaviour |
|---|---|
| 401 | clear the user signal, redirect to `/login` |
| 403 | redirect to `/403` |
| 404 | let the component decide (a missing record is not always a page error) |
| 419 | re-fetch `/sanctum/csrf-cookie`, then retry the original request **once** |
| 422 | pass validation errors through to the form |
| 5xx | error toast |

A **419 is a stale CSRF token, not a lost session.** The cookie is still valid; only
the token that came with it has expired. Sending the user to `/login` on a 419 logs
out someone who was never logged out — instead, re-fetch `/sanctum/csrf-cookie` and
replay the request one time. Retry once only: a second 419 is a real problem and
should surface as an error rather than loop.

### Feature services

One service per feature, returning typed observables. Services know about HTTP; components do not build URLs.

```ts
getAll(filters: ProductFilters): Observable<Paginated<Product>>
getById(id: number): Observable<Product>
create(data: FormData): Observable<Product>
update(id: number, data: FormData): Observable<Product>
delete(id: number): Observable<void>
```

Product create and update send `FormData` because of the image. Update posts with `_method=PUT` — PHP does not parse multipart bodies on `PUT` requests.

`UserService` carries one method the others do not — the row toggle on the Users list
fires straight from the table without opening a form, so it has its own endpoint:

```ts
toggleStatus(id: number): Observable<User>   // PATCH /api/users/{id}/toggle-status
```

It is gated by `users.update`, the same permission as the edit form. The backend's
self-protection rules apply here too: a user cannot deactivate their own account, and
the last active `super-admin` cannot be switched off. Both come back as `422` with a
message — show it as a toast and leave the toggle in its previous position.

### Endpoints that feed forms

Three endpoints exist only to populate selects and the permission matrix. They are
separate from the list endpoints, and their service methods belong to the feature
whose *form* they fill — not to the feature they read from.

| Endpoint | Fills | Backend gate |
|---|---|---|
| `GET /api/categories/options` | category select on the product form | `categories.view\|products.create\|products.update` |
| `GET /api/roles/options` | role select on the user form | `roles.view\|users.create\|users.update` |
| `GET /api/permissions` | permission matrix on the role form | `roles.view\|roles.create\|roles.update` |

`/options` returns a lightweight `id` + `name` list. `/permissions` returns all
sixteen already grouped by resource — which is exactly the shape the matrix renders,
so build the matrix from the response rather than from a hardcoded list:

```json
{ "data": { "products":   ["view", "create", "update", "delete"],
            "categories": ["view", "create", "update", "delete"],
            "users":      ["view", "create", "update", "delete"],
            "roles":      ["view", "create", "update", "delete"] } }
```

**They are OR-gated, and that is the whole point.** Each opens to any one of several
permissions, so they reach narrower roles than the list endpoints do. Someone holding
`products.create` but not `categories.view` can still fill the category dropdown
without being handed the Categories screens. Always call these from a form — calling
`GET /api/categories` to fill a select would 403 exactly the user the OR gate exists
to serve.

No seeded role needs the extra branches today (every role already holds
`categories.view`), so this will not show up in manual testing. It matters the moment
a narrower role is added.

### `price` is a string

`price` arrives as `"39.50"`, not `39.5`. The column is `decimal(10,2)` and the
backend casts it deliberately — a float cannot hold every two-decimal value exactly,
so money never becomes one in transit.

Type it as `string` on the model. Parse it at the point of display, and never do
arithmetic on it without converting explicitly and rounding on the way back out.

**Amounts are EGP, rendered as `27,499.00 EGP`** — number first, code after, the way
a price reads in Egypt. Every price goes through `shared/pipes/price.pipe.ts`, which
is the only place the currency appears, so changing it is one edit. The screenshots
show `$`; they are wrong about this, as they are about colour.

### Validation errors

The API returns `422` with `{ message, errors: { field: [...] } }`. Map those onto the reactive form so messages appear under the right input rather than in a toast:

```ts
Object.entries(err.error.errors).forEach(([field, messages]) => {
  this.form.get(field)?.setErrors({ server: messages[0] });
});
```

Client-side validators mirror the backend rules, but the server is the authority. Never rely on client validation alone.

---

## Localization

The API answers in **English or Arabic**, and the two halves of that are separate
jobs. Everything the API writes — validation errors, business-rule refusals, auth
failures, role display names, status labels — is translated server-side. Everything
in the UI's own chrome — nav labels, buttons, table headers, empty states — is ours
to translate, and the backend knows nothing about it.

### Asking the API for a language

`localeInterceptor` sets `Accept-Language` on every request from the currently
selected locale:

```http
GET /api/products
Accept-Language: ar
```

That header is the *only* thing that selects a language. There is no `?lang=`
parameter and no stored per-user preference on the server. Supported values are
`en` and `ar`; anything else falls back to `en`. Miss the header and every server
message arrives in English no matter what the UI is showing.

### The UI's own strings

The API translates its messages, not our labels. Ours live in
`public/i18n/en.json` and `public/i18n/ar.json`, nested by screen and read with the
`t` pipe:

```html
{{ 'products.title' | t }}
{{ 'products.deleteMessage' | t: { name: product.name } }}
```

`LocaleService` holds the locale and the loaded messages as signals, and
`localeInterceptor` reads the same locale. The messages load in the app initializer
alongside the `/me` bootstrap, so nothing paints as a raw key.

**The pipe is impure, deliberately.** Its input is the key, which never changes, so
a pure pipe would never re-run when the *locale* does — and switching language has
to re-render every label. The lookup is a walk down a plain object. It lives in
`core/pipes/` for the same reason as `hasPermission`: it injects a core service.

A missing key renders as the key itself rather than as blank, so a gap is obvious
on screen instead of silently swallowing a label.

**`shared/` cannot translate**, because it must not import `core/`. Every label a
shared component shows is an input: `confirm-dialog` takes `confirmLabel`,
`cancelLabel` and `busyLabel`; `pagination` takes a `summary` template carrying
`{from}`, `{to}` and `{total}`; `data-table` takes all its state copy and passes the
pagination labels down. Their defaults are English, so a forgotten binding shows
English rather than nothing — every feature passes them explicitly.

Column headers are a `computed`, not a static array, for the same reason the pipe is
impure: switching language has to re-label the header.

Two things stay untranslated on purpose:

- **Permission strings** — `products.view` and its fifteen siblings are identifiers.
  They are compared, never printed.
- **Role keys** — `super-admin` is the key; `Super Admin` / مشرف عام is the label.
  The API returns both (`role` and `role_display_name`, `name` and `display_name`).
  Guards and `hasRole` checks compare the key; the screen prints the label. Never
  translate the key — a translated key matches nothing and silently opens or closes
  every route behind it.

Product and category names are user data and come back the same in both languages.

### The switcher

A language switcher sits in the topbar, beside the user's name. Selecting a language
loads that message file, sets the locale signal the interceptor reads, sets `lang`
and `dir` on the document, and persists the choice. The locale is not stored
server-side, so this is a display preference rather than auth state and browser
storage is fine for it — wrapped in try/catch, because a private window can throw.

**Switching reloads the page**, and that is the point rather than a shortcut. Our own
labels re-render from the signal instantly, but everything the *API* worded — status
labels, role display names, validation messages — arrived in the previous language
and would sit there until each screen happened to refetch. The result is half a
screen in each language. Reloading is blunt but it guarantees one language on screen
at a time, and the choice is already persisted, so it survives the reload.

RTL is a layout concern, not a translation one: the sidebar moves to the right, table
columns and icon positions mirror, and anything positioned with a hardcoded `left`
or `right` breaks. Use logical utilities throughout — `ms-`/`me-`, `ps-`/`pe-`,
`start-`/`end-`, `text-start`/`text-end`, `border-e` — and logical properties
(`margin-inline-start`, `inset-inline`) in the few hand-written stylesheets.

A handful of things mirror by direction rather than by position, and those use the
`rtl:` variant: the logout arrow and the row-expand chevron flip with
`rtl:-scale-x-100`, the toggle knob travels the other way with `rtl:-translate-x-4`,
and the pagination chevrons swap glyphs.

---

## Design system

The visual direction takes its cue from the 2B storefront — red as the brand colour, white cards on a light grey field, compact status pills — but not its density. A storefront sells to a visitor in two minutes; this panel is stared at for eight hours. Restraint wins here.

### Tokens

Everything lives in `src/styles.css` inside Tailwind's `@theme` block. Declaring a
token there does two things at once: it emits the CSS custom property, and it
generates the matching Tailwind utility. So `--color-primary` answers to both
`var(--color-primary)` in a component stylesheet and `bg-primary` in a template,
and the compiled utility is literally `background-color: var(--color-primary)` —
the same value, not a copy of it. Changing the brand red means changing one line.

Use `@theme`, not `:root`. A token in `:root` still works with `var(--…)` but
generates no utility, which is how the two halves drift apart.

Tailwind's namespaces decide which utility a token generates: `--color-*` produces
`bg-`, `text-` and `border-`; `--radius-*` produces `rounded-`; `--text-*`
produces font sizes. The names below are chosen to land in those namespaces, so
`--radius-md` is `rounded-md` and `--text-page-title` is `text-page-title`.

```css
@import "tailwindcss";

@theme {
  /* brand */
  --color-primary:        #D32F2F;
  --color-primary-hover:  #B02525;
  --color-primary-subtle: #FDECEC;   /* active nav item, focus ring bg */

  /* destructive — deliberately darker than primary */
  --color-danger:         #B71C1C;
  --color-danger-subtle:  #FDECEC;

  /* semantic */
  --color-success:        #1B7F4C;
  --color-success-subtle: #E7F5EC;
  --color-warning:        #B26B00;
  --color-warning-subtle: #FDF3E3;

  /* neutrals — warm grey ramp */
  --color-bg:             #F7F7F8;   /* page background */
  --color-surface:        #FFFFFF;   /* cards, tables */
  --color-border:         #E6E6E8;
  --color-text:           #17171A;
  --color-text-secondary: #5C5C66;
  --color-text-muted:     #8A8A94;

  /* radius */
  --radius-sm: 6px;   /* inputs, badges */
  --radius-md: 8px;   /* cards, buttons */

  /* type */
  --text-page-title: 20px;
  --text-section:    16px;
  --text-body:       14px;
  --text-table:      13px;
  --text-meta:       12px;
}
```

### Colour rules

- **Red is the brand.** Logo, active nav item, primary buttons, links, focus rings.
- **Red is also destructive** — which is the risk. Keep them apart by shape, not just shade: primary actions are **filled** buttons; destructive actions are **text buttons or icons**, never filled. A filled red `Save` next to a filled red `Delete` is a mistake waiting to happen.
- **Green and amber are status only.** Active / Inactive badges, low stock. Never decoration.
- Nothing else gets colour. If a screen has more than three accent colours on it, something is wrong.

### Layout

- Light sidebar, 240px, white, hairline right border. Active item: `--color-primary-subtle` background, primary-coloured text and icon.
- Page background `--color-bg`, content in white cards with 1px borders. No shadows except on floating layers — modals, dropdowns, toasts.
- 4px spacing grid. Table rows 44px. Inputs and buttons 36px.
- Target width 1280px. Tables must stay readable there without horizontal scroll.
- Outline icons, one set throughout. 16px inline, 18px in the nav.
- Sentence case everywhere. No ALL CAPS labels, no emoji.

### The loading bar

A 2px bar pinned to the top of the viewport in `--color-primary`, above every layer
including modals and toasts.

Two triggers, one bar: router navigation, so it covers a lazy chunk downloading, and
in-flight HTTP through `progressInterceptor`. **HTTP is counted, not flagged** — with
a boolean, two concurrent requests would hide the bar the moment the first finished
while the second was still running. It appears only after about 150ms of activity,
so a fast response never flashes it.

It complements the table skeletons rather than replacing them. The bar says
"something is happening"; the skeleton says "this table is filling in". Both stay.

`ProgressService` (core) decides; `shared/components/progress-bar/` just renders what
it is told, so `shared/` stays free of core.

### Every screen needs its states

Not just the happy path. Each list screen ships with:

- **Loading** — skeleton rows, not a spinner over an empty page
- **Empty (no records)** — an illustration-free message and, if permitted, the create button
- **Empty (no filter results)** — different copy, plus a clear-filters action
- **Error** — a short message and a retry

Every interactive element gets default, hover, active, focus-visible, and disabled states.

---

## Screens

| Screen | Notes |
|---|---|
| Login | outside the shell, centred card. Email, password with a visibility toggle, submit. No register link, no remember-me, no forgot-password |
| Dashboard | permission-driven stat cards + recent products (name, category, price, stock, status, created at) with a View all link to `/products` |
| Products list | search, category filter, status filter, pagination, result count, row actions. Image thumbnail as the first column |
| Product details | read-only; image, category, price, stock, status, description, created at, updated at. Back link. Edit filled, Delete text-only, both permission-gated |
| Product form | create and edit share one component; image upload with preview, PNG/JPG up to 2 MB |
| Categories list | search, pagination, result count. Columns: name, description, products count, created at. Edit and delete only — there is no category details screen |
| Category form | name and description only |
| Users list | search, role filter, status filter, pagination, result count. Columns: name, email, role, status. Row actions: view, edit, status toggle, delete — each gated by its own permission |
| User details | read-only; email, role, status, created. Edit gated by permission |
| User form | name, email, password (+ confirmation), role select from `/api/roles/options`. On edit the password is left blank to keep the current one |
| Roles list | expandable rows showing the permission matrix, a per-action count out of four, `users_count`, and a total-roles footer. `super-admin` is listed with its actions disabled |
| Role form | name, description, permission matrix over all four resources with row and column select-all |
| 403 | a route you lack permission for, or one only the admin shell has. Short message + a link back to the dashboard |
| 404 | a path that exists in no shell. Same shape as the 403 |

The 403 renders bare at `/403` and inside the catalog shell as its catch-all, so
build it to work with and without a sidebar. The 404 sits outside both shells and
always renders bare.

Logout is **not** a nav item. It lives in the topbar, next to the language switcher.
`NAV_ITEMS` stays purely navigational — a Logout entry would be the one row in that
array with no route and no permission, and the permission-strings rule depends on
every row having both.

### Reading the screenshots

`docs/screens/` holds one image per screen. They are a **skeleton, not a spec.**

Fixed — follow them: which screens exist and what is on each; the information
architecture (sidebar order, table columns, form fields, where the primary action
sits); and the overall shape of sidebar + topbar + content, cards on a light field.

Not fixed — improve on them: spacing, proportion, typographic hierarchy, empty and
loading states, and how filters, badges, row actions and pagination are presented.

**Overridden entirely by this README**, wherever they disagree:

- **Colour.** The screenshots are blue throughout. The accent is the red in the
  token block. Never sample a colour from an image.
- **Type scale, radius, spacing grid.** Ours, from the token block.
- **Button shape.** The screenshots put a filled red Delete beside a filled blue
  Edit on Product Details. Primary actions are filled; destructive actions are text
  or icon, never filled.
- **Decorative colour.** Each dashboard card gets its own tinted icon in the
  screenshots. Green and amber are status only, and nothing else gets colour.

They also show four things that no longer apply. The Users table has separate Type
and Role columns — Type is gone, the role is the only source of truth. The Login
screen has a Register link — there is no public registration; accounts are created
from the Users screen by someone holding `users.create`. The Login screen also has
Remember me and Forgot password, and the API has no endpoint behind either. And the
sidebar carries a Logout item, which belongs in the topbar.

Two more to correct as you build. Its permission counts read `x / 8`, which matches
nothing: there are sixteen permissions over four resources, so a per-action column is
out of four. And the expanded row shows only Products and Categories, where the
matrix covers all four resources.

The roles matrix is headed **Read**. Render **View** instead. A column header is a
display label, not a key — the same split as `role` and `role_display_name` — so
printing "Read" while sending `view` would be perfectly safe. Use "View" anyway, so
the screen says what the API says and nobody has to carry two vocabularies for one
concept.

The roles list shows four roles where the seeder creates five. `super-admin` is
listed like any other, with its edit and delete disabled: it is protected, which is
not the same as hidden. Filtering it out would also put the list at odds with the
dashboard's own role count.

Where the two screenshots contradict each other, `Users.jpeg` shows edit, delete and
no status toggle while `whole_design.jpeg` shows a toggle and no delete. The API has
both `DELETE /api/users/{id}` and `PATCH /api/users/{id}/toggle-status`, each gated
by its own permission, so the row carries both.

Every screenshot shows the **super admin** view — the widest version of every screen,
in the admin shell, with every table populated. Any other role sees a subset:
possibly a different shell, and within it fewer nav links, fewer buttons, fewer row
actions. And no screenshot shows a loading, empty, or error state, though all four
states are required on every list. Design against the super admin view, then verify
each screen twice — as a `viewer` for the permission filtering, and once in the
catalog shell for the layout itself.

---

## Conventions

- Standalone components only. No NgModules.
- Signals for state. RxJS for HTTP streams only — do not mix them for local component state.
- New control flow: `@if`, `@for`, `@switch`. Not `*ngIf` / `*ngFor`.
- `inject()` over constructor injection.
- Typed models for every API response. No `any`.
- `price` is typed `string`, because the API sends `"39.50"` deliberately. Parse it to display it; never treat it as a number by accident.
- Permission strings only in `NAV_ITEMS`, route `data`, the layout `canMatch` guards, and `*hasPermission`. Four places, never scattered through component logic. The roles form is not a fifth: it builds `resource.action` keys from the matrix the API returns, as **payload to send back**, not as a gate to check. Nothing there decides what this user may do.
- `canMatch` for every guard. Never `canActivate`.
- Features never import from other features. Shared code moves to `shared/`.
- One component per file, and the file name matches the selector.

---

## Setup

```bash
npm install
npm start          # http://localhost:4200
```

`src/environments/environment.ts`:

```ts
export const environment = {
  apiUrl: 'http://localhost:8000',
};
```

The Laravel API must be running on port 8000 with `SANCTUM_STATEFUL_DOMAINS=localhost:4200`, `SESSION_DOMAIN=localhost`, and CORS `supports_credentials` enabled. Without those three, login returns 200 but every subsequent request comes back 401 — the cookie is set but never sent back.

**Run it with `php artisan serve` on `localhost:8000`, not on its Herd `.test`
domain.** The session cookie is `SameSite=lax`, which means the browser only sends it
on requests between hosts sharing a registrable domain. `localhost:4200` and
`product-management-api.test` do not share one, so the cookie is set on login and
then silently dropped from every request after it — the same 401 as above, with
nothing in the config to explain it. Both sides have to sit under `localhost`; the
port differing is fine, because `SameSite` ignores the port.

Seeded login: `admin@example.com` / `password`.

---

## Build order

One step complete before the next.

1. Shell — the two layouts, sidebar, topbar, and the `canMatch` routing skeleton
2. Auth — login, `AuthService`, interceptors, the `/me` bootstrap, and the layout guards
3. `hasPermission` directive and the permission-filtered sidebar
4. Products, end to end — list, filters, pagination, form, upload, details, delete
5. Categories, Users, Roles — same pattern, less surface
6. Dashboard, 403, 404
7. Empty, loading, and error states across every list

Steps 1 and 2 are deliberately in that order and deliberately adjacent. The routing
skeleton is built first with both shells in place, but the guards that pick between
them cannot do anything real until `/me` resolves — so step 1 stands up the two
layouts and the route shape, and step 2 makes the choice between them mean
something. A shell built as one layout in step 1 has to be taken apart again in
step 2.

Products is deliberately fourth and deliberately first among features. It is the fullest one — filters, pagination, file upload, a relation. Everything after it is a smaller version of the same work.
