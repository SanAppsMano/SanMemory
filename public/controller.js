const params=new URLSearchParams(location.search);
const player=parseInt(params.get("player"));
const room=params.get("room");

document.getElementById("info").textContent =
  "Jogador "+player+" — Sala "+room;

const ws=new WebSocket(location.origin.replace("http","ws")+"/ws/"+room);

ws.onopen=()=>{
  ws.send(JSON.stringify({type:"join",player}));
};

ws.onmessage=e=>{
  const msg=JSON.parse(e.data);
  if(msg.type==="turn") updateTurn(msg.turn);
  if(msg.type==="state") updateTurn(msg.turn);
  if(msg.type==="end") onEnd(msg);
};

function updateTurn(turn){
  const el=document.getElementById("turn");
  el.textContent = (turn===player)?"Sua vez":"Aguardando...";
}

function onEnd(msg){
  document.getElementById("turn").textContent =
    "Fim — Vencedor: Jogador "+msg.winner;
}

function sendMove(i){
  ws.send(JSON.stringify({
    type:"move",
    player,
    cardIndex:i
  }));
}

const buttonsDiv=document.getElementById("buttons");
for(let i=0;i<12;i++){
  const b=document.createElement("button");
  b.textContent = i+1;
  b.onclick=()=>sendMove(i);
  buttonsDiv.appendChild(b);
}
