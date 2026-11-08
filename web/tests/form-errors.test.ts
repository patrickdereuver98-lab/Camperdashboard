// Serverfouten bij het juiste veld (review november R31)
import { strict as assert } from "node:assert";
import { test } from "node:test";
import { errorId, errorMessage, fieldAria, formError, REVIEW_RULES, ticketRules } from "../src/lib/form-errors";

const constraint = (name: string) => ({ message: `new row for relation "x" violates check constraint "${name}"` });

test("check constraint van tickets komt bij het veld, met een eigen tekst", () => {
  assert.deepEqual(formError(constraint("tickets_email_check"), ticketRules()), {
    field: "email",
    message: "Vul een geldig e-mailadres in, bijvoorbeeld naam@voorbeeld.nl.",
  });
  assert.equal(formError(constraint("tickets_name_check"), ticketRules()).field, "name");
});

test("melden: onderwerp en bericht heten daar url en explanation", () => {
  const rules = ticketRules({ subject: "url", body: "explanation" });
  assert.equal(formError(constraint("tickets_subject_check"), rules).field, "url");
  const short = formError({ message: "Je bericht is te kort." }, rules);
  assert.deepEqual(short, { field: "explanation", message: "Je bericht is te kort." });
});

test("fout die niet over één veld gaat blijft algemeen", () => {
  const busy = formError({ message: "Het is even erg druk. Probeer het later opnieuw of mail ons." }, ticketRules());
  assert.deepEqual(busy, { field: null, message: "Het is even erg druk. Probeer het later opnieuw of mail ons." });
  assert.equal(formError(new TypeError("Failed to fetch"), ticketRules()).message, "Geen verbinding. Controleer je internet en probeer het opnieuw.");
  // Onbekende constraint: algemene tekst, geen veld
  assert.deepEqual(formError(constraint("tickets_category_check"), ticketRules()), { field: null, message: "Niet alle velden zijn goed ingevuld." });
});

test("review: tekst, naam en e-mailadres", () => {
  assert.equal(formError(constraint("reviews_body_check"), REVIEW_RULES).field, "body");
  assert.equal(formError(constraint("reviews_author_name_check"), REVIEW_RULES).field, "name");
  assert.equal(formError({ message: "Unable to validate email address: invalid format" }, REVIEW_RULES).field, "email");
  assert.equal(formError({ message: "email rate limit exceeded" }, REVIEW_RULES).field, null);
});

test("aria-kenmerken alleen op het veld waar de fout over gaat", () => {
  const err = { field: "email", message: "x" };
  assert.deepEqual(fieldAria(err, "contact", "email"), { "aria-invalid": true, "aria-describedby": errorId("contact", "email") });
  assert.deepEqual(fieldAria(err, "contact", "name"), {});
  assert.deepEqual(fieldAria(null, "contact", "email"), {});
});

test("errorMessage haalt het Postgres-voorvoegsel weg", () => {
  assert.equal(errorMessage({ message: "ERROR: Te veel gegevens" }), "Te veel gegevens");
});
