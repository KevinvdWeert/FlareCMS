export const normalizeEmail = (email) => (email || '').trim().toLowerCase();

export const validateEmail = (email) => {
  const value = normalizeEmail(email);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
    return false;
  }
  if (value.includes('..')) {
    return false;
  }
  const [, domain = ''] = value.split('@');
  return domain.split('.').every((label) => label.length > 0);
};

export const validateSlug = (slug) => /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test((slug || '').trim());

export const validateTitle = (title) => (title || '').trim().length >= 2;

export const validatePassword = (password) => {
  const value = password || '';
  return (
    value.length >= 8 &&
    /[A-Z]/.test(value) &&
    /[0-9]/.test(value) &&
    /[^A-Za-z0-9]/.test(value)
  );
};
