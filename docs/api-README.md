# Product Management — Backend API

Laravel REST API for an internal admin panel. Staff manage a product catalog; a super admin controls who can do what through roles and permissions.

This is an **internal tool**. There is no public signup — the first admin is seeded, and every other account is created from inside the panel.

The Angular SPA that consumes this API lives in a separate repository.

---

## Tech stack

| Concern | Choice |
|---|---|
| Framework | Laravel 13 |
| Database | MySQL |
| Authentication | Laravel Sanctum (SPA cookie mode) |
| Authorization | `spatie/laravel-permission` (middleware, not policies) |
| API style | REST, JSON only |

---

## Architecture

Every request follows the same path. No layer skips the one below it.

```
Request
  ↓
FormRequest        Gate 1 — is the data valid?          fails → 422
  ↓
permission MW      Gate 2 — is this user allowed?       fails → 403
  ↓
Controller         takes the request, returns a response
  ↓
Service            business logic
  ↓
Repository         the only layer that touches the database
  ↓
Model → Database
  ↓
API Resource       shapes the JSON going back out
```

### Layer rules

These are not suggestions. Code that breaks them should be rejected in review.

**Direction — each layer knows only the one directly below it**

- The Controller knows the Service. It does not know the Repository, and it never touches Eloquent.
- The Service knows the Repository, and only through its interface.
- The Service knows nothing about HTTP. No `request()`, no `response()`, no status codes inside it.
- The Repository is the only place `Product::where(...)` or any query builder call may appear.

**Responsibility — who does what**

| Job | Belongs to | Never in |
|---|---|---|
| Validation | `FormRequest` | Controller, Service |
| Authorization | `permission:` middleware on the route | Service, Controller body |
| Query building, filters, pagination, eager loading | Repository | Service, Controller |
| Business rules | Service | Controller, Repository |
| JSON shaping | API Resource | Controller (never build arrays by hand) |

**Types — what moves between layers**

- Controller passes `$request->validated()` (an array) to the Service — never the `Request` object itself.
- Service and Repository return Models or Collections — never JSON.
- The Resource is the last stop before the response leaves.

**Identifiers — controllers take ids, not models**

This project does not use route-model binding. A bound `{product}` would be
resolved by the framework, which means the query that loads it runs outside the
repository — the one thing the layer rules above forbid. Controllers therefore
receive an `int` and hand it down:

```php
show(int $id)
update(UpdateProductRequest $request, int $id)
destroy(int $id)
```

The repository's `findById()` is the only thing that turns an id into a model.

**The caller — services receive the acting user as an argument**

Some business rules depend on *who* is asking: a user may not delete their own
account, and the last active super admin may not be deactivated. The service owns
those rules, but it has no way to ask who is logged in without reaching for
`auth()` or `request()`, which the layer rules forbid.

So the controller supplies the caller explicitly, as a second argument:

```php
// UserController
public function destroy(Request $request, int $id): Response
{
    $this->users->delete($id, $request->user());

    return response()->noContent();
}

// UserService
public function delete(int $id, User $actor): void
```

`$request->user()` is a Model, so nothing HTTP-shaped crosses the boundary — the
service receives the same kind of thing a repository would hand it. This is the
standard way any service learns who the caller is; a service must never resolve
the current user itself.

**Exceptions — two, both narrow**

Two of the rules above have exactly one sanctioned exception each. They are named
here so they read as decisions rather than drift. Anything else that looks like
them is a bug, not a precedent.

*A service may read the caller's permissions to shape response content.* The
dashboard omits a count entirely when the caller cannot view that resource, so
`DashboardService` asks `$actor->can(...)` before including each section. This is
content shaping, not access control: nothing is being protected here. The endpoint
itself is still gated by route middleware, and every resource it counts stays
independently gated on its own routes — a caller who sees no `products` key is
equally unable to reach `GET /api/products`. A service must still never decide
whether a request is *allowed*; that stays in `permission:` middleware.
`DashboardService` is the only current case.

*A service may return an array when the response is an aggregate with no backing
model.* `DashboardService::for()` returns four counts and a list of recent products.
There is no Dashboard model and no single table behind it, so there is nothing to
return a Model or Collection of; forcing one would mean inventing a model that
represents nothing. Every service backed by a real table still returns Models or
Collections, and no service ever returns JSON or a response.

**Dependency injection**

- Every layer receives the one below it through the constructor. Never `new`.
- Services depend on `ProductRepositoryInterface`, not `ProductRepository`.
- All bindings live in one place: `RepositoryServiceProvider`.

```php
// app/Providers/RepositoryServiceProvider.php
public function register(): void
{
    $this->app->bind(ProductRepositoryInterface::class, ProductRepository::class);
    $this->app->bind(CategoryRepositoryInterface::class, CategoryRepository::class);
    $this->app->bind(UserRepositoryInterface::class, UserRepository::class);
    $this->app->bind(RoleRepositoryInterface::class, RoleRepository::class);
}
```

---

## Folder structure

```
app/
├── Http/
│   ├── Controllers/
│   │   └── Api/
│   │       ├── AuthController.php
│   │       ├── DashboardController.php
│   │       ├── ProductController.php
│   │       ├── CategoryController.php
│   │       ├── UserController.php
│   │       └── RoleController.php
│   ├── Requests/
│   │   ├── Auth/
│   │   │   └── LoginRequest.php
│   │   ├── Product/
│   │   │   ├── StoreProductRequest.php
│   │   │   └── UpdateProductRequest.php
│   │   ├── Category/
│   │   ├── User/
│   │   └── Role/
│   └── Resources/
│       ├── ProductResource.php
│       ├── CategoryResource.php
│       ├── UserResource.php
│       └── RoleResource.php
│
├── Services/
│   ├── AuthService.php
│   ├── DashboardService.php
│   ├── ProductService.php
│   ├── CategoryService.php
│   ├── UserService.php
│   └── RoleService.php
│
├── Repositories/
│   ├── Contracts/
│   │   ├── ProductRepositoryInterface.php
│   │   ├── CategoryRepositoryInterface.php
│   │   ├── UserRepositoryInterface.php
│   │   └── RoleRepositoryInterface.php
│   └── Eloquent/
│       ├── ProductRepository.php
│       ├── CategoryRepository.php
│       ├── UserRepository.php
│       └── RoleRepository.php
│
├── Models/
│   ├── Product.php
│   ├── Category.php
│   └── User.php
│
├── Providers/
│   └── RepositoryServiceProvider.php
│
└── Exceptions/

lang/
├── en.json          whole sentences, keyed by the English sentence
├── ar.json
├── en/
│   ├── enums.php    role display names + descriptions, status labels
│   └── validation.php
└── ar/
    ├── enums.php
    └── validation.php
```

New features follow the same shape: Controller → Request → Service → Repository interface → Repository → Resource.

### Repository method naming

Keep these names consistent across every repository so features stay predictable:

```php
paginateWithFilters(array $filters, int $perPage = 15)
findById(int $id)
create(array $data)
update(int $id, array $data)
delete(int $id)
```

### Model conventions

This project runs Laravel 13, where a model declares mass assignment and hidden
attributes as class attributes rather than as properties. Follow the style already
in `User.php` — `#[Fillable([...])]` and `#[Hidden([...])]`, not `$fillable`
and `$hidden` arrays. Casts stay in the `casts()` method.

Where a column carries a database default, mirror it in `$attributes` too. Eloquent
does not read defaults back after an insert, so without it a freshly created record
returns `null` for `is_active` while the row itself holds `1`.

---

## Database schema

### `users`

| Column | Type | Notes |
|---|---|---|
| id | bigint PK | |
| name | string | |
| email | string, unique | |
| password | string, hashed | |
| is_active | boolean, default true | `false` blocks login entirely |
| timestamps | | |

There is **no `type` column**. A user's role is the single source of truth for what they are — an administrator is someone holding the `super-admin` role, not someone with a separate flag. Two competing fields would allow contradictory states.

### `categories`

| Column | Type | Notes |
|---|---|---|
| id | bigint PK | |
| name | string, unique | |
| description | text, nullable | |
| timestamps | | |

`products_count` is never stored — it is derived with `withCount('products')`.

### `products`

| Column | Type | Notes |
|---|---|---|
| id | bigint PK | |
| name | string | |
| description | text, nullable | |
| price | decimal(10,2) | |
| stock | unsigned integer, default 0 | |
| image_path | string, nullable | stored on the `public` disk |
| is_active | boolean, default true | drives the Active / Inactive badge |
| category_id | FK → categories, restrict on delete | |
| timestamps | | |

### Spatie tables

`roles`, `permissions`, `model_has_roles`, `role_has_permissions` come from the package migration. Each user holds exactly one role in this project, though the schema supports more.

One column is ours: `roles.description`, a nullable string added by `add_description_to_roles_table`. The roles screen prints it as a one-line explanation under each role name. The migration reads the table name from `config('permission.table_names.roles')` rather than hardcoding `roles`, so it still applies if the package's table names are ever changed.

For the five seeded roles the description the API returns comes from `lang/{locale}/enums.php`, and the column holds the English text as an untranslated fallback. For a role created through the API the column is the only source. See [Localization](#localization).

---

## Permissions

Sixteen permissions: four resources × four actions. The naming pattern is `resource.action` and it never varies.

```
products.view      products.create      products.update      products.delete
categories.view    categories.create    categories.update    categories.delete
users.view         users.create         users.update         users.delete
roles.view         roles.create         roles.update         roles.delete
```

**Single source of truth.** These strings live in `config/permissions.php` and are read from there by the seeder, the routes file, and the permissions endpoint. Never hardcode a permission string in more than one place — a typo in a route silently locks out a whole feature.

### Seeded roles

| Role | Permissions |
|---|---|
| `super-admin` | all 16 |
| `product-manager` | all four `products.*`, plus `categories.view` |
| `product-editor` | `products.view`, `products.create`, `products.update`, `categories.view` |
| `inventory-staff` | `products.view`, `products.update`, `categories.view` |
| `viewer` | `products.view`, `categories.view` |

**`super-admin` is protected.** It cannot be edited or deleted through the API, and its permission set cannot be reduced. Without this guard, removing `roles.update` from it would permanently lock everyone out of the roles screen with no way back through the UI.

---

## Authorization

Authorization is enforced by **middleware on the route**, never inside a controller or service. Policies are deliberately not used in this project.

```php
Route::middleware(['auth:sanctum', 'active'])->group(function () {

    Route::get('products', [ProductController::class, 'index'])
        ->middleware('permission:products.view');

    Route::post('products', [ProductController::class, 'store'])
        ->middleware('permission:products.create');

    Route::put('products/{product}', [ProductController::class, 'update'])
        ->middleware('permission:products.update');

    Route::delete('products/{product}', [ProductController::class, 'destroy'])
        ->middleware('permission:products.delete');
});
```

Order matters: `auth:sanctum` first (is there a logged-in user?), then `permission:` (is that user allowed?). Reversed, the permission middleware looks for a user that isn't there.

Register the aliases in `bootstrap/app.php`:

```php
->withMiddleware(function (Middleware $middleware) {
    $middleware->alias([
        'permission' => \Spatie\Permission\Middleware\PermissionMiddleware::class,
        'role'       => \Spatie\Permission\Middleware\RoleMiddleware::class,
        'active'     => \App\Http\Middleware\EnsureUserIsActive::class,
    ]);
})
```

### The rule that matters most

**The frontend hides. The backend forbids.**

Angular hides nav links, buttons, and icons the user has no permission for. That is UX only. Anyone can open a terminal and send `DELETE /api/products/5` directly. What actually stops them is `permission:products.delete` on the route.

Never treat a hidden button as a security control.

---

## Localization

The API answers in **English or Arabic**. Everything the *system* writes is
translated — validation errors, business-rule refusals, auth failures, role
display names, status labels. Everything the *user* typed is not: a product
called `Laptop` comes back as `Laptop` in both languages. There are no
`name_en` / `name_ar` columns and none are planned for now.

### Choosing the language

`App\Http\Middleware\SetLocale` reads the request's `Accept-Language` header
and calls `App::setLocale()`. Nothing else selects a language — there is no
`?lang=` parameter and no per-user stored preference.

```http
GET /api/products HTTP/1.1
Accept-Language: ar
```

The header is matched against `config('app.supported_locales')`, which is
`['en', 'ar']`. Quality values and region subtags both work, so
`ar-EG,ar;q=0.9,en;q=0.5` resolves to `ar`. Anything the list does not
contain — `fr`, junk, or no header at all — falls back to the **first entry**,
which is why `en` is listed first. Adding a language means adding its files
and its code to that array; nothing else reads the header.

`SetLocale` is registered as **global** middleware, not on the `api` group.
Group middleware runs after routing, so a request matching no route at all
would 404 in English no matter what the caller asked for.

### Where the files live

Two styles, each for a different kind of text.

| File | Holds | Keyed by |
|---|---|---|
| `lang/en.json`, `lang/ar.json` | Whole sentences | The English sentence |
| `lang/en/enums.php`, `lang/ar/enums.php` | Short fixed labels | The identifier they describe |
| `lang/en/validation.php`, `lang/ar/validation.php` | Validation rule messages | The rule name |

**Sentences → JSON.** Every message this application writes itself is a JSON
entry keyed by its English text, read with `__()`:

```php
throw new InactiveAccountException;          // 'This account has been deactivated.'
__('You cannot delete your own account.');
```

That covers all twelve business-rule refusals, the auth messages, and the 401 /
404 sentences. Two of Laravel's own and four of `spatie/laravel-permission`'s
messages land here too, because both packages already call `__()` with an
English sentence as the key — the 403 you get from `permission:` middleware is
translated purely by having `"User does not have the right permissions."` in
`ar.json`.

Counted messages use `trans_choice()`, and the key is the full English
`singular|plural` string. English supplies two segments; **Arabic supplies
six**, because Laravel's `MessageSelector` implements the real Arabic plural
rule (0, 1, 2, 3–10, 11–99, everything else, on `n % 100`). Write six plain
segments with no `{n}` or `[n,m]` markers — explicit markers short-circuit the
modulo rule and get 105 wrong.

**Fixed labels → `enums.php`.** Role display names, role descriptions, and the
active / inactive status labels are short values attached to an identifier, so
they are keyed by that identifier rather than by an English sentence.

**Validation is the exception, and deliberately so.** Laravel resolves a
validation message by *rule name* (`validation.required`), never by its English
text, so these cannot live in the JSON catalogue — a `lang/{locale}/validation.php`
array is the only file the validator will read. `lang/ar/validation.php` is
therefore a complete file, not a partial one: any rule missing from it silently
falls back to English. Field names come from its `attributes` array, so
`category_id` reads as `الفئة` rather than `category id`.

Two conventions in the Arabic file are worth keeping. Every message says
`حقل :attribute`, not `:attribute` alone, because the substituted field name may
be masculine (`الاسم`) or feminine (`الصورة`) while `حقل` is always masculine —
that keeps agreement correct whatever the field. And counted nouns are written
`:max من الأحرف` rather than as a bare count, because Arabic changes the noun's
form with the number and `:max` is not known in advance.

### Roles: the key is not the label

This is the distinction that breaks authorization if it is gotten wrong.

`super-admin`, `product-manager`, `product-editor`, `inventory-staff` and
`viewer` are **keys**. They are the `name` column in the `roles` table, the
array keys in `config/permissions.php`, and the strings inside every `role:`
middleware declaration. **They are never translated.** Translating one would
stop it matching the database, and every gated route behind it would silently
open or close.

Only the display name and the description are translated:

```php
// config/permissions.php — the key and its permission set. No prose.
'super-admin' => ['permissions' => ['products.view', ...]],

// lang/ar/enums.php — the prose, under the same key.
'super-admin' => ['name' => 'مشرف عام', 'description' => '...'],
```

`config/permissions.php` stays the source of the role keys and their permission
sets. The human-readable description used to live there and no longer does.

So the API returns both, side by side, and never one instead of the other:

```json
{ "id": 1, "name": "super-admin", "display_name": "مشرف عام", "description": "..." }
```

`name` is what Angular's route guards and `hasRole()` checks compare against;
`display_name` is what it prints. The same split appears on a user, as `role`
and `role_display_name`. A role created through the API has no entry in
`enums.php`, so its `display_name` falls back to its key and its `description`
to the value stored on the row.

`roles.description` is still a real column. The seeder writes the **English**
text into it as an untranslated fallback for anything reading the table
directly; `RoleResource` prefers the caller's locale and only drops back to the
column for roles `enums.php` does not know.

### Adding a message

1. A whole sentence → add the English text as a key to **both** `lang/en.json`
   and `lang/ar.json`, and call `__()` with that exact English text.
2. A fixed label → add it under its identifier in **both** `enums.php` files.
3. Never build a sentence by concatenating translated fragments. Where a
   message varies — `deleted` / `deactivated` / `demoted` — write each variant
   as a whole sentence and pick between them with `match`, as
   `LastActiveSuperAdminException` does. Glued fragments do not survive a
   change of language.
4. Identifiers interpolated *into* a sentence — a role key, a permission
   string — stay untranslated, so the caller can still find what they sent.

---

## API contract

Base path: `/api`. All responses are JSON.

### Conventions

Money is a string. `price` is `decimal(10,2)`, and the `decimal:2` cast renders it
as `"39.50"` rather than a float — floats cannot hold every two-decimal value
exactly. Leave it that way; Angular parses it for display.

Single resource:

```json
{ "data": { "id": 1, "name": "Laptop" } }
```

Paginated list:

```json
{
  "data": [ ... ],
  "meta": { "current_page": 1, "per_page": 15, "total": 42, "last_page": 3 }
}
```

Error:

```json
{
  "message": "The given data was invalid.",
  "errors": { "price": ["The price must be a number."] }
}
```

| Code | When |
|---|---|
| 200 | success |
| 201 | created |
| 204 | deleted, no body |
| 401 | not authenticated |
| 403 | authenticated but lacks the permission, or account is inactive |
| 404 | record not found |
| 422 | validation failed |

Every `message` and every entry in `errors` is returned in the language the
request's `Accept-Language` header asked for — see [Localization](#localization).

The 401 and both 404s are worded by this application rather than by the
framework, so they are translatable and so the model 404 stops echoing the
Eloquent class name back to the caller:

```json
{ "message": "You are not signed in." }             // 401
{ "message": "The requested record was not found." } // 404, no such row
{ "message": "The requested endpoint does not exist." } // 404, no such route
```

Force JSON errors for API routes so Laravel never returns an HTML error page to the SPA.

---

### Auth

| Method | Endpoint | Permission | Notes |
|---|---|---|---|
| GET | `/sanctum/csrf-cookie` | — | call before login |
| POST | `/api/login` | — | |
| POST | `/api/logout` | auth | |
| GET | `/api/me` | auth | |

**POST `/api/login`** — `{ email, password }`

Returns the user with their role and flattened permission list. `422` on wrong credentials, `403` if `is_active` is false.

**GET `/api/me`** — the endpoint the whole frontend is built on:

```json
{
  "data": {
    "id": 1,
    "name": "Admin User",
    "email": "admin@example.com",
    "is_active": true,
    "status_label": "Active",
    "role": "super-admin",
    "role_display_name": "Super Admin",
    "permissions": ["products.view", "products.create", "..."]
  }
}
```

Angular builds the sidebar, the action buttons, and the route guards from this single array. One source, three uses.

`role` is the key and `role_display_name` the label; guards compare against the
first and print the second. `status_label` is the translated text for the badge
`is_active` drives, and appears on products too.

---

### Dashboard

| Method | Endpoint | Permission |
|---|---|---|
| GET | `/api/dashboard` | auth |

The response is **built from the caller's permissions**. A count is omitted entirely — not zeroed, not hidden client-side — when the user lacks the matching `*.view`:

```json
// super-admin
{ "data": { "products": 24, "categories": 8, "users": 12, "roles": 5,
            "recent_products": [ ... ] } }

// viewer
{ "data": { "products": 24, "categories": 8, "recent_products": [ ... ] } }
```

`recent_products` (latest 5) appears only with `products.view`. Angular iterates the returned keys rather than hardcoding four cards, so adding a resource later needs no frontend change.

---

### Products

| Method | Endpoint | Permission |
|---|---|---|
| GET | `/api/products` | `products.view` |
| POST | `/api/products` | `products.create` |
| GET | `/api/products/{id}` | `products.view` |
| POST | `/api/products/{id}` | `products.update` |
| DELETE | `/api/products/{id}` | `products.delete` |

Query params on index: `search` (name), `category_id`, `status` (`active` / `inactive`), `page`, `per_page`. Filtering belongs in `ProductRepository::paginateWithFilters()`.

Update uses `POST` with `_method=PUT` because the image is sent as multipart form data.

**Validation** — store:

```php
'name'        => ['required', 'string', 'max:255'],
'description' => ['nullable', 'string'],
'price'       => ['required', 'numeric', 'min:0'],
'stock'       => ['required', 'integer', 'min:0'],
'category_id' => ['required', 'exists:categories,id'],
'image'       => ['nullable', 'image', 'mimes:png,jpg,jpeg', 'max:2048'],
'is_active'   => ['boolean'],
```

Update is the same with `sometimes` in place of `required`. Replacing an image deletes the old file.

The index always eager-loads the category — the list shows a category name on every row, and without it the endpoint runs an N+1.

---

### Categories

| Method | Endpoint | Permission |
|---|---|---|
| GET | `/api/categories` | `categories.view` |
| POST | `/api/categories` | `categories.create` |
| GET | `/api/categories/{id}` | `categories.view` |
| PUT | `/api/categories/{id}` | `categories.update` |
| DELETE | `/api/categories/{id}` | `categories.delete` |
| GET | `/api/categories/options` | `categories.view\|products.create\|products.update` |

`/options` returns a lightweight `id` + `name` list for the category dropdown on the product form. The OR gate exists so that a role holding only product-create rights can still populate that dropdown, without being granted management access to the category screens. Spatie's middleware treats `|` as OR.

No seeded role exercises this today — every role in the table above already holds `categories.view`, so the first branch of the OR always matches. The gate is there to keep the door open for a narrower role later, and removing it would quietly make such a role impossible to add.

**Delete rule:** a category holding products cannot be deleted. The Service checks the count and returns `422` with a clear message. This is a business rule, so it lives in `CategoryService`, not the controller.

Validation: `name` required, max 255, unique (ignoring the current row on update); `description` nullable.

---

### Users

| Method | Endpoint | Permission |
|---|---|---|
| GET | `/api/users` | `users.view` |
| POST | `/api/users` | `users.create` |
| GET | `/api/users/{id}` | `users.view` |
| PUT | `/api/users/{id}` | `users.update` |
| DELETE | `/api/users/{id}` | `users.delete` |
| PATCH | `/api/users/{id}/toggle-status` | `users.update` |

Query params on index: `search` (name or email), `role`, `status`, `page`.

`toggle-status` is separate from `update` because it is fired straight from the table row without opening a form.

**Validation** — store:

```php
'name'     => ['required', 'string', 'max:255'],
'email'    => ['required', 'email', 'unique:users,email'],
'password' => ['required', 'string', 'min:8', 'confirmed'],
'role'     => ['required', 'exists:roles,name'],
```

On update, `password` is `nullable` and only rehashed when present.

**Self-protection rules**, enforced in `UserService`:

- A user cannot delete their own account.
- A user cannot deactivate their own account.
- The last active `super-admin` cannot be deleted or deactivated.
- The last active `super-admin` cannot be demoted to another role. Only a change of role trips this; editing that user's name or email is always allowed.

The last two rules guard the same door. Without them it is possible to lock every administrator out of the system with a single click — by deleting the account, by switching it off, or by quietly changing its role on the edit form.

---

### Roles

| Method | Endpoint | Permission |
|---|---|---|
| GET | `/api/roles` | `roles.view` |
| POST | `/api/roles` | `roles.create` |
| GET | `/api/roles/{id}` | `roles.view` |
| PUT | `/api/roles/{id}` | `roles.update` |
| DELETE | `/api/roles/{id}` | `roles.delete` |
| GET | `/api/roles/options` | `roles.view\|users.create\|users.update` |
| GET | `/api/permissions` | `roles.view\|roles.create\|roles.update` |

`/roles/options` feeds the role dropdown on the user form, gated the same way and for the same reason as `/categories/options`: a role holding only user-create rights can fill the dropdown without being granted access to the role screens. As with categories, no seeded role needs the extra branches yet.

`/permissions` returns all sixteen grouped by resource, which is exactly the shape the permissions matrix renders:

```json
{
  "data": {
    "products":   ["view", "create", "update", "delete"],
    "categories": ["view", "create", "update", "delete"],
    "users":      ["view", "create", "update", "delete"],
    "roles":      ["view", "create", "update", "delete"]
  }
}
```

A role's own response carries its permission list plus `users_count`, which the roles screen uses for the `3 / 16` style summary.

**Rules, enforced in `RoleService`:**

- `super-admin` cannot be updated or deleted.
- A role assigned to at least one user cannot be deleted — reassign those users first (`422`).
- Every permission sent must exist in `config/permissions.php`.

Validation: `name` required and unique; `description` nullable, max 255; `permissions` an array where each entry is `in:` the configured list.

---

## Setup

```bash
composer install
cp .env.example .env
php artisan key:generate

# set DB_* in .env, then:
php artisan migrate --seed
php artisan storage:link
php artisan serve
```

The seeder creates the sixteen permissions, the five roles, and one super admin:

```
admin@example.com / password
```

Change it before anything leaves your machine.

### Sanctum SPA configuration

```env
APP_URL=http://localhost:8000
FRONTEND_URL=http://localhost:4200
SANCTUM_STATEFUL_DOMAINS=localhost:4200
SESSION_DOMAIN=localhost
```

`config/cors.php` needs `'supports_credentials' => true` and the Angular origin allowed. Angular must send requests with `withCredentials: true`, and must call `/sanctum/csrf-cookie` before the first authenticated request.

---

## Gotchas

Things that are easy to get wrong here. Most look like framework bugs and are not;
one is a deliberate exception to the layer rules, recorded so nobody "fixes" it.

### `auth:sanctum` changes the default guard

`auth:sanctum` calls `Auth::shouldUse('sanctum')`, and Laravel's `setDefaultDriver()`
writes that name straight into `auth.defaults.guard` for the rest of the request. Three
things break as a result.

**None of them reproduce from the command line.** Tinker, seeders and one-off scripts
run with the default guard still `web`, so all three pass there and fail only against a
real authenticated HTTP request. A green CLI check proves nothing here.

**1. `Auth::logout()` throws.** The default guard is now the token guard — a
`RequestGuard`, which has no `logout()` method:

```
Method Illuminate\Auth\RequestGuard::logout does not exist.
```

Name the session guard explicitly wherever a session is being started or ended:

```php
Auth::guard('web')->attempt($credentials);
Auth::guard('web')->logout();
```

**2. `withCount()` on a Spatie relation throws.** `Role::users()` resolves its related
model with `getModelForGuard($this->attributes['guard_name'])`, and a `Role` built by
the query builder takes `guard_name` from the mutated default. It therefore asks for the
`sanctum` guard's provider, which is not configured, and gets `null`:

```
Class name must be a valid object or a string
```

Do not fix this by giving the `sanctum` guard a provider in `config/auth.php`. That
clears the error and then breaks authorization instead: Spatie starts matching users
against a guard whose permissions do not exist, and every permission-gated route returns
`403`. Count the pivot table directly, which does not care which guard is active — see
`RoleRepository::query()`.

**3. A role created during a request is stored under the wrong guard.** `Role::create()`
stamps `guard_name` from the same mutated default, so a role created through the API is
written as `sanctum` while every seeded permission is `web`. Nothing throws. The role is
simply inert — it matches no permissions and grants nothing, and the only symptom is a
user who mysteriously cannot do the thing their role says they can. Pin the guard
explicitly on write:

```php
$data['guard_name'] ??= config('permissions.guard');
```

### `AuthService` does not use a repository

Every other service reaches the database through a repository interface. `AuthService`
is the one exception, and it is deliberate.

`Auth::guard('web')->attempt()` is not a lookup. It resolves the user, verifies the
password hash, and starts the session — three things the guard already does
correctly and atomically. Routing it through `UserRepository::findByEmail()` would
split that into steps the service then has to reassemble by hand, with a real risk of
getting the hash comparison or the session fixation handling subtly wrong.

So `UserRepository` exists for the Users feature and `AuthService` does not touch it.
That is not an oversight, and it is not a precedent: any service doing an ordinary
query still goes through its repository.

### A render callback never sees a `ModelNotFoundException`

`Handler::render()` calls `prepareException()` *before* it runs the callbacks
registered in `withExceptions()`. By then a `ModelNotFoundException` has already
been swapped for a `NotFoundHttpException`, so a callback typed against the
former never fires — silently, because the response still looks plausible.

The original is kept as the previous exception, and that is the only thing left
distinguishing "no such record" from "no such route":

```php
$e->getPrevious() instanceof ModelNotFoundException
    ? __('The requested record was not found.')
    : __('The requested endpoint does not exist.');
```

`AuthenticationException` is not rewritten this way and can be matched directly.

### Collection routes must be declared before `{id}`

`GET /categories/options` and `GET /roles/options` are literal paths that sit under
the same prefix as `GET /categories/{id}`. Declared in the wrong order, `{id}`
matches first and `options` arrives at the controller as an id — a 404, or worse,
a confusing 500. Declare every literal path before the wildcard, and constrain the
wildcard so it can only ever match a number:

```php
Route::get('categories/options', [CategoryController::class, 'options']);

Route::get('categories/{id}', [CategoryController::class, 'show'])
    ->whereNumber('id');
```

`whereNumber('id')` is the durable half of the fix: with it in place, a future
literal route cannot be swallowed even if someone adds it below the wildcard.

---

## Working conventions

- One feature at a time, end to end: migration → model → repository interface → repository → service → request → controller → resource → route.
- Products first. It is the fullest feature — filters, pagination, file upload, a relation — and every other feature is a smaller version of it.
- No business logic in controllers. If a controller method contains an `if` that makes a decision, it belongs in the service.
- No query builder calls outside repositories.
- Permission strings come from config, never typed as literals.
- No English text hardcoded in a service, an exception, or a resource. Sentences
  go through `__()`, fixed labels through `enums.php`, and both files get the
  new entry in the same change.
- Role keys are identifiers. They are never translated, never title-cased, and
  never replaced by their display name where the system compares them.
