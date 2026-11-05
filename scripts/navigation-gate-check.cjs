const {chromium}=require('playwright-core'),{installGate}=require('../desktop/browser-gate.cjs'),assert=require('node:assert/strict');
(async()=>{const browser=await chromium.launch({channel:'chrome',headless:true});try{const page=await browser.newPage();await page.addInitScript(installGate,{secret:'fixture-only'});
 // addInitScript requires a navigation; inline fixture installation has the same event semantics.
 await page.setContent('<textarea style="display:none" name="g-recaptcha-response"></textarea><header><form role="search"><input required></form></header><form id="entry"><button type="submit">Apply Now</button></form><script>window.advanced=0;entry.onsubmit=e=>{e.preventDefault();window.advanced++}</script>');await page.evaluate(installGate,{secret:'fixture-only'});await page.getByRole('button',{name:'Apply Now'}).click();assert.equal(await page.evaluate(()=>window.advanced),1);
 await page.locator('#entry').evaluate(form=>{form.innerHTML='<label>Full name<input name="first_name" required value="Fixture"></label><button>Apply Now</button>';});await page.getByRole('button',{name:'Apply Now'}).click();assert.equal(await page.evaluate(()=>window.advanced),1);
 await page.evaluate(()=>window.__fieldworkGate.authorize('fixture-only',Date.now()+5000));await page.getByRole('button',{name:'Apply Now'}).click();assert.equal(await page.evaluate(()=>window.advanced),2);
 console.log('Landing Apply advances despite hidden controls; final Apply remains blocked until approval.');
 }finally{await browser.close()}})().catch(e=>{console.error(e.stack);process.exitCode=1});
