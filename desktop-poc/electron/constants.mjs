export const APP_TITLE = 'KeyMouse Studio'
export const APP_DESCRIPTION = '键鼠自动化工具 — 连点、录制、脚本编辑与回放'
export const GITHUB_OWNER = 'Geo-ff'
export const GITHUB_REPO = 'keymouse-studio'
export const GITHUB_REPO_URL = `https://github.com/${GITHUB_OWNER}/${GITHUB_REPO}`
export const ALLOWED_EXTERNAL_URLS = Object.freeze([GITHUB_REPO_URL])

export function getAppTitle() {
  return APP_TITLE
}