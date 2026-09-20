export function loginTarget(value: string | null) {
  return value && ['/discover', '/create', '/general', '/agent-preview','/agents','/execution'].includes(value) ? value : '/agent-preview';
}
