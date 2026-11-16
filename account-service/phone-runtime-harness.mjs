// Local-only harness. Never configured as the production entry point.
export {PhoneRoom} from './phone-room.mjs';
export default {async fetch(request,env){if(request.method!=='POST')return new Response('Harness', {status:405});const {actor,action,data}=await request.json();return Response.json(await env.PHONE_ROOMS.getByName('LOCALTEST').command(actor,action,data));}};
