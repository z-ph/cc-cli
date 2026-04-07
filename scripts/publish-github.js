#!/usr/bin/env node

/**
 * 从 changelog/ 目录读取对应版本说明，用 gh 发布 GitHub Release。
 *
 * 用法:
 *   node scripts/publish-github.js              # 发布当前 package.json 版本
 *   node scripts/publish-github.js v2.0.5       # 发布指定版本
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

function run(cmd) {
  return execSync(cmd, { encoding: 'utf8', stdio: 'pipe' }).trim();
}

function log(msg) { console.log(`[gh-release] ${msg}`); }
function fail(msg) { console.error(`[gh-release] 错误: ${msg}`); process.exit(1); }

// 解析版本号
const input = process.argv[2];
let version;

if (input) {
  version = input.startsWith('v') ? input.slice(1) : input;
} else {
  const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf8'));
  version = pkg.version;
}

const tag = `v${version}`;
const changelogPath = path.join(__dirname, '..', 'changelog', `${tag}.md`);

// 检查 tag 是否存在
try {
  run(`git rev-parse ${tag}`);
} catch {
  fail(`标签 ${tag} 不存在。请先运行 release 脚本创建标签`);
}

// 检查 changelog 文件
if (!fs.existsSync(changelogPath)) {
  fail(`找不到 changelog 文件: changelog/${tag}.md`);
}

// 检查是否已发布
try {
  run(`gh release view ${tag}`);
  fail(`Release ${tag} 已存在。如需更新请使用 gh release edit`);
} catch {
  // 不存在，可以继续
}

// 将 body 写入临时文件，避免 shell 转义问题
const body = fs.readFileSync(changelogPath, 'utf8');
const tmpFile = path.join(os.tmpdir(), `gh-release-${tag}.md`);
fs.writeFileSync(tmpFile, body, 'utf8');

log(`发布 Release: ${tag}`);
log(`Changelog: changelog/${tag}.md`);

try {
  run(`gh release create ${tag} --title "${tag}" --notes-file "${tmpFile}"`);
  log(`Release ${tag} 发布成功!`);
} catch (err) {
  fail(`发布失败:\n${err.message || err}`);
} finally {
  // 清理临时文件
  try { fs.unlinkSync(tmpFile); } catch {}
}
