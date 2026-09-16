import React,{useEffect,useMemo,useRef,useState}from"react";
import ReactDOM from"react-dom/client";
import{Analytics}from"@vercel/analytics/react";
import{track}from"@vercel/analytics";
import{hashSeed,utcDayKey}from"@dailyfoundry/core";
import baseQuestions from"../../../games/internet-timeline/questions.json";
import extraQuestions from"../../../games/internet-timeline/questions-extra.json";
import funQuestions from"../../../games/internet-timeline/questions-fun.json";
import{SHARE_POSTER_TEMPLATE}from"./sharePosterTemplate";
import"./styles.css";
import"./archive.css";
import"./profiles.css";

type Difficulty="easy"|"medium"|"hard";
type Appeal="mainstream"|"known"|"niche";
type Question={id:string;prompt:string;answerYear:number;category:string;explanation?:string;sourceLabel?:string;sourceUrl?:string;difficulty?:Difficulty;entity?:string;appeal?:Appeal};
type PlayedRound={question:Question;correct:boolean;chosenIndex:number;correctIndex:number};
type SavedResult={day:string;rounds:PlayedRound[];completedAt:string};
type History=Record<string,SavedResult>;
type ReplayHistory=Record<string,{bestScore:number;plays:number}>;
type ShareState="idle"|"copied"|"saved"|"shared";
type ProfileKey="mix"|"culture"|"builders"|"social"|"close"|"hard"|"modern";
type Profile={key:ProfileKey;label:string;subtitle:string;categories?:string[];minYear?:number;maxYear?:number;difficulty:Difficulty[];close?:boolean};

const questions:Question[]=[...baseQuestions,...extraQuestions,...funQuestions]as Question[];
const byId=new Map(questions.map(q=>[q.id,q]));
const GAME_ID="internet-timeline",GUESSES=5,CARDS_NEEDED=6,DAY_MS=86_400_000;
const HISTORY_KEY=`dailyfoundry:${GAME_ID}:history:v2`,REPLAY_KEY=`dailyfoundry:${GAME_ID}:replays:v1`;
const LAUNCH_DAY=Date.UTC(2026,8,8),SCHEDULE_VERSION="schedule-v5",RECENT_DAYS_BLOCKED=14,ENTITY_COOLDOWN_DAYS=7;
const FIXED_DECK_IDS=[
 ["web-2022","web-1994","web-2008","web-2001","web-1976","web-2015"],
 ["web-2024","web-1993","web-2009","web-2000","web-1978","web-2017"]
];
const PROFILES:Profile[]=[
 {key:"mix",label:"Daily Mix",subtitle:"A little bit of the whole internet.",difficulty:["easy","medium","easy","medium","hard","medium"]},
 {key:"culture",label:"Internet Culture",subtitle:"Memes, creators, games and moments that escaped the screen.",categories:["Culture","Gaming","Social","Video","Entertainment","Community"],difficulty:["easy","easy","medium","medium","medium","hard"]},
 {key:"builders",label:"Builders of the Web",subtitle:"Browsers, platforms, infrastructure and the people who built online life.",categories:["Web","Tech","Search","Cloud","Business","Commerce","Security","Open Source"],difficulty:["easy","medium","medium","medium","hard","medium"]},
 {key:"social",label:"Social Web",subtitle:"From chat rooms to feeds, follows and viral loops.",categories:["Social","Communication","Community","Culture","Video"],difficulty:["easy","easy","medium","medium","medium","hard"]},
 {key:"close",label:"Close Call",subtitle:"The years are tighter today. Tiny gaps matter.",minYear:1994,difficulty:["easy","medium","medium","medium","hard","medium"],close:true},
 {key:"hard",label:"Hard Mode",subtitle:"Fewer obvious landmarks, but still fair.",difficulty:["medium","hard","medium","hard","medium","medium"]},
 {key:"modern",label:"Modern Internet",subtitle:"The mobile, social, streaming and AI era.",minYear:2000,difficulty:["easy","easy","medium","medium","medium","hard"]}
];
const ENTITY_HINTS:[string,string[]][]=[
 ["apple",["apple ","iphone","ipad","ipod","macintosh","vision pro","airpods","siri"]],
 ["google",["google","youtube","android","chrome","gmail"]],
 ["meta",["facebook","meta ","instagram","threads","messenger"]],
 ["openai",["openai","chatgpt","gpt-","dall","sora"]],
 ["microsoft",["microsoft","windows","xbox","msn "]],
 ["amazon",["amazon","aws","kindle","alexa","echo"]],
 ["twitter-x",["twitter"," x "]],
 ["tiktok",["tiktok","musical.ly"]],
 ["reddit",["reddit","wallstreetbets"]],
 ["bitcoin",["bitcoin"]],
 ["netflix",["netflix"]],
 ["spotify",["spotify"]],
 ["nintendo",["nintendo","game boy","wii","switch","pokémon"]],
 ["fortnite",["fortnite"]],
 ["twitch",["twitch"]]
];

function puzzleNumber(day:string){return Math.max(1,Math.floor((Date.parse(`${day}T00:00:00Z`)-LAUNCH_DAY)/DAY_MS)+1)}
function dayForPuzzle(n:number){return new Date(LAUNCH_DAY+(n-1)*DAY_MS).toISOString().slice(0,10)}
function todayPuzzle(){return puzzleNumber(utcDayKey())}
function profileForPuzzle(n:number){return n<=2?PROFILES[0]:PROFILES[(n-3)%PROFILES.length]}
function eraBucket(y:number){return y<1990?0:y<2000?1:y<2010?2:y<2020?3:4}
function difficultyOf(q:Question):Difficulty{if(q.difficulty)return q.difficulty;if(q.answerYear<1988)return"hard";if(q.answerYear>=2001&&["Social","Gaming","AI","Mobile","Entertainment","Culture"].includes(q.category))return"easy";if(["Security","Web"].includes(q.category)&&q.answerYear<1995)return"hard";return"medium"}
function entityOf(q:Question){if(q.entity)return q.entity;const s=`${q.id} ${q.prompt}`.toLowerCase();for(const[e,hints]of ENTITY_HINTS)if(hints.some(h=>s.includes(h)))return e;return""}
function profilePenalty(q:Question,p:Profile){let v=0;if(p.categories&&!p.categories.includes(q.category))v+=260;if(p.minYear&&q.answerYear<p.minYear)v+=280;if(p.maxYear&&q.answerYear>p.maxYear)v+=280;if(p.key!=="hard"&&q.appeal==="niche")v+=180;if(q.appeal==="mainstream")v-=36;return v}
function candidateScore(q:Question,selected:Question[],dayIndex:number,slot:number,p:Profile){
 const tie=hashSeed(`${GAME_ID}:${SCHEDULE_VERSION}:${dayIndex}:${slot}:${q.id}:${p.key}`)/0xffffffff;
 const target=p.difficulty[slot]??"medium";
 const difficultyPenalty=difficultyOf(q)===target?0:220;
 const sameYearPenalty=selected.some(x=>x.answerYear===q.answerYear)?10000:0;
 const sameEntityPenalty=entityOf(q)&&selected.some(x=>entityOf(x)===entityOf(q))?900:0;
 const eraCount=selected.filter(x=>eraBucket(x.answerYear)===eraBucket(q.answerYear)).length;
 const categoryCount=selected.filter(x=>x.category===q.category).length;
 const minDist=selected.length?Math.min(...selected.map(x=>Math.abs(x.answerYear-q.answerYear))):50;
 const distanceTerm=p.close?Math.min(minDist,20)*1.8:-Math.min(minDist,20)*1.1;
 return sameYearPenalty+sameEntityPenalty+profilePenalty(q,p)+difficultyPenalty+categoryCount*92+eraCount*24+distanceTerm+tie;
}
function fixedDeck(index:number){const ids=FIXED_DECK_IDS[index];if(!ids)return null;const deck=ids.map(id=>byId.get(id)).filter(Boolean)as Question[];return deck.length===CARDS_NEEDED?deck:null}
function buildDeck(dayIndex:number,recentDays:Question[][],profile:Profile){
 const blocked=new Set(recentDays.flat().map(q=>q.id));
 const recentEntityDays=recentDays.slice(-ENTITY_COOLDOWN_DAYS),blockedEntities=new Set(recentEntityDays.flat().map(entityOf).filter(Boolean));
 const fresh=questions.filter(q=>!blocked.has(q.id)&&(!blockedEntities.has(entityOf(q))||profile.key==="close"));
 const idFresh=questions.filter(q=>!blocked.has(q.id));
 const pool=fresh.length>=CARDS_NEEDED?fresh:idFresh.length>=CARDS_NEEDED?idFresh:questions,selected:Question[]=[];
 for(let slot=0;slot<CARDS_NEEDED;slot++){
  const unique=pool.filter(q=>!selected.some(x=>x.id===q.id||x.answerYear===q.answerYear));
  const remaining=(unique.length?unique:pool.filter(q=>!selected.some(x=>x.id===q.id))).sort((a,b)=>candidateScore(a,selected,dayIndex,slot,profile)-candidateScore(b,selected,dayIndex,slot,profile));
  if(!remaining[0])throw new Error("Not enough questions");selected.push(remaining[0]);
 }
 return selected;
}
function dailyDeck(day:string){const target=puzzleNumber(day)-1,scheduled:Question[][]=[];for(let i=0;i<=target;i++){const pinned=fixedDeck(i);if(pinned){scheduled.push(pinned);continue}const p=profileForPuzzle(i+1);scheduled.push(buildDeck(i,scheduled.slice(Math.max(0,scheduled.length-RECENT_DAYS_BLOCKED)),p))}return scheduled[target]}
function practiceDeck(seed:number){const p=PROFILES[Math.abs(seed)%PROFILES.length];return buildDeck(seed,[],p)}
function readJson<T>(key:string,fallback:T):T{try{return JSON.parse(localStorage.getItem(key)??"")as T}catch{return fallback}}
function sortChronologically(items:Question[]){return[...items].sort((a,b)=>a.answerYear-b.answerYear||a.id.localeCompare(b.id))}
function correctInsertionIndex(t:Question[],c:Question){return t.filter(x=>x.answerYear<c.answerYear).length}
function shareTone(score:number){if(score===5)return{headline:"PERFECTLY IN SYNC.",short:"Perfect timeline."};if(score===4)return{headline:"ONE GLITCH IN THE TIMELINE.",short:"One glitch in the timeline."};if(score>=2)return{headline:"TIME GOT WEIRD.",short:"Time got weird."};return{headline:"TIME IS A FLAT CIRCLE.",short:"No sense of internet time."}}
function shareText(label:string,score:number,rounds:PlayedRound[],url:string){const marks=rounds.map(r=>r.correct?"●":"○").join("  ");const hook=score===5?"I somehow went perfect.":score===4?"One moment got me.":score>=2?"One answer completely broke my sense of time.":"Apparently I remember the internet very badly.";return `I got ${score}/5 on ${label}. ${hook}\n${marks}\n\n5 internet moments. One timeline. No Googling.\nThink you can beat ${score}/5? → ${url}`}
function streak(history:History,today:string){let n=0,t=Date.parse(`${today}T00:00:00Z`);while(history[new Date(t).toISOString().slice(0,10)]){n++;t-=DAY_MS}return n}
function bestStreak(history:History){const ds=Object.keys(history).sort();let best=0,cur=0,prev=0;for(const d of ds){const t=Date.parse(`${d}T00:00:00Z`);cur=prev&&t-prev===DAY_MS?cur+1:1;best=Math.max(best,cur);prev=t}return best}
function isTouch(){return matchMedia?.("(pointer: coarse)").matches||innerWidth<=720}
function countdown(){const n=new Date();return Date.UTC(n.getUTCFullYear(),n.getUTCMonth(),n.getUTCDate()+1)-n.getTime()}
function formatCountdown(ms:number){const s=Math.max(0,Math.floor(ms/1000)),h=Math.floor(s/3600),m=Math.floor(s%3600/60);return`${String(h).padStart(2,"0")}:${String(m).padStart(2,"0")}:${String(s%60).padStart(2,"0")}`}

function ProfileBanner({profile,mode}:{profile:Profile;mode:"daily"|"archive"|"practice"}){return <div className="profile-banner"><div><span>{mode==="practice"?"ENDLESS PRACTICE":mode==="archive"?"ARCHIVE CHALLENGE":"TODAY'S CHALLENGE"}</span><strong>{profile.label}</strong></div><p>{profile.subtitle}</p></div>}
function SharePoster({label,played,streakCount,shareUrl}:{label:string;played:PlayedRound[];streakCount:number;shareUrl:string}){const score=played.filter(r=>r.correct).length,tone=shareTone(score);return <a className="template-poster" href={shareUrl} aria-label={`Play ${label}`}><img className="template-poster-bg" src={SHARE_POSTER_TEMPLATE} alt=""/><div className="template-puzzle-note"><strong>{label}</strong><span>A SMALL GUESS.<br/>A BIGGER PICTURE.</span></div><div className="template-result-panel"><div className="template-result-main"><strong>{score}/5</strong><h2>{tone.headline}</h2></div><div className="template-result-track">{played.map((r,i)=><span key={r.question.id} className={r.correct?"template-node hit":"template-node miss"} style={{left:`${i*25}%`}}/>)}</div>{streakCount>=2&&<div className="template-streak">{streakCount} DAY STREAK</div>}</div></a>}
function Archive({history,replays,current}:{history:History;replays:ReplayHistory;current:number}){const items=Array.from({length:current},(_,i)=>current-i);useEffect(()=>{track("archive_open",{game:GAME_ID,puzzles:current})},[current]);return <main><header className="topbar"><strong>Internet Timeline</strong><a href="/">Today</a></header><section className="archive-card"><p className="eyebrow">Puzzle archive</p><h1>Play the internet again.</h1><p className="archive-intro">Every daily challenge stays playable. Different challenge profiles make old days worth revisiting.</p><div className="archive-grid">{items.map(n=>{const d=dayForPuzzle(n),daily=history[d],rp=replays[String(n)],score=daily?daily.rounds.filter(r=>r.correct).length:rp?.bestScore,p=profileForPuzzle(n);return <a key={n} className="archive-item" href={`/?puzzle=${n}&replay=1`}><strong>#{n} · {p.label}</strong><span>{d}</span><small>{score!==undefined?`Best ${score}/5${rp?` · ${rp.plays} replay${rp.plays===1?"":"s"}`:""}`:"Not played"}</small></a>})}</div></section></main>}

function InternetTimeline(){
 const params=useMemo(()=>new URLSearchParams(location.search),[]),currentPuzzle=todayPuzzle();
 const practiceRaw=Number(params.get("practice")),practiceMode=Number.isFinite(practiceRaw)&&practiceRaw>0,practiceSeed=practiceMode?Math.floor(practiceRaw):0;
 const requested=Number(params.get("puzzle"));const puzzle=Number.isFinite(requested)&&requested>=1?Math.min(Math.floor(requested),currentPuzzle):currentPuzzle;
 const day=dayForPuzzle(puzzle),replayMode=!practiceMode&&(params.get("replay")==="1"||params.get("ref")==="share"||params.has("puzzle"));
 const mode:"daily"|"archive"|"practice"=practiceMode?"practice":replayMode?"archive":"daily";
 const profile=practiceMode?PROFILES[Math.abs(practiceSeed)%PROFILES.length]:profileForPuzzle(puzzle);
 const [history,setHistory]=useState<History>(()=>readJson(HISTORY_KEY,{}));const [replays,setReplays]=useState<ReplayHistory>(()=>readJson(REPLAY_KEY,{}));
 if(params.get("archive")==="1")return <Archive history={history} replays={replays} current={currentPuzzle}/>;
 const deck=useMemo(()=>practiceMode?practiceDeck(practiceSeed):dailyDeck(day),[day,practiceMode,practiceSeed]),anchor=deck[0],cards=deck.slice(1),saved=mode==="daily"?history[day]:undefined;
 const [roundIndex,setRoundIndex]=useState(saved?cards.length:0),[timeline,setTimeline]=useState<Question[]>(()=>saved?sortChronologically([anchor,...saved.rounds.map(r=>r.question)]):[anchor]);
 const [selectedSlot,setSelectedSlot]=useState<number|null>(null),[revealed,setRevealed]=useState(false),[played,setPlayed]=useState<PlayedRound[]>(saved?.rounds??[]),[shareState,setShareState]=useState<ShareState>("idle"),[timer,setTimer]=useState(countdown()),[touch,setTouch]=useState(false);
 const started=useRef(Date.now()),complete=roundIndex>=cards.length,current=complete?null:cards[roundIndex],correctIndex=current?correctInsertionIndex(timeline,current):-1,currentCorrect=selectedSlot===correctIndex;
 const streakCount=streak(history,utcDayKey()),maxStreak=bestStreak(history),nextPractice=Math.floor(Date.now()/1000)+Math.floor(Math.random()*10000);
 useEffect(()=>{setTouch(isTouch());track(mode==="practice"?"practice_start":mode==="archive"?"archive_start":"game_start",{game:GAME_ID,puzzle,mode,challenge_profile:profile.key,ref:params.get("ref")||"direct"})},[]);
 useEffect(()=>{if(!complete)return;const id=setInterval(()=>setTimer(countdown()),1000);return()=>clearInterval(id)},[complete]);
 useEffect(()=>{if(!complete||played.length!==cards.length||saved)return;const score=played.filter(r=>r.correct).length,base={game:GAME_ID,puzzle,score,mode,challenge_profile:profile.key,duration_seconds:Math.max(1,Math.round((Date.now()-started.current)/1000))};if(mode==="practice"){track("practice_complete",base);return}if(mode==="archive"){const prev=replays[String(puzzle)]??{bestScore:0,plays:0},next={...replays,[String(puzzle)]:{bestScore:Math.max(prev.bestScore,score),plays:prev.plays+1}};localStorage.setItem(REPLAY_KEY,JSON.stringify(next));setReplays(next);track("archive_complete",base)}else{const next={...history,[day]:{day,rounds:played,completedAt:new Date().toISOString()}};localStorage.setItem(HISTORY_KEY,JSON.stringify(next));setHistory(next);track("game_complete",base)}},[complete,played.length]);
 function lock(){if(!current||selectedSlot===null||revealed)return;setPlayed(p=>[...p,{question:current,correct:currentCorrect,chosenIndex:selectedSlot,correctIndex}]);setTimeline(p=>{const n=[...p];n.splice(correctIndex,0,current);return n});track("round_complete",{game:GAME_ID,puzzle,round:roundIndex+1,correct:currentCorrect,difficulty:difficultyOf(current),mode,challenge_profile:profile.key,entity:entityOf(current)||"none"});setRevealed(true)}
 function next(){setRoundIndex(v=>v+1);setSelectedSlot(null);setRevealed(false)}
 async function copy(){const shareUrl=practiceMode?`${location.origin}/?practice=${practiceSeed}&ref=share`:`${location.origin}/?puzzle=${puzzle}&ref=share`;const score=played.filter(r=>r.correct).length,label=practiceMode?`Internet Timeline ${profile.label}`:`Internet Timeline #${puzzle} · ${profile.label}`,text=shareText(label,score,played,shareUrl);track("share_click",{game:GAME_ID,puzzle,method:"copy",mode,challenge_profile:profile.key});try{await navigator.clipboard.writeText(text);setShareState("copied");track("share_success",{game:GAME_ID,puzzle,method:"clipboard",mode,challenge_profile:profile.key})}catch{prompt("Copy your challenge:",text)}}
 if(complete){const score=played.filter(r=>r.correct).length,tone=shareTone(score),shareUrl=practiceMode?`${location.origin}/?practice=${practiceSeed}&ref=share`:`${location.origin}/?puzzle=${puzzle}&ref=share`,label=practiceMode?`P${String(practiceSeed).slice(-4)}`:`#${puzzle}`,finalTimeline=sortChronologically([anchor,...played.map(r=>r.question)]);return <main><header className="topbar"><strong>Internet Timeline</strong><span>{practiceMode?"Practice":`#${puzzle}`}</span></header><section className="result-card"><ProfileBanner profile={profile} mode={mode}/><div className="result-heading"><div><p className="eyebrow">{practiceMode?"Practice result":replayMode?"Replay result":"Today’s result"}</p><h1>{score}<small>/5</small></h1></div><p className="verdict">{tone.short}</p></div><SharePoster label={label} played={played} streakCount={practiceMode?0:streakCount} shareUrl={shareUrl}/><div className="share-actions"><button className="primary" onClick={touch?()=>setShareState("shared"):copy}>{touch?(shareState==="shared"?"Shared":"Share result"):(shareState==="copied"?"Challenge copied":"Copy challenge")}</button><button className="secondary" onClick={()=>setShareState("saved")}>{shareState==="saved"?"Card saved":"Save poster"}</button></div><div className="result-secondary-actions"><a className="practice-button" href={`/?practice=${nextPractice}`}>Play another random timeline</a><a className="archive-button" href="/?archive=1">Past puzzles</a>{mode!=="daily"&&<a className="today-button" href="/">Today’s challenge</a>}{mode==="archive"&&<a className="replay-button" href={`/?puzzle=${puzzle}&replay=1`}>Replay #{puzzle}</a>}</div>{mode==="daily"&&<><div className="stats-grid"><div><strong>{Object.keys(history).length}</strong><span>Played</span></div><div><strong>{streakCount}</strong><span>Current streak</span></div><div><strong>{maxStreak}</strong><span>Best streak</span></div><div><strong>{Object.values(history).filter(x=>x.rounds.every(r=>r.correct)).length}</strong><span>Perfect days</span></div></div><div className="next-drop"><span>Next timeline in</span><strong>{formatCountdown(timer)}</strong></div></>}</section><section className="recap-card"><div className="recap-heading"><div><p className="eyebrow">Answer</p><h2>The full timeline</h2></div><span>{finalTimeline[0]?.answerYear}–{finalTimeline.at(-1)?.answerYear}</span></div><div className="recap-list">{finalTimeline.map(q=><article key={q.id} className="recap-row"><strong>{q.answerYear}</strong><div><span>{q.category}</span><p>{q.prompt}</p></div></article>)}</div></section></main>}
 return <main><header className="topbar"><strong>Internet Timeline</strong><span>{practiceMode?"Practice":`#${puzzle}`}</span></header><section className="game-shell"><ProfileBanner profile={profile} mode={mode}/><div className="game-meta"><span>{practiceMode?"Endless practice":replayMode?"Replay puzzle":"Place the moment"}</span><span>{roundIndex+1}/{GUESSES}</span></div><div className="challenge-card"><span className="category">{current?.category}</span><h1 className="question">{current?.prompt}</h1><p className="instruction">Tap the gap where this moment belongs.</p></div><div className="timeline-stack">{timeline.map((item,index)=><React.Fragment key={item.id}><button className={`slot ${selectedSlot===index?"selected":""} ${revealed&&correctIndex===index?"correct-slot":""}`} onClick={()=>!revealed&&setSelectedSlot(index)}><span>{revealed&&correctIndex===index?"Correct spot":selectedSlot===index?"Place here":"+"}</span></button><article className="event-card"><div><span className="event-year">{item.answerYear}</span><span className="event-category">{item.category}</span></div><p>{item.prompt}</p></article>{index===timeline.length-1&&<button className={`slot ${selectedSlot===timeline.length?"selected":""} ${revealed&&correctIndex===timeline.length?"correct-slot":""}`} onClick={()=>!revealed&&setSelectedSlot(timeline.length)}><span>{revealed&&correctIndex===timeline.length?"Correct spot":selectedSlot===timeline.length?"Place here":"+"}</span></button>}</React.Fragment>)}</div>{!revealed?<button className="primary" disabled={selectedSlot===null} onClick={lock}>Lock it in</button>:<div className={`reveal ${currentCorrect?"good":"miss"}`}><p>{currentCorrect?"Nailed it.":`It was ${current?.answerYear}.`}</p>{current?.explanation&&<small>{current.explanation}</small>}<button className="primary" onClick={next}>{roundIndex+1===GUESSES?"See result":"Next moment"}</button></div>}<div className="play-more-links"><a href="/?archive=1">Past puzzles</a>{!practiceMode&&<a href={`/?practice=${nextPractice}`}>Random practice</a>}{practiceMode&&<a href="/">Today’s challenge</a>}</div></section><footer>Built with DailyFoundry</footer></main>
}
ReactDOM.createRoot(document.getElementById("root")!).render(<React.StrictMode><InternetTimeline/><Analytics/></React.StrictMode>);