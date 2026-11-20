import { DurableObject } from 'cloudflare:workers';
import worker from './worker.mjs';
import { PartyRoomController } from './party-room.mjs';
export class PartyRoom extends DurableObject {
 constructor(ctx,env){super(ctx,env);this.controller=new PartyRoomController(ctx,env);}
 fetch(request){return this.controller.fetch(request);}
 alarm(){return this.controller.alarm();}
 webSocketMessage(ws,message){return this.controller.webSocketMessage(ws,message);}
 webSocketClose(ws,code,reason){return this.controller.webSocketClose(ws,code,reason);}
 webSocketError(ws){return this.controller.webSocketError(ws);}
}
export default worker;
