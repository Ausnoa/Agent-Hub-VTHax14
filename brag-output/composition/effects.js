// Deterministic DOM 3D: fixed central nucleus and orbital satellites, adapted
// from the locked-nucleus-orbit primitive and the project's TopologyGraph.
function addEffects(tl) {
  const root = document.getElementById('root');
  const atmosphere = document.createElement('div');
  atmosphere.className = 'atmosphere';
  atmosphere.dataset.layoutIgnore = '';
  atmosphere.innerHTML = '<div class="mesh-grid"></div><div class="aurora"></div><div class="aurora violet"></div>';
  root.prepend(atmosphere);
  tl.to('.aurora',{x:-150,y:90,scale:1.2,duration:22,ease:'sine.inOut'},0);
  tl.to('.aurora.violet',{x:120,y:-110,duration:22,ease:'sine.inOut'},0);
  for (const panel of document.querySelectorAll('.panel')) {
    const sheen = document.createElement('div');
    sheen.className = 'glass-sheen'; sheen.dataset.layoutIgnore = '';
    panel.prepend(sheen);
    const start = panel.closest('.clip')?.dataset.start || 0;
    tl.fromTo(sheen,{x:0},{x:2100,duration:2.8,ease:'power1.inOut'},Number(start)+.5);
  }
  function orb(host,id,extra,start,duration) {
    const stage = document.createElement('div');
    stage.className = 'orb-stage '+extra; stage.id=id; stage.dataset.layoutIgnore='';
    stage.innerHTML='<div class="orb-halo"></div><div class="orb-world"><div class="orb-ring"></div><div class="orb-ring"></div><div class="orb-ring"></div><div class="orb-core">'+Array.from({length:6},()=>'<div class="cube-face"></div>').join('')+'</div></div>';
    host.append(stage);
    const world=stage.querySelector('.orb-world');
    const rings=stage.querySelectorAll('.orb-ring');
    const core=stage.querySelector('.orb-core');
    const faces=stage.querySelectorAll('.cube-face');
    const poses=[{z:53},{z:-53,rotationY:180},{x:53,rotationY:90},{x:-53,rotationY:-90},{y:53,rotationX:90},{y:-53,rotationX:-90}];
    faces.forEach((face,i)=>gsap.set(face,poses[i]));
    gsap.set(rings[0],{rotationX:65,rotationY:15});
    gsap.set(rings[1],{rotationX:-35,rotationY:65});
    gsap.set(rings[2],{rotationX:15,rotationY:-55});
    tl.fromTo(stage,{opacity:0,scale:.65},{opacity:1,scale:1,duration:.65,ease:'power3.out'},start);
    tl.fromTo(world,{rotationX:15,rotationY:-30},{rotationX:35,rotationY:180,duration,ease:'none'},start);
    tl.fromTo(core,{rotationX:20,rotationY:0},{rotationX:200,rotationY:300,duration,ease:'none'},start);
    rings.forEach((ring,i)=>tl.to(ring,{rotation:i%2?-240:260,duration,ease:'none'},start));
  }
  orb(document.getElementById('hook'),'intro-orb','',.15,2.85);
  orb(document.getElementById('outro'),'outro-orb','outro-orb',18,4);
  ['#node1','#node2','#node3'].forEach((s,i)=>{
    tl.fromTo(s,{rotationY:-28,rotationX:10,z:-110},{rotationY:0,rotationX:0,z:0,duration:.8,ease:'power3.out'},4.02+i);
    tl.to(s,{y:-9,duration:1.25,repeat:1,yoyo:true,ease:'sine.inOut'},7+i*.12);
  });
  document.querySelectorAll('.link').forEach((link,i)=>{
    const dot=document.createElement('span');dot.className='signal';dot.dataset.layoutIgnore='';link.append(dot);
    tl.fromTo(dot,{x:0,opacity:0},{x:58,opacity:1,duration:.8,repeat:3,repeatDelay:.3,ease:'none'},5+i);
  });
  const graph=document.createElementNS('http://www.w3.org/2000/svg','svg');
  graph.setAttribute('viewBox','0 0 420 190');graph.setAttribute('class','trace-graph');graph.setAttribute('aria-label','Agent handoff topology');
  graph.innerHTML='<ellipse class="orbit-line" cx="210" cy="95" rx="170" ry="72"/><ellipse class="orbit-line" cx="210" cy="95" rx="105" ry="50"/><path class="edge" d="M70 95H170 M250 95H350 M210 55V25 M210 135V165"/><circle class="graph-core" cx="210" cy="95" r="39"/><circle class="sat" cx="55" cy="95" r="18"/><circle class="sat" cx="365" cy="95" r="18"/><circle class="sat" cx="210" cy="20" r="12"/><circle class="sat" cx="210" cy="170" r="12"/><circle class="graph-dot" cx="80" cy="95" r="5"/><path d="M195 95l10 10 21-23" fill="none" stroke="#74ffce" stroke-width="5"/>';
  document.querySelector('.trace').append(graph);
  tl.fromTo(graph,{opacity:0,scale:.85},{opacity:1,scale:1,duration:.7,ease:'power2.out'},10.6);
  tl.to('.edge',{strokeDashoffset:-120,duration:7,ease:'none'},11);
  tl.fromTo('.graph-dot',{x:0},{x:260,duration:1.8,repeat:3,ease:'none'},10.8);
}
