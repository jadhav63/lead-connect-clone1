import { inflateSync } from 'node:zlib';
import { createHash } from 'node:crypto';

export type SynxisRoom = {
  number:string; roomType:string; hkStatus:'CLEAN'|'DIRTY'; occupancyStatus:'VACANT'|'OCCUPIED';
  guestStatus:string; checkIn:string; checkOut:string; pet:boolean; outOfOrder:boolean; outOfInventory:boolean;
  warning:string|null;
};
function decodePdfString(s:string) {
  return s.replace(/\\([0-7]{1,3}|[nrtbf()\\])/g,(_all,v:string)=>
    /^[0-7]+$/.test(v)?String.fromCharCode(parseInt(v,8)):
    ({n:'\n',r:'\r',t:'\t',b:'\b',f:'\f'} as Record<string,string>)[v]??v);
}
type Cell={x:number;y:number;text:string};
function contentStreams(pdf:Buffer):string[]{
  const binary=pdf.toString('latin1'),outputs:string[]=[];
  const marker=/stream\r?\n/g;let match:RegExpExecArray|null;
  while((match=marker.exec(binary))){
    const start=match.index+match[0].length,end=binary.indexOf('endstream',start);
    if(end<0)break;
    // A stream length is not always exact when the PDF producer adds CRLF.
    let bytes=pdf.subarray(start,end);
    let content='';
    try{content=inflateSync(bytes).toString('latin1');}
    catch{
      try{content=inflateSync(bytes.subarray(0,bytes.length-2)).toString('latin1');}
      catch{content=bytes.toString('latin1');}
    }
    if(content.includes('BT')&&content.includes('Td')&&content.includes('Tj'))outputs.push(content);
    marker.lastIndex=end+9;
  }
  return outputs;
}
function cells(stream:string):Cell[]{
  const out:Cell[]=[];
  const blocks=/\bBT\b([\s\S]*?)\bET\b/g;
  let b:RegExpExecArray|null;
  while((b=blocks.exec(stream))){
    const block=b[1];
    const td=/(-?\d+(?:\.\d*)?)\s+(-?\d+(?:\.\d*)?)\s+Td\b/.exec(block);
    if(!td)continue;
    const values=[...block.matchAll(/\(((?:\\.|[^\\)])*)\)\s*Tj\b/g)]
      .map(x=>decodePdfString(x[1])).filter(Boolean);
    if(values.length)out.push({x:Math.round(Number(td[1])),y:Number(td[2]),text:values.join(' ').trim()});
  }
  return out;
}
function column(xs:Cell[],min:number,max:number):string{
  return xs.filter(c=>c.x>=min&&c.x<max).sort((a,b)=>b.y-a.y).map(c=>c.text).join(' ').trim();
}
/** Extract only operational, non-guest-identifying fields from the known PDFium SynXis Room List report. */
export function extractSynxisPdf(pdf:Buffer){
  if(pdf.length<100||pdf.length>850_000||!pdf.subarray(0,8).toString('latin1').startsWith('%PDF-'))
    throw Error('PDF must be an unencrypted text-based Room List PDF smaller than 850 KB');
  const streams=contentStreams(pdf);
  const rooms:SynxisRoom[]=[];
  for(const s of streams){
    if(!/Tombstone Grand Hotel/i.test(s))continue;
    const cs=cells(s);
    const starts=cs.filter(c=>c.x>=38&&c.x<=60&&/^[12]\d{2}$/.test(c.text)).sort((a,b)=>b.y-a.y);
    for(let i=0;i<starts.length;i++){
      const start=starts[i],lower=starts[i+1]?.y??-1e10;
      const row=cs.filter(c=>c.y<=start.y+1&&c.y>lower+1);
      const type=column(row,105,175),hk=column(row,180,265),occupancy=column(row,270,345);
      const guest=column(row,350,430),checkIn=column(row,430,505),checkOut=column(row,505,580),
        order=column(row,580,650),note=column(row,650,840);
      if(!/^(RM[123]|AC[123]|SU1)$/.test(type))continue;
      if(!/^(Clean|Dirty)$/i.test(hk)||!/^(Vacant|Occupied)/i.test(occupancy))continue;
      const pet=/Pet In Room/i.test([occupancy,guest,order,note].join(' '));
      const ooo=/\bOOO\b/i.test([order,note].join(' ')),ooi=/\bOOI\b/i.test([order,note].join(' '));
      rooms.push({
        number:start.text,roomType:type,hkStatus:hk.toUpperCase() as SynxisRoom['hkStatus'],
        occupancyStatus:/^Occupied/i.test(occupancy)?'OCCUPIED':'VACANT',
        guestStatus:guest,checkIn,checkOut,pet,outOfOrder:ooo,outOfInventory:ooi,
        warning:!guest&&!ooo&&!ooi?'Guest status not recognized':null
      });
    }
  }
  const byNumber=new Map<string,number>();
  for(const r of rooms)byNumber.set(r.number,(byNumber.get(r.number)||0)+1);
  const duplicates=[...byNumber].filter(([,count])=>count>1).map(([num])=>num);
  const footerDates=streams.flatMap(stream=>[...stream.matchAll(/\\((\\d{2}\\/\\d{2}\\/\\d{4})\\s+\\d{2}:\\d{2}:\\d{2}\\s+[AP]M\\)\\s*Tj/g)].map(m=>m[1]));
  const reportDate=footerDates.length===0?null:(()=>{
    const [mm,dd,yyyy]=footerDates[0].split('/');return yyyy+'-'+mm+'-'+dd;
  })();
  const signature=createHash('sha256').update(pdf).digest('hex');
  return {rooms:rooms.sort((a,b)=>Number(a.number)-Number(b.number)),duplicates,sha256:signature,
    textBased:rooms.length>0,reportDate,reportFormat:'SynXis PDFium Room List'};
}
