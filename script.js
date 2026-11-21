const EMPTY=0,BLACK=1,WHITE=2;
const DIRS=[[-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0],[1,1]];
const $=id=>document.getElementById(id);
const jp=s=>JSON.parse('"'+s+'"');
let N=8,board,turn,finished,showHints,lastMove;
let specialMode=false,speedMode=false,bombMode=false,bonusMode=false,turnDeadline=0,turnSeconds=2,clockInterval=null,bombMemoryDeadline=0,bombMemoryInterval=null;
let bombTiles=[],bonusTiles=[],bombPoints,boardVictoryAwarded=false,explosionAt=null,powersUsed,bonusMoves=0,freePlacementFor=null,overwriteFor=null,history=[];
let pendingPower=null,pendingPowerPlayer=null;
const storageKey=(size,special=false,speed=false,bomb=false,bonus=false)=>bonus?"othello-game-state-v1-bonus8":bomb?"othello-game-state-v1-bomb8":speed?`othello-game-state-v1-speed${size}`:special?"othello-game-state-v1-special8":size===8?"othello-game-state-v1":`othello-game-state-v1-${size}`;
const other=p=>p===BLACK?WHITE:BLACK;
const name=p=>p===BLACK?"BLACK":"WHITE";

function initialBoard(size){
  const b=Array.from({length:size},()=>Array(size).fill(EMPTY));
  const start=Math.floor(size/2)-1;
  b[start][start]=WHITE;b[start][start+1]=BLACK;b[start+1][start]=BLACK;b[start+1][start+1]=WHITE;
  return b;
}
function randomBombTiles(){
  const cells=[];for(let r=0;r<N;r++)for(let c=0;c<N;c++)if(board[r][c]===EMPTY)cells.push([r,c]);
  for(let i=cells.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[cells[i],cells[j]]=[cells[j],cells[i]];}
  return cells.slice(0,3);
}
function hasBomb(r,c){return bombTiles.some(([y,x])=>y===r&&x===c);}
function hasBonus(r,c){return bonusTiles.some(([y,x])=>y===r&&x===c);}
function save(){
  try{localStorage.setItem(storageKey(N,specialMode,speedMode,bombMode,bonusMode),JSON.stringify({size:N,specialMode,speedMode,bombMode,bonusMode,turnDeadline,turnSeconds,bombMemoryDeadline,bombTiles,bonusTiles,bombPoints,boardVictoryAwarded,board,turn,finished,showHints,lastMove,powersUsed,bonusMoves,freePlacementFor,overwriteFor,history,pendingPower,pendingPowerPlayer}));}
  catch(error){console.warn("Could not save the game state.",error);}
}
function load(size,special=false,speed=false,bomb=false,bonus=false){
  try{
    const saved=JSON.parse(localStorage.getItem(storageKey(size,special,speed,bomb,bonus)));
    if(!saved||!(saved.size===size||(size===8&&saved.size===undefined&&!special&&!speed&&!bomb&&!bonus))||!(saved.specialMode===special||(saved.specialMode===undefined&&!special))||!(saved.speedMode===speed||(saved.speedMode===undefined&&!speed))||!(saved.bombMode===bomb||(saved.bombMode===undefined&&!bomb))||!(saved.bonusMode===bonus||(saved.bonusMode===undefined&&!bonus))||!Array.isArray(saved.board)||saved.board.length!==size||!saved.board.every(row=>Array.isArray(row)&&row.length===size&&row.every(v=>[EMPTY,BLACK,WHITE].includes(v)))||![BLACK,WHITE].includes(saved.turn)||typeof saved.finished!=="boolean"||typeof saved.showHints!=="boolean"||!(saved.lastMove===null||(Array.isArray(saved.lastMove)&&saved.lastMove.length===2&&saved.lastMove.every(v=>Number.isInteger(v)&&v>=0&&v<size))))return false;
    N=size;specialMode=special;speedMode=speed;bombMode=bomb;bonusMode=bonus;turnDeadline=saved.turnDeadline||0;turnSeconds=saved.turnSeconds||2;bombMemoryDeadline=saved.bombMemoryDeadline||0;bombTiles=Array.isArray(saved.bombTiles)?saved.bombTiles:[];bonusTiles=Array.isArray(saved.bonusTiles)?saved.bonusTiles:[];bombPoints=saved.bombPoints||{[BLACK]:0,[WHITE]:0};boardVictoryAwarded=!!saved.boardVictoryAwarded;board=saved.board;turn=saved.turn;finished=saved.finished;showHints=saved.showHints;lastMove=saved.lastMove;
    powersUsed=saved.powersUsed||{[BLACK]:false,[WHITE]:false};bonusMoves=saved.bonusMoves||0;freePlacementFor=saved.freePlacementFor??null;overwriteFor=saved.overwriteFor??null;history=Array.isArray(saved.history)?saved.history:[];pendingPower=saved.pendingPower||null;pendingPowerPlayer=saved.pendingPowerPlayer??null;
    return true;
  }catch(error){return false;}
}
function hasSavedGame(size,special=false,speed=false,bomb=false,bonus=false){
  const previous=[N,board,turn,finished,showHints,lastMove,specialMode,speedMode,bombMode,bonusMode,turnDeadline,turnSeconds,bombMemoryDeadline,bombTiles,bonusTiles,bombPoints,boardVictoryAwarded,explosionAt,powersUsed,bonusMoves,freePlacementFor,overwriteFor,history,pendingPower,pendingPowerPlayer];
  const found=load(size,special,speed,bomb,bonus);
  [N,board,turn,finished,showHints,lastMove,specialMode,speedMode,bombMode,bonusMode,turnDeadline,turnSeconds,bombMemoryDeadline,bombTiles,bonusTiles,bombPoints,boardVictoryAwarded,explosionAt,powersUsed,bonusMoves,freePlacementFor,overwriteFor,history,pendingPower,pendingPowerPlayer]=previous;
  return found;
}
function startClock(){
  clearInterval(clockInterval);clockInterval=null;
  $("speedClock").hidden=!speedMode;
  if(!speedMode||finished)return;
  if(history.length===0){turnDeadline=0;$("countdown").textContent="2.0";return;}
  if(!turnDeadline)turnDeadline=Date.now()+turnSeconds*1000;
  if(turnDeadline<=Date.now()){timeoutTurn();return;}
  const tick=()=>{
    const remaining=Math.max(0,turnDeadline-Date.now());$("countdown").textContent=(remaining/1000).toFixed(1);
    if(remaining<=0){clearInterval(clockInterval);clockInterval=null;timeoutTurn();}
  };
  clockInterval=setInterval(tick,50);tick();
}
function startBombMemoryClock(){
  clearInterval(bombMemoryInterval);bombMemoryInterval=null;
  $("bombPanel").hidden=!bombMode;
  if(!bombMode||!bombMemoryDeadline)return;
  const tick=()=>{
    const remaining=Math.max(0,bombMemoryDeadline-Date.now());$("bombCountdown").textContent=(remaining/1000).toFixed(1);
    if(remaining<=0){clearInterval(bombMemoryInterval);bombMemoryInterval=null;bombMemoryDeadline=0;render(jp("\\u7206\\u5F3E\\u306E\\u5834\\u6240\\u3092\\u96A0\\u3057\\u307E\\u3057\\u305F\\u3002\\u30B2\\u30FC\\u30E0\\u958B\\u59CB\\uFF01"));}
  };
  bombMemoryInterval=setInterval(tick,50);tick();
}
function timeoutTurn(){
  if(!speedMode||finished)return;
  const skipped=turn;turn=other(turn);turnSeconds=4;let notice=`${name(skipped)} ${jp("\\u6642\\u9593\\u5207\\u308C\\u3067\\u30B9\\u30AD\\u30C3\\u30D7\\u3057\\u307E\\u3057\\u305F")} / ${jp("\\u6B21\\u306E\\u756A\\u306F4\\u79D2")}`;
  if(!legalMoves(turn).length){
    if(!legalMoves(skipped).length)finished=true;
    else{turn=skipped;notice+=` / ${name(turn)} ${jp("\\u306B\\u7F6E\\u3051\\u308B\\u5834\\u6240\\u304C\\u306A\\u3044\\u305F\\u3081\\u30D1\\u30B9")}`;}
  }
  turnDeadline=Date.now()+turnSeconds*1000;render(notice);
}
function flipsAt(r,c,p,allowOccupied=false){
  if(!allowOccupied&&board[r][c]!==EMPTY)return [];
  const result=[];
  for(const [dr,dc] of DIRS){
    const line=[];let y=r+dr,x=c+dc;
    while(y>=0&&y<N&&x>=0&&x<N&&board[y][x]===other(p)){line.push([y,x]);y+=dr;x+=dc;}
    if(line.length&&y>=0&&y<N&&x>=0&&x<N&&board[y][x]===p)result.push(...line);
  }
  return result;
}
function adjacentToStone(r,c){
  return DIRS.some(([dr,dc])=>{const y=r+dr,x=c+dc;return y>=0&&y<N&&x>=0&&x<N&&board[y][x]!==EMPTY;});
}
function legalMoves(p){
  const moves=[],seen=new Set(),allowOccupied=specialMode&&(overwriteFor===p||(pendingPower==="overwrite"&&pendingPowerPlayer===p));
  for(let r=0;r<N;r++)for(let c=0;c<N;c++){
    const flips=flipsAt(r,c,p,allowOccupied);
    const free=specialMode&&(freePlacementFor===p||(pendingPower==="free"&&pendingPowerPlayer===p))&&board[r][c]===EMPTY&&adjacentToStone(r,c);
    if(flips.length||free){const key=`${r},${c}`;if(!seen.has(key)){moves.push([r,c]);seen.add(key);}}
  }
  return moves;
}
function scores(){
  let b=0,w=0;for(const row of board)for(const v of row){if(v===BLACK)b++;if(v===WHITE)w++;}
  return {b,w};
}
function awardPointModeResult(){
  if(!(bombMode||bonusMode)||!finished||boardVictoryAwarded)return;
  if(bombMode){const {b,w}=scores();if(b>w)bombPoints[BLACK]+=2;else if(w>b)bombPoints[WHITE]+=2;}
  if(bonusMode)for(const [r,c] of bonusTiles)if(board[r][c]===BLACK||board[r][c]===WHITE)bombPoints[board[r][c]]+=5;
  boardVictoryAwarded=true;
}
function snapshot(){return {board:board.map(row=>row.slice()),turn,finished,lastMove:lastMove&&lastMove.slice(),bonusMoves,freePlacementFor,overwriteFor};}
function move(r,c){
  if(finished)return;
  if(bombMode&&bombMemoryDeadline){if(Date.now()<bombMemoryDeadline)return;bombMemoryDeadline=0;}
  if(speedMode&&history.length>0&&Date.now()>=turnDeadline){timeoutTurn();return;}
  if(pendingPower==="undo")return;
  const mover=turn,selected=pendingPowerPlayer===turn?pendingPower:null;
  const flips=flipsAt(r,c,mover,specialMode&&(overwriteFor===mover||selected==="overwrite"));
  const free=specialMode&&(freePlacementFor===mover||selected==="free")&&board[r][c]===EMPTY&&adjacentToStone(r,c);
  if(!flips.length&&!free)return;
  const bombHit=bombMode&&hasBomb(r,c);
  const bonusHit=bonusMode&&hasBonus(r,c);
  history.push(snapshot());
  if(selected){powersUsed[mover]=true;if(selected==="extra")bonusMoves=2;}
  board[r][c]=mover;for(const [y,x] of flips)board[y][x]=mover;
  let notice="";
  if(bombHit){bombTiles=bombTiles.filter(([y,x])=>y!==r||x!==c);bombPoints[other(mover)]+=1;explosionAt=[r,c];notice=`BOOM! ${name(other(mover))} +1 ${jp("\\u30DD\\u30A4\\u30F3\\u30C8")}`;}
  else if(bonusHit){explosionAt=null;notice=`BONUS SQUARE — ${jp("\\u30B2\\u30FC\\u30E0\\u7D42\\u4E86\\u6642\\u306B\\u77F3\\u304C\\u3042\\u308C\\u3070+5 PTS")}`;}
  else explosionAt=null;
  lastMove=[r,c];if(freePlacementFor===mover)freePlacementFor=null;if(overwriteFor===mover)overwriteFor=null;pendingPower=null;pendingPowerPlayer=null;
  const keepingTurn=bonusMoves>0;
  if(keepingTurn){bonusMoves--;turn=bonusMoves>0?mover:other(mover);}else turn=other(mover);
  if(keepingTurn&&turn===mover&&!legalMoves(mover).length){
    bonusMoves=0;turn=other(mover);
    if(!legalMoves(turn).length)finished=true;
  }else if(!legalMoves(turn).length){
    if(!legalMoves(other(turn)).length)finished=true;
    else{const passed=turn;turn=other(turn);notice=`${name(passed)} ${jp("\\u306f\\u7F6E\\u3051\\u308B\\u5834\\u6240\\u304C\\u306A\\u3044\\u305F\\u3081\\u30D1\\u30B9\\u3057\\u307E\\u3059")}`;}
  }
  awardPointModeResult();
  if(speedMode){turnSeconds=2;turnDeadline=Date.now()+turnSeconds*1000;}
  render(notice);
}
function undoLastMove(player){
  if(!history.length)return false;
  const used={...powersUsed};used[player]=true;
  const previous=history.pop();board=previous.board;turn=previous.turn;finished=previous.finished;lastMove=previous.lastMove;
  bonusMoves=previous.bonusMoves;freePlacementFor=previous.freePlacementFor;overwriteFor=previous.overwriteFor;powersUsed=used;pendingPower=null;pendingPowerPlayer=null;
  render(jp("\\u76F4\\u524D\\u306E1\\u624B\\u3092\\u53D6\\u308A\\u6D88\\u3057\\u307E\\u3057\\u305F"));return true;
}
function selectPower(kind){
  if(!specialMode||finished||powersUsed[turn])return;
  if(kind==="extra"&&history.length===0)return;
  if(kind==="undo"&&(history.length===0||powersUsed[BLACK]||powersUsed[WHITE]))return;
  pendingPower=kind;pendingPowerPlayer=turn;render();
}
function render(notice=""){
  const boardEl=$("board");boardEl.style.setProperty("--board-size",N);boardEl.innerHTML="";
  const memoryActive=bombMode&&bombMemoryDeadline>Date.now();
  const moves=finished||pendingPower==="undo"||memoryActive?[]:legalMoves(turn),legal=new Set(moves.map(([r,c])=>`${r},${c}`));
  for(let r=0;r<N;r++)for(let c=0;c<N;c++){
    const cell=document.createElement("button");cell.type="button";cell.className="cell";cell.setAttribute("role","gridcell");
    const v=board[r][c],key=`${r},${c}`;
    if(v){const stone=document.createElement("span");stone.className=`stone ${v===BLACK?"black":"white"}`;cell.append(stone);cell.setAttribute("aria-label",`${r+1}, ${c+1} ${name(v)}`);}
    else cell.setAttribute("aria-label",`${r+1}, ${c+1}`);
    if(memoryActive&&hasBomb(r,c)){cell.classList.add("bomb-memory");const icon=document.createElement("span");icon.className="bomb-icon";icon.textContent="💣";cell.append(icon);}
    if(bonusMode&&hasBonus(r,c))cell.classList.add("bonus-square");
    if(explosionAt&&explosionAt[0]===r&&explosionAt[1]===c){cell.classList.add("explosion");const burst=document.createElement("span");burst.className="explosion-burst";burst.textContent="💥";cell.append(burst);}
    if(!v&&showHints&&legal.has(key))cell.classList.add("hint");if(lastMove&&lastMove[0]===r&&lastMove[1]===c)cell.classList.add("last-move");
    cell.disabled=!legal.has(key)||finished||memoryActive;cell.addEventListener("click",()=>move(r,c));boardEl.append(cell);
  }
  const {b,w}=scores();$("blackScore").textContent=b;$("whiteScore").textContent=w;
  const pointMode=bombMode||bonusMode;
  $("blackPointWrap").hidden=!pointMode;$("whitePointWrap").hidden=!pointMode;
  $("blackPoints").textContent=pointMode?bombPoints[BLACK]:0;$("whitePoints").textContent=pointMode?bombPoints[WHITE]:0;
  $("blackPanel").classList.toggle("active",!finished&&turn===BLACK);$("whitePanel").classList.toggle("active",!finished&&turn===WHITE);
  $("turnDot").className=`dot ${turn===BLACK?"black-dot":"white-dot"}`;
  if(finished){$("turnText").textContent="GAME OVER";const result=b===w?"DRAW":`${b>w?"BLACK":"WHITE"} WINS`;$("message").textContent=`${result}  BLACK ${b} - WHITE ${w}`;}
  else{$("turnText").textContent=`${name(turn)} \\u306E\\u756A`;$ ("message").textContent=notice||(moves.length?"\\u5149\\u3063\\u3066\\u3044\\u308B\\u30DE\\u30B9\\u306B\\u7F6E\\u3051\\u307E\\u3059":"\\u7F6E\\u3051\\u308B\\u5834\\u6240\\u304C\\u3042\\u308A\\u307E\\u305B\\u3093");}
  if(finished&&pointMode){const result=bombPoints[BLACK]===bombPoints[WHITE]?"DRAW":`${bombPoints[BLACK]>bombPoints[WHITE]?"BLACK":"WHITE"} WINS`;$ ("message").textContent=`${result}  BLACK ${bombPoints[BLACK]} PTS - WHITE ${bombPoints[WHITE]} PTS`;}
  else if(!finished&&bombMode&&memoryActive){$ ("message").textContent="\\u7206\\u5F3E\\u306E\\u5834\\u6240\\u3092\\u899A\\u3048\\u3066\\u304F\\u3060\\u3055\\u3044";}
  $("hintButton").textContent=showHints?"\\u7F6E\\u3051\\u308B\\u5834\\u6240\\u3092\\u96A0\\u3059":"\\u7F6E\\u3051\\u308B\\u5834\\u6240\\u3092\\u8868\\u793A";
  const panel=$("specialPanel");panel.hidden=!specialMode;
  $("bombPanel").hidden=!bombMode;
  $("bonusPanel").hidden=!bonusMode;if(bonusMode)$("bonusRemaining").textContent=`×${bonusTiles.length}`;
  if(bombMode){$("bombStatus").textContent=memoryActive?jp("\\u7206\\u5F3E\\u306E\\u4F4D\\u7F6E\\u3092\\u899A\\u3048\\u3066\\u304F\\u3060\\u3055\\u3044"):jp("\\u7206\\u5F3E\\u3092\\u8E0F\\u3080\\u3068\\u76F8\\u624B+1 / \\u76E4\\u9762\\u52DD\\u8005+2")+` (${bombTiles.length})`;$("bombCountdown").textContent=memoryActive?Math.max(0,(bombMemoryDeadline-Date.now())/1000).toFixed(1):"0.0";}
  if(specialMode){
    const remaining=player=>powersUsed[player]?jp("\\u4F7F\\u7528\\u6E08\\u307F"):jp("\\u672A\\u4F7F\\u7528");
    $("specialStatus").textContent=`BLACK ${remaining(BLACK)} / WHITE ${remaining(WHITE)}`;
    $("specialTurnNote").textContent=pendingPowerPlayer===turn&&pendingPower?(pendingPower==="undo"?jp("\\u3084\\u308A\\u76F4\\u3057\\u3092\\u5B9F\\u884C\\u3059\\u308B\\u304B\\u9078\\u3073\\u307E\\u3059"):jp("\\u77F3\\u3092\\u7F6E\\u304F\\u3068\\u4F7F\\u7528\\u304C\\u78BA\\u5B9A\\u3057\\u307E\\u3059")):powersUsed[turn]?jp("\\u3053\\u306E\\u30D7\\u30EC\\u30A4\\u30E4\\u30FC\\u306F\\u7279\\u6B8A\\u30EB\\u30FC\\u30EB\\u4F7F\\u7528\\u6E08\\u307F"):jp("\\u7279\\u6B8A\\u30EB\\u30FC\\u30EB\\u306F\\u77F3\\u3092\\u7F6E\\u304F\\u307E\\u3067\\u53D6\\u308A\\u6D88\\u305B\\u307E\\u3059");
  }
  const hasPending=pendingPowerPlayer===turn&&!!pendingPower;
  $("specialConfirm").hidden=!specialMode||!hasPending;
  $("confirmUndoButton").hidden=!hasPending||pendingPower!=="undo";
  document.querySelectorAll(".special-option").forEach(button=>{
    const power=button.dataset.power;
    button.disabled=!specialMode||finished||powersUsed[turn]||(power==="extra"&&history.length===0)||(power==="undo"&&(!history.length||powersUsed[BLACK]||powersUsed[WHITE]));
  });
  $("turnText").textContent=jp($("turnText").textContent);$("message").textContent=jp($("message").textContent);$("hintButton").textContent=jp($("hintButton").textContent);
  startClock();startBombMemoryClock();
  save();
}
function startGame(size,special=false,resume=false,speed=false,bomb=false,bonus=false){
  if(resume&&load(size,special,speed,bomb,bonus)){}else{N=size;specialMode=special;speedMode=speed;bombMode=bomb;bonusMode=bonus;turnDeadline=0;turnSeconds=2;bombMemoryDeadline=bomb?Date.now()+5000:0;board=initialBoard(size);turn=BLACK;finished=false;showHints=true;lastMove=null;powersUsed={[BLACK]:false,[WHITE]:false};bonusMoves=0;freePlacementFor=null;overwriteFor=null;history=[];pendingPower=null;pendingPowerPlayer=null;bombTiles=bomb?randomBombTiles():[];bonusTiles=bonus?randomBombTiles():[];bombPoints={[BLACK]:0,[WHITE]:0};boardVictoryAwarded=false;explosionAt=null;}
  $("startScreen").hidden=true;$("gameScreen").hidden=false;$("modeLabel").textContent=bonus?"8 x 8 BONUS":bomb?"8 x 8 BOMB":special?"8 x 8 SPECIAL":speed?`${size} x ${size} SPEED`:`${size} x ${size}`;
  render(resume?"":jp("\\u30B2\\u30FC\\u30E0\\u30B9\\u30BF\\u30FC\\u30C8\\uFF01 BLACK \\u304B\\u3089\\u59CB\\u3081\\u3088\\u3046"));
}
function updateResumeButtons(){
  document.querySelectorAll(".mode-button").forEach(button=>{
    const mode=button.dataset.mode,speed=mode==="speed6"||mode==="speed8",special=mode==="special8",bomb=mode==="bomb8",bonus=mode==="bonus8",size=mode==="speed6"?6:mode==="speed8"||special||bomb||bonus?8:Number(mode);
    button.querySelector(".resume-button")?.remove();
    if(hasSavedGame(size,special,speed,bomb,bonus)){const resume=document.createElement("span");resume.className="resume-button";resume.textContent=jp("\\u7D9A\\u304D\\u304B\\u3089");resume.addEventListener("click",event=>{event.stopPropagation();startGame(size,special,true,speed,bomb,bonus);});button.append(resume);}
  });
}
document.querySelectorAll(".mode-button").forEach(button=>button.addEventListener("click",()=>{
  const mode=button.dataset.mode,speed=mode==="speed6"||mode==="speed8",special=mode==="special8",bomb=mode==="bomb8",bonus=mode==="bonus8",size=mode==="speed6"?6:mode==="speed8"||special||bomb||bonus?8:Number(mode);
  if(hasSavedGame(size,special,speed,bomb,bonus)&&!confirm(`${mode} ${jp("\\u306E\\u4FDD\\u5B58\\u30C7\\u30FC\\u30BF\\u3092\\u4E0A\\u66F8\\u304D\\u3057\\u3066\\u65B0\\u3057\\u304F\\u59CB\\u3081\\u307E\\u3059\\u304B\\uFF1F")}`))return;
  startGame(size,special,false,speed,bomb,bonus);
}));
$("menuButton").addEventListener("click",()=>{$("gameScreen").hidden=true;$("startScreen").hidden=false;updateResumeButtons();});
$("hintButton").addEventListener("click",()=>{showHints=!showHints;render();});
$("resetButton").addEventListener("click",()=>{if(confirm(jp("\\u30B2\\u30FC\\u30E0\\u3092\\u6700\\u521D\\u304B\\u3089\\u3084\\u308A\\u76F4\\u3057\\u307E\\u3059\\u304B\\uFF1F"))){startGame(N,specialMode,false,speedMode,bombMode,bonusMode);}});
document.querySelectorAll(".special-option").forEach(button=>button.addEventListener("click",()=>selectPower(button.dataset.power)));
$("cancelPowerButton").addEventListener("click",()=>{pendingPower=null;pendingPowerPlayer=null;render();});
$("confirmUndoButton").addEventListener("click",()=>{if(pendingPower==="undo"&&pendingPowerPlayer===turn)undoLastMove(turn);});
updateResumeButtons();
