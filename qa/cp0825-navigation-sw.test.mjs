/* CP08.25 synthetic static regression, Node 26, NOT browser QA. */
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=p=>readFileSync(path.join(root,p),'utf8');
let passed=0;
function check(name,good){assert.ok(good,name);passed++}
const sw=read('sw.js'),html=read('index.html'),app=read('app.js'),rel=JSON.parse(read('release.json'));
const labs=read('qa-hub/candidates/cp0823-r1-bplus/index.html'),exp=read('qa-hub/candidates/cp0823-export/index.html');
const files=JSON.parse(sw.match(/const FILES=(\[[^;]+\]);/)[1]);
const old=JSON.parse(sw.match(/const OLD_CACHES=new Set\((\[[^;]+\])\)/)[1]);
const B='20261122-cp0825-navigation-01';
const deps=[
 './qa-hub/candidates/cp0823-r1-bplus/index.html','./qa-hub/candidates/cp0823-r1-bplus/export-launch.mjs',
 './qa-hub/candidates/cp0820-bplus/styles.css','./qa-hub/candidates/cp0822-bplus-contract/app.mjs',
 './qa-hub/candidates/cp0822-bplus-contract/data-source.mjs','./qa-hub/candidates/cp0822-bplus-contract/adapter.mjs',
 './qa-hub/candidates/cp0822-bplus-contract/fixture.mjs','./qa-hub/candidates/cp0819-labs/lab-core.mjs',
 './qa-hub/candidates/cp0819-labs/fixture.mjs','./qa-hub/candidates/cp0823-export/index.html',
 './qa-hub/candidates/cp0823-export/styles.css','./qa-hub/candidates/cp0823-export/export-preview.mjs',
 './qa-hub/candidates/cp0823-export/export-plan.mjs','./qa-hub/candidates/cp0823-export/synthetic-fixture.mjs'
];
check('39 unique cache entries',files.length===39&&new Set(files).size===39);
check('old cache allowlisted',old.includes('pae06-cp0815-restore-assets-v1'));
check('version coherence',rel.buildId===B&&rel.syntheticOnly===true&&html.includes('data-pwa-build="'+B+'"')&&app.includes('buildId:"'+B+'"')&&sw.includes('BUILD_ID="'+B+'"'));
check('IndexedDB unchanged',app.includes('const DB_NAME="pae06_cp082_synthetic_only",DB_VERSION=1,STORE="documents";'));
check('install does not skip waiting',!sw.slice(sw.indexOf('self.addEventListener("install"'),sw.indexOf('self.addEventListener("message"')).includes('skipWaiting()'));
for(const target of deps){check('cached '+target,files.includes(target));check('exists '+target,existsSync(path.join(root,target.slice(2))))}
for(const [file,sha] of [['fixtures/PAE06_QA_A_1_PAGE.pdf','4e2771233e0ac9b85b6102bea2ef4b80eaa30c79bd54f487316b47f34eb8d153'],['fixtures/PAE06_QA_B_2_PAGES.pdf','3e6431cba0304f7480999803b1cc954dd38e582bf172afc38acebc01e3825982']]){check('pdf cached '+file,files.includes('./'+file));check('pdf sha '+file,createHash('sha256').update(readFileSync(path.join(root,file))).digest('hex')===sha)}
const resolve=(from,relative)=>path.posix.normalize(path.posix.join(path.posix.dirname(from),relative));
for(const [p,s] of [['index.html',html],['qa-hub/candidates/cp0823-r1-bplus/index.html',labs],['qa-hub/candidates/cp0823-export/index.html',exp]])for(const m of s.matchAll(/(?:href|src)="([^"]+)"/g)){const rel=m[1];if(rel.startsWith('#'))continue;const dest=resolve(p,rel);check('within repo '+p+':'+rel,!dest.startsWith('..'));check('cached link '+p+':'+rel,files.includes('./'+dest))}
for(const p of deps.filter(x=>x.endsWith('.mjs'))){const s=read(p.slice(2));for(const m of s.matchAll(/\bimport\s+(?:[^\n;]*?\s+from\s+)?['"]([^'"]+)['"]/g)){const dest=resolve(p.slice(2),m[1]);check('cached import '+p+':'+m[1],files.includes('./'+dest))}}
check('root to B+',html.includes('href="./qa-hub/candidates/cp0823-r1-bplus/index.html"'));
check('B+ back',labs.includes('href="../../../index.html"')&&labs.includes('href="../cp0823-export/index.html"'));
check('export back',exp.includes('href="../../../index.html"')&&exp.includes('href="../cp0823-r1-bplus/index.html"'));
check('restore preserved',files.includes('./restore-test.html')&&files.includes('./restore-test.mjs'));
console.log('PASS CP08.25 static checks '+passed);
