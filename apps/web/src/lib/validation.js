export const validateEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test((email || '').trim());

export const validateSlug = (slug) => /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test((slug || '').trim());

export const validateTitle = (title) => (title || '').trim().length >= 2;

export const validatePassword = (password) => {
  const value = password || '';
  return value.length >= 8 && /[A-Z]/.test(value) && /[0-9]/.test(value);
};
