import {build} from 'esbuild';
import {mkdir,copyFile} from 'node:fs/promises';
await mkdir('dist',{recursive:true});
await build({entryPoints:['ui/main.tsx'],bundle:true,outfile:'dist/app.js',platform:'browser',target:'chrome130',jsx:'automatic',minify:false});
await copyFile('ui/index.html','dist/index.html');
