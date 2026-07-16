import type { ErrorCode, ErrorDetail } from '../types';

const CODE_LABELS: Record<ErrorCode, string> = {
  VALIDATION_ERROR: '参数无效',
  UNAUTHORIZED_LOCAL_CLIENT: '本地鉴权失败',
  ORIGIN_NOT_ALLOWED: '来源不被允许',
  NOT_FOUND: '未找到',
  METHOD_NOT_ALLOWED: '方法不允许',
  OPERATION_CONFLICT: '操作冲突',
  INVALID_STATE_TRANSITION: '状态不允许',
  SCRIPT_NOT_FOUND: '脚本不存在',
  SCRIPT_VERSION_UNSUPPORTED: '脚本版本不支持',
  SETTINGS_INVALID: '设置无效',
  HOTKEY_REGISTRATION_FAILED: '快捷键注册失败',
  INPUT_PERMISSION_DENIED: '权限不足',
  DISPLAY_LAYOUT_CHANGED: '显示器布局变化',
  ENGINE_INTERNAL_ERROR: '内部错误',
  CONNECTION_ERROR: '连接失败',
  CAPABILITY_UNAVAILABLE: '能力不可用',
};

const CODE_DEFAULT_MESSAGE: Partial<Record<ErrorCode, string>> = {
  OPERATION_CONFLICT: '当前已有任务在运行，请先停止后再开始',
  INVALID_STATE_TRANSITION: '当前状态无法执行该操作',
  VALIDATION_ERROR: '请求参数无效，请检查后重试',
  SCRIPT_NOT_FOUND: '未找到对应脚本',
  SCRIPT_VERSION_UNSUPPORTED: '脚本版本不受支持',
  SETTINGS_INVALID: '本地设置文件无效',
  INPUT_PERMISSION_DENIED: '无法向当前窗口注入输入',
  ENGINE_INTERNAL_ERROR: '引擎内部错误，请重试',
  CONNECTION_ERROR: '无法连接本地服务',
  UNAUTHORIZED_LOCAL_CLIENT: '本地会话无效，请重启应用',
  NOT_FOUND: '请求的资源不存在',
  METHOD_NOT_ALLOWED: '不支持的请求方式',
  HOTKEY_REGISTRATION_FAILED: '快捷键注册失败，可能被其他程序占用',
  DISPLAY_LAYOUT_CHANGED: '显示器布局已变化，请检查坐标',
  CAPABILITY_UNAVAILABLE: '当前环境不支持该能力',
  ORIGIN_NOT_ALLOWED: '页面来源不被允许',
};

const ENGLISH_HINTS: Array<[RegExp, string]> = [
  [/another operation is already active/i, '当前已有任务在运行，请先停止后再开始'],
  [/operation id does not match/i, '操作编号与当前任务不匹配'],
  [/cannot transition from/i, '当前状态无法执行该操作'],
  [/operation is not paused/i, '当前任务未处于暂停状态'],
  [/playback script must contain/i, '回放脚本至少需要一个可执行动作'],
  [/recording result not found/i, '未找到录制结果'],
  [/script not found/i, '未找到对应脚本'],
  [/script already exists/i, '脚本已存在'],
  [/stored script is invalid/i, '本地脚本文件无效'],
  [/stored settings are invalid/i, '本地设置文件无效'],
  [/request validation failed/i, '请求参数无效，请检查后重试'],
  [/internal engine error/i, '引擎内部错误，请重试'],
  [/invalid or missing local session/i, '本地会话无效，请重启应用'],
];

export function formatErrorForDisplay(error: ErrorDetail): { title: string; message: string } {
  const title = CODE_LABELS[error.code] ?? error.code;
  let message = (error.message || '').trim();
  for (const [pattern, zh] of ENGLISH_HINTS) {
    if (pattern.test(message)) {
      message = zh;
      break;
    }
  }
  const hasChinese = /[\u4e00-\u9fff]/.test(message);
  if (!message || !hasChinese) {
    message = CODE_DEFAULT_MESSAGE[error.code] ?? (message || '发生未知错误');
  }
  return { title, message };
}