import { execFileSync } from 'node:child_process';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const root = process.cwd();
const jsFiles = [];
function walk(dir) {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === '.git') continue;
    const path = join(dir, name);
    const stat = statSync(path);
    if (stat.isDirectory()) walk(path);
    else if (name.endsWith('.js') || name.endsWith('.mjs')) jsFiles.push(path);
  }
}
walk(root);

let failed = false;
for (const file of jsFiles) {
  try { execFileSync(process.execPath, ['--check', file], { stdio: 'pipe' }); }
  catch (err) { failed = true; console.error(`Syntax error: ${relative(root,file)}\n${err.stderr?.toString() || err.message}`); }
}

const runtimeFiles = jsFiles.filter(f => ['src','public','cloud-functions'].includes(relative(root,f).split(/[\\/]/)[0]));
const allRuntime = runtimeFiles.map(f => readFileSync(f,'utf8')).join('\n');
const forbidden = [
  ['旧S/D编号正则', /\^\[SD\]/],
  ['旧Control Bot变量', /COZE_CONTROL_BOT_ID/],
  ['V4正式版本', /\bV4\b/],
  ['round2业务', /round2/i],
  ['fading业务', /fading/i],
  ['运行时读取course-stages.json', /course-stages\.json/],
];
for (const [label, regex] of forbidden) {
  if (regex.test(allRuntime)) { failed = true; console.error(`Forbidden legacy pattern found: ${label}`); }
}

const entry = readFileSync(join(root,'cloud-functions/express/[[default]].js'),'utf8');
for (const expected of ["app.use('/api', authRoutes)", "app.use('/api', chatRoutes)", "app.use('/api', uploadRoutes)", "app.use('/api/admin', adminRoutes)", 'export default app']) {
  if (!entry.includes(expected)) { failed = true; console.error(`Missing EdgeOne entry contract: ${expected}`); }
}

const mainJs = readFileSync(join(root,'public/js/main.js'),'utf8');
if (!mainJs.includes("'/express/api/validate'")) { failed = true; console.error('Student validate endpoint is not /express/api/validate'); }


const researchConfig = readFileSync(join(root,'src/config/researchConfig.js'),'utf8');
if (!/practice_shopping_bag[\s\S]*?formal_data:\s*false[\s\S]*?ai_enabled:\s*true/.test(researchConfig)) {
  failed = true;
  console.error('Practice must remain formal_data=false and ai_enabled=true');
}
const researchService = readFileSync(join(root,'src/services/researchService.js'),'utf8');
const studentChat = readFileSync(join(root,'public/js/chat.js'),'utf8');
if (!researchService.includes("stage.current_stage === 'practice_shopping_bag'") || !studentChat.includes("state.research.current_stage === 'practice_shopping_bag'")) {
  failed = true;
  console.error('Practice AI hard guard is missing');
}

const validator = readFileSync(join(root,'src/utils/validators.js'),'utf8');
if (!validator.includes('/^P\\d{2}$/')) { failed = true; console.error('Participant validator is not P01-P99'); }

if (failed) process.exit(1);
console.log(`OK: ${jsFiles.length} JavaScript files parsed; EdgeOne routes and research invariants checked.`);
