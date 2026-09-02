/**
 * A catalogue field the API stores and returns in both languages at once.
 *
 * Only product and category `name` and `description` arrive this way. The shape
 * does not vary with `Accept-Language` — that header picks the language of what
 * the *system* says, while the catalogue always comes back in both, because the
 * edit form needs both to fill its two inputs.
 *
 * Names are non-empty in both languages: the API requires both on create and
 * refuses a blank one on update. Descriptions are nullable per language, and the
 * key is absent entirely when neither has been written. Hence `string | null`
 * throughout — the type says what can actually arrive, and `LocaleService.text()`
 * is what turns any of it into something renderable.
 */
export interface TranslatedText {
  en: string | null;
  ar: string | null;
}
