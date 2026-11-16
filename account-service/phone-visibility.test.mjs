import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {test} from 'node:test';
const app=readFileSync(new URL('../app.js',import.meta.url),'utf8');
const bridge=readFileSync(new URL('../phone.js',import.meta.url),'utf8');
const helpers=app.slice(app.indexOf('function canAccessGame'),app.indexOf('const byId'));
const selection=app.slice(app.indexOf('  const pool ='),app.indexOf('  const popularity='));
const version=app.match(/function currentNewGamesVersion\(\)\{[^\n]+\}/)[0];
const phone={id:'wackyphone',title:'Wacky Phone',url:'library/wacky-phone/index.html',collection:'new'};
const ordinary={id:'ordinary',title:'Ordinary',url:'game.html',collection:'new'};
function catalog(user){const games=[phone,ordinary];const ctx=vm.createContext({window:{WackyAccount:{user}},games,byId:new Map(games.map(g=>[g.id,g])),favorites:new Set(games.map(g=>g.id)),recents:games.map(g=>g.id),searchTitles:new Map(games.map(g=>[g.id,g.title.toLowerCase()])),query:'',view:'all'});vm.runInContext(helpers+version,ctx);return ctx;}
test('catalog filtering covers all, New, favorites, recents, search, and badge contents',()=>{
 for(const user of [null,{id:'regular',owner:false},{id:'owner',owner:true},{id:'admin',admin:true}]){
  const ctx=catalog(user),allowed=!!(user?.owner||user?.admin);
  for(const view of ['all','new','favorites','recents']){ctx.view=view;vm.runInContext('{'+selection+'globalThis.result=matches.map(g=>g.id);}',ctx);assert.equal(ctx.result.includes('wackyphone'),allowed,view);assert.equal(ctx.result.includes('ordinary'),true);}
  ctx.query='wacky';vm.runInContext('{'+selection+'globalThis.result=matches.map(g=>g.id);}',ctx);assert.equal(ctx.result.includes('wackyphone'),allowed,'search');
  assert.equal(vm.runInContext('currentNewGamesVersion()',ctx).includes('wackyphone'),allowed,'New badge');
 }
});
test('random game and its artwork use only the accessible catalog',()=>{
 const source=app.slice(app.indexOf('function makeRandomCard()'),app.indexOf('\n\nfunction render()'));
 const handlers=[],launched=[];const ctx=catalog(null);Object.assign(ctx,{imageMap:{wackyphone:'images/phone.svg',ordinary:'images/ordinary.svg'},randomMotion:{matches:true},document:{createElement(){return {classList:{add(){},remove(){}},append(){},setAttribute(){},addEventListener(name,fn){if(name==='click')handlers.push(fn)}}}},IntersectionObserver:class{observe(){}},setInterval(){},openGame(game){launched.push(game.id)}});vm.runInContext(source+';makeRandomCard();',ctx);for(let n=0;n<50;n++)handlers[0]();assert.deepEqual(launched,Array(50).fill('ordinary'));assert.match(source,/const art=visibleGames\(\)\.map/);
});
test('direct open and launch return before constructing a non-admin player',()=>{
 const open=app.slice(app.indexOf('function openGame(game)'),app.indexOf("document.querySelector('#server-cancel')"));
 const launch=app.slice(app.indexOf('function launchGame(game,'),app.indexOf('async function closeGame()'));
 for(const user of [null,{id:'regular',owner:false}]){const ctx=catalog(user);vm.runInContext(open+launch+';openGame(games[0]);launchGame(games[0],null);',ctx);}
});
test('logout handler immediately clears the active Phone frame and refreshes catalog',()=>{
 const start=app.indexOf("window.addEventListener('wacky-account-change',()=>{");const handler=app.slice(start,app.indexOf("window.addEventListener('popularitychange'",start));
 const ctx=catalog({owner:false});let callback,cleared=0,closed=0,rendered=0;Object.assign(ctx,{currentGame:phone,stage:{replaceChildren(){cleared++}},closeGame(){closed++},render(){rendered++},updateNewGamesBadge(){},view:'new'});ctx.window.addEventListener=(_,fn)=>{callback=fn};vm.runInContext(handler,ctx);callback();assert.equal(cleared,1);assert.equal(closed,1);assert.equal(rendered,1);
});
test('parent bridge rejects nonadmins before calling the API and after account changes',async()=>{
 let listener,apiCalls=0,resolveApi;const replies=[],source={postMessage(data){replies.push(data)}};
 const account={user:{id:'regular',owner:false},api(){apiCalls++;return new Promise(resolve=>{resolveApi=resolve})}};
 const frame={src:'https://site.test/library/wacky-phone/index.html',contentWindow:source,isConnected:true};
 const ctx=vm.createContext({window:{WackyAccount:account,addEventListener(_,fn){listener=fn}},document:{baseURI:'https://site.test/',querySelectorAll(){return [frame]},querySelector(){return null},documentElement:{}},location:{origin:'https://site.test',href:'https://site.test/'},URL,WeakMap,MutationObserver:class{observe(){}},setTimeout});vm.runInContext(bridge,ctx);
 const event={origin:'https://site.test',source,data:{type:'bww:phone-request',id:'test-1',path:'/phone/me',method:'GET'}};
 await listener(event);assert.equal(apiCalls,0);assert.equal(replies[0].status,403);
 account.user={id:'owner',owner:true};const request=listener(event);assert.equal(apiCalls,1);account.user=null;resolveApi({user:{id:'owner'}});await request;assert.equal(replies.at(-1).status,403);
});
