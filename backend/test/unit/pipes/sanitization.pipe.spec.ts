import { ArgumentMetadata } from '@nestjs/common';
import { SanitizationPipe } from '@/common/pipes/sanitization.pipe';

describe('SanitizationPipe', () => {
  let pipe: SanitizationPipe;

  beforeEach(() => {
    pipe = new SanitizationPipe();
  });

  const bodyMetadata: ArgumentMetadata = { type: 'body' };
  const customMetadata: ArgumentMetadata = { type: 'custom' };

  describe('basic string sanitization', () => {
    it('should trim whitespace from strings', () => {
      const result = pipe.transform({ name: '  hello  ' }, bodyMetadata);
      expect((result as any).name).toBe('hello');
    });

    it('should strip HTML tags', () => {
      const result = pipe.transform({ name: '<script>alert("xss")</script>John' }, bodyMetadata);
      // Tags are stripped, then content is escaped
      expect((result as any).name).toBe('alert(&quot;xss&quot;)John');
    });

    it('should strip angle-bracket content as HTML tags', () => {
      // < C > is treated as a tag and stripped
      const result = pipe.transform({ name: 'A & B < C > D' }, bodyMetadata);
      expect((result as any).name).toBe('A &amp; B  D');
    });

    it('should escape ampersands', () => {
      const result = pipe.transform({ name: 'A & B' }, bodyMetadata);
      expect((result as any).name).toBe('A &amp; B');
    });

    it('should escape quotes', () => {
      const result = pipe.transform({ msg: 'He said "hello" and \'bye\'' }, bodyMetadata);
      expect((result as any).msg).toBe('He said &quot;hello&quot; and &#x27;bye&#x27;');
    });
  });

  describe('email normalization', () => {
    it('should lowercase email fields', () => {
      const result = pipe.transform({ email: 'John@Example.COM' }, bodyMetadata);
      expect((result as any).email).toBe('john@example.com');
    });

    it('should lowercase fields containing "email" in the name', () => {
      const result = pipe.transform({ userEmail: 'TEST@EXAMPLE.COM' }, bodyMetadata);
      expect((result as any).userEmail).toBe('test@example.com');
    });

    it('should not lowercase non-email fields', () => {
      const result = pipe.transform({ name: 'John Doe' }, bodyMetadata);
      expect((result as any).name).toBe('John Doe');
    });
  });

  describe('idempotence', () => {
    it('should be idempotent — applying twice yields same result', () => {
      const input = { name: 'A & B <script>x</script>', email: 'TEST@X.COM' };

      const first = pipe.transform({ ...input }, bodyMetadata);
      const second = pipe.transform(first, bodyMetadata);

      expect(second).toEqual(first);
    });
  });

  describe('nested and complex values', () => {
    it('should sanitize nested objects', () => {
      const result = pipe.transform(
        { user: { name: '<b>Bob</b>', email: 'BOB@X.COM' } },
        bodyMetadata,
      );
      expect((result as any).user.name).toBe('Bob');
      expect((result as any).user.email).toBe('bob@x.com');
    });

    it('should sanitize arrays of strings', () => {
      const result = pipe.transform({ tags: ['<b>tag1</b>', '  tag2  '] }, bodyMetadata);
      expect((result as any).tags).toEqual(['tag1', 'tag2']);
    });

    it('should pass through null and undefined', () => {
      const result = pipe.transform({ name: null, phone: undefined }, bodyMetadata);
      expect((result as any).name).toBeNull();
      expect((result as any).phone).toBeUndefined();
    });

    it('should pass through numbers and booleans unchanged', () => {
      const result = pipe.transform({ count: 42, active: true }, bodyMetadata);
      expect((result as any).count).toBe(42);
      expect((result as any).active).toBe(true);
    });
  });

  describe('metadata handling', () => {
    it('should skip sanitization for custom metadata type', () => {
      const input = { name: '<script>evil</script>' };
      const result = pipe.transform(input, customMetadata);
      expect(result).toBe(input); // same reference, not sanitized
    });
  });
});
