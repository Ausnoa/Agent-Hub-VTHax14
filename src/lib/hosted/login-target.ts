export function loginTarget(value: string | null) {
  if (value && ['/discover', '/create', '/general', '/agent-preview', '/agents', '/execution', '/dashboard', '/saved', '/profile/settings'].includes(value)) return value;
  return value && value.startsWith('/profile/') ? value : '/agent-preview';
}
