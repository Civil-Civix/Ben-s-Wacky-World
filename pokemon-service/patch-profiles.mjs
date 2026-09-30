import fs from 'node:fs';import path from 'node:path';
const file=path.join(process.argv[2],'server/users.ts');let text=fs.readFileSync(file,'utf8');
if(!text.includes('// BWW profile authentication')){
 const marker='\tasync validateToken(token: string, name: string, userid: ID, connection: Connection) {';if(!text.includes(marker))throw Error('Authentication patch point changed');
 text=text.replace(marker,marker+`
        // BWW profile authentication: consume a challenge-bound, single-use ticket.
        if (token.startsWith('BWW:')) {
            try {
                const response = await fetch('https://bens-wacky-accounts.mr-ellis1009.workers.dev/battle/verify', {method:'POST', headers:{'Content-Type':'application/json','X-Wacky-Client':'1'},body:JSON.stringify({token:token.slice(4),challenge:connection.challenge,userid}),signal:AbortSignal.timeout(10000)});
                const result: any = await response.json();
                if (response.ok && result.userid === userid) return '1';
            } catch {}
            this.send('|nametaken|' + name + '|Please reopen Pokémon Battles from your profile.');
            return null;
        }
        // Reserve profile IDs; keep the existing client working during rollout.
        if (/^bww[a-f0-9]{32}$/.test(userid)) {
            this.send('|nametaken|' + name + '|Sign in through Ben’s Wacky World to battle.');
            return null;
        }
`);
 if(!text.includes('if (userid.length > 18)')||!text.includes('name = Chat.namefilter(name, this);'))throw Error('Name patch point changed');
 text=text.replace('if (userid.length > 18)',"if (userid.length > 18 && !/^bww[a-f0-9]{32}$/.test(userid))").replace('name = Chat.namefilter(name, this);',"name = /^bww[a-f0-9]{32}$/.test(userid) ? userid : Chat.namefilter(name, this);");
 fs.writeFileSync(file,text);
}
console.log('Profile authentication patch ready. Build before restarting.');
