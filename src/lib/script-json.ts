/**
 * Makes serialized JSON safe to place inside a <script> element.
 *
 * JSON.stringify leaves "<" as it is, so a model, lab or benchmark name containing "</script>"
 * would end the element early and the rest of the name would be parsed as markup. "<" can only
 * occur inside JSON strings, where the escape < means the same character.
 */
export const scriptSafeJson = (json: string): string => json.replace(/</g, '\\u003c');
