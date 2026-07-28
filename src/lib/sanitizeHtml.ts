/**
 * Client-side HTML sanitization.
 *
 * Used everywhere a description could contain HTML: the AI-generated
 * listing coming back from generateProductListing (already sanitized
 * server-side with sanitize-html, but never trust a single layer), and
 * anything the vendor types/pastes into the WYSIWYG editor before it is
 * saved to the database or rendered on a public product page.
 */
import DOMPurify from 'dompurify';

const ALLOWED_TAGS = ['h2', 'h3', 'p', 'ul', 'ol', 'li', 'strong', 'em', 'br', 'img', 'a'];
const ALLOWED_ATTR = ['src', 'alt', 'href', 'target', 'rel'];

export function sanitizeProductHtml(dirtyHtml: string): string {
  return DOMPurify.sanitize(dirtyHtml ?? '', {
    ALLOWED_TAGS,
    ALLOWED_ATTR,
    ALLOW_DATA_ATTR: false,
  });
}
