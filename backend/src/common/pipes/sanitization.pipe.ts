import { Injectable, PipeTransform, ArgumentMetadata } from '@nestjs/common';

/**
 * Global sanitization pipe that processes all incoming string fields:
 * - Strips HTML tags
 * - Trims whitespace
 * - Normalizes email fields to lowercase
 * - Escapes special characters (&, <, >, ", ') to HTML entities
 *
 * The pipe is idempotent: sanitize(sanitize(x)) === sanitize(x)
 *
 * Strategy for idempotence:
 * 1. Unescape any existing HTML entities first (so previously escaped values are normalized)
 * 2. Strip HTML tags (removes any actual tags)
 * 3. Trim whitespace
 * 4. Escape special characters
 * This ensures repeated application produces the same result.
 */
@Injectable()
export class SanitizationPipe implements PipeTransform {
  transform(value: unknown, metadata: ArgumentMetadata): unknown {
    if (metadata.type === 'custom') {
      return value;
    }

    return this.sanitizeValue(value);
  }

  private sanitizeValue(value: unknown, fieldName?: string): unknown {
    if (value === null || value === undefined) {
      return value;
    }

    if (typeof value === 'string') {
      return this.sanitizeString(value, fieldName);
    }

    if (Array.isArray(value)) {
      return value.map((item) => this.sanitizeValue(item, fieldName));
    }

    if (typeof value === 'object') {
      return this.sanitizeObject(value as Record<string, unknown>);
    }

    return value;
  }

  private sanitizeObject(obj: Record<string, unknown>): Record<string, unknown> {
    const sanitized: Record<string, unknown> = {};

    for (const [key, val] of Object.entries(obj)) {
      sanitized[key] = this.sanitizeValue(val, key);
    }

    return sanitized;
  }

  private sanitizeString(input: string, fieldName?: string): string {
    let result = input;

    // Step 1: Unescape existing HTML entities to normalize
    // This ensures idempotence: &amp; → & → &amp; (stable after one pass)
    result = this.unescapeHtmlEntities(result);

    // Step 2: Strip HTML tags
    result = this.stripHtmlTags(result);

    // Step 3: Trim whitespace
    result = result.trim();

    // Step 4: Normalize email fields to lowercase
    if (this.isEmailField(fieldName)) {
      result = result.toLowerCase();
    }

    // Step 5: Escape special characters to HTML entities
    result = this.escapeSpecialChars(result);

    return result;
  }

  /**
   * Unescape HTML entities back to their raw characters.
   * This is the key to idempotence: by unescaping first, we ensure
   * that already-escaped input is treated the same as raw input.
   */
  private unescapeHtmlEntities(input: string): string {
    return input
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#x27;/g, "'")
      .replace(/&#39;/g, "'");
  }

  /**
   * Strip all HTML tags from the input string.
   */
  private stripHtmlTags(input: string): string {
    return input.replace(/<[^>]*>/g, '');
  }

  /**
   * Escape &, <, >, ", ' to their HTML entity equivalents.
   */
  private escapeSpecialChars(input: string): string {
    return input
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#x27;');
  }

  /**
   * Determine if a field name corresponds to an email field.
   */
  private isEmailField(fieldName?: string): boolean {
    if (!fieldName) {
      return false;
    }
    return fieldName.toLowerCase().includes('email');
  }
}
