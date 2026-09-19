export function loginTarget(value: string | null) {
  return value && ['/agent-preview','/agents','/execution'].includes(value) ? value : '/agent-preview';
}
