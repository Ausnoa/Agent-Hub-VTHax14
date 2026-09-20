export function chatPosition(anchor:{x:number;y:number},size:{width:number;height:number},viewport:{width:number;height:number}){
  const margin=12,topMargin=Math.min(72,Math.max(margin,viewport.height-size.height-margin));
  const clamp=(value:number,min:number,max:number)=>Math.max(min,Math.min(value,Math.max(min,max)));
  const above=anchor.y-size.height-margin;
  return {left:clamp(anchor.x+64-size.width,margin,viewport.width-size.width-margin),top:clamp(above>=topMargin?above:anchor.y+76,topMargin,viewport.height-size.height-margin)};
}
