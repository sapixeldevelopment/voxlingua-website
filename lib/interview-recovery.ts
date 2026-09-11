export type RecoveryCopy={key:string;userId:string;sessionId:string;attempt:string;serverId:string;mode:'guided'|'realtime';blob:Blob;lines:Array<{role:'user'|'assistant';text:string}>;expires:number};
const DB='dexlyy-interview-recovery';
export async function recoveryStore(action:'read'|'write'|'delete',key:string,value?:RecoveryCopy):Promise<RecoveryCopy|null> {
 if(typeof indexedDB==='undefined')throw new Error('This browser cannot keep a recovery copy.');
 return new Promise((resolve,reject)=>{
  let database:IDBDatabase|undefined;
  let transaction:IDBTransaction|undefined,expired=false;
  const timer=setTimeout(()=>{expired=true;transaction?.abort();database?.close();reject(new Error('Recovery storage is unavailable.'));},5000);
  const request=indexedDB.open(DB,1);
  request.onupgradeneeded=()=>{if(expired){request.transaction?.abort();return;}request.result.createObjectStore('copies',{keyPath:'key'});};
  request.onerror=()=>{clearTimeout(timer);reject(new Error('Recovery storage is unavailable.'));};
  request.onsuccess=()=>{
   database=request.result;
   if(expired){database.close();return;}
   const tx=database.transaction('copies','readwrite'),store=tx.objectStore('copies');
   transaction=tx;
   let found:RecoveryCopy|null=null;
   // Expiry is enforced when this browser next opens the recovery store.
   const cursor=store.openCursor();cursor.onsuccess=()=>{const c=cursor.result;if(c){if(c.value.expires<Date.now())c.delete();c.continue();}};
   if(action==='write'&&value)store.put(value);
   else if(action==='delete')store.delete(key);
   else {const read=store.get(key);read.onsuccess=()=>{if(read.result?.expires>Date.now())found=read.result;};}
   tx.oncomplete=()=>{clearTimeout(timer);database?.close();resolve(found);};
   tx.onerror=()=>{clearTimeout(timer);database?.close();reject(new Error('Recovery copy could not be saved.'));};
  };
 });
}
