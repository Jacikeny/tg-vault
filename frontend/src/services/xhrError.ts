export function parseXhrError(status: number, body: string): Error {
  if (status === 401 || status === 428) return new Error('UNAUTHORIZED');
  try {
    const data = JSON.parse(body);
    if (typeof data.error === 'string') return new Error(data.error);
  } catch {
    return new Error(`上传失败: ${status}`);
  }
  return new Error(`上传失败: ${status}`);
}
