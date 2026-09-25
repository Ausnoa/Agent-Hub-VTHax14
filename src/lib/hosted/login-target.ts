export function loginTarget(value: string | null) {
  if (value && ['/studio', '/discover', '/create', '/general', '/agent-preview', '/agents', '/dashboard', '/profile/settings'].includes(value)) return value;
  return value && value.startsWith('/profile/') ? value : '/dashboard';
}
