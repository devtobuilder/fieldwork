import {packager} from '@electron/packager';
import {mkdirSync,mkdtempSync} from 'node:fs';
import path from 'node:path';

let out=process.env.FIELDWORK_PACKAGE_OUT;
if(!out){
 mkdirSync('release/staging',{recursive:true});
 out=mkdtempSync(path.join('release','staging','build-'));
}
const result=await packager({dir:'.',out,name:'Fieldwork',platform:'win32',arch:'x64',asar:{unpack:'**/*.{node,dll}'},ignore:[/^\/.git(?:\/|$)/,/^\/\.runtime(?:\/|$)/,/^\/midscene_run(?:\/|$)/,/^\/release(?:-candidate)?(?:\/|$)/,/^\/tests(?:\/|$)/,/^\/ui(?:\/|$)/,/^\/scripts(?:\/|$)/,/^\/[^/]+\.md$/,/^\/(?:\.env(?:\..*)?|client_secret[^/]*|credentials[^/]*)(?:\/|$)/],prune:true});
console.log('Desktop package: '+result.join(', '));
console.log(`After testing, promote with npm run release -- "${result[0]}"`);
