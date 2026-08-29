import { ApiActionError } from './apiActionError';

export function parseXhrError(status: number, body: string): Error {
  if (status === 401 || status === 428) return new ApiActionError({ kind: 'unauthorized', status, message: '登录会话已失效，请重新登录' });
  try {
    const data = JSON.parse(body);
    if (typeof data.error === 'string') return new Error(data.error);
  } catch {
    return new Error(`上传失败: ${status}`);
  }
  return new Error(`上传失败: ${status}`);
}
