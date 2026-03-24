import { validateSlug, validateTitle, validateRole, sanitizeSlug } from '../lib/validation';

describe('validation', () => {
  describe('validateSlug', () => {
    it('accepts valid slugs', () => {
      expect(validateSlug('hello')).toBe(true);
      expect(validateSlug('hello-world')).toBe(true);
      expect(validateSlug('hello-world-123')).toBe(true);
      expect(validateSlug('a')).toBe(true);
    });

    it('rejects invalid slugs', () => {
      expect(validateSlug('')).toBe(false);
      expect(validateSlug('Hello')).toBe(false);        // uppercase
      expect(validateSlug('hello world')).toBe(false);  // space
      expect(validateSlug('-hello')).toBe(false);       // leading hyphen
      expect(validateSlug('hello-')).toBe(false);       // trailing hyphen
      expect(validateSlug('hello--world')).toBe(false); // double hyphen
    });
  });

  describe('validateTitle', () => {
    it('accepts titles with at least 2 chars', () => {
      expect(validateTitle('Hi')).toBe(true);
      expect(validateTitle('Hello World')).toBe(true);
    });

    it('rejects titles shorter than 2 chars', () => {
      expect(validateTitle('')).toBe(false);
      expect(validateTitle('A')).toBe(false);
    });
  });

  describe('validateRole', () => {
    it('accepts valid roles', () => {
      expect(validateRole('user')).toBe(true);
      expect(validateRole('editor')).toBe(true);
      expect(validateRole('admin')).toBe(true);
    });

    it('rejects invalid roles', () => {
      expect(validateRole('superadmin')).toBe(false);
      expect(validateRole('')).toBe(false);
      expect(validateRole('ADMIN')).toBe(false);
    });
  });

  describe('sanitizeSlug', () => {
    it('lowercases and replaces spaces with hyphens', () => {
      expect(sanitizeSlug('Hello World')).toBe('hello-world');
    });

    it('strips leading and trailing hyphens', () => {
      expect(sanitizeSlug(' hello ')).toBe('hello');
    });

    it('collapses multiple non-alphanumeric chars into single hyphen', () => {
      expect(sanitizeSlug('hello  world!')).toBe('hello-world');
    });

    it('returns empty string for empty input', () => {
      expect(sanitizeSlug('')).toBe('');
    });
  });
});
