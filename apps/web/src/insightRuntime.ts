import baseQuestions from"../../../games/internet-timeline/questions.json";
import extraQuestions from"../../../games/internet-timeline/questions-extra.json";
import funQuestions from"../../../games/internet-timeline/questions-fun.json";
import gameplayRoles from"../../../games/internet-timeline/gameplay-roles.json";
import"./insight.css";

type Question={id:string;prompt:string;answerYear:number;category:string};

const questions=[...baseQuestions,...extraQuestions,...funQuestions]as Question[];
const byPrompt=new Map(questions.map(q=>[normalize(q.prompt),q]));
const surpriseIds=new Set((gameplayRoles as {surprise:string[]}).surprise);

function normalize(s:string){return s.replace(/[“”"'’]/g,"").replace(/\s+/g," ").trim().toLowerCase()}
function gapLabel(years:number){return years===1?"1 year":`${years} years`}
function relation(a:Question,b:Question){const gap=Math.abs(a.answerYear-b.answerYear);if(!gap)return`${a.prompt} happened the same year as ${b.prompt}.`;const dir=a.answerYear<b.answerYear?"before":"after";return`${a.prompt} was ${gapLabel(gap)} ${dir} ${b.prompt}.`}
function nearest(q:Question,others:Question[]){return others.filter(x=>x.id!==q.id).sort((a,b)=>Math.abs(a.answerYear-q.answerYear)-Math.abs(b.answerYear-q.answerYear))[0]}
function questionFromCard(card:Element){const prompt=card.querySelector("p")?.textContent?.trim();const year=Number(card.querySelector(".event-year")?.textContent);if(!prompt||!Number.isFinite(year))return null;return byPrompt.get(normalize(prompt))??{id:`runtime-${year}-${normalize(prompt)}`,prompt,answerYear:year,category:""}}

function enhanceReveal(){
 const reveal=document.querySelector<HTMLElement>(".reveal");
 if(!reveal||reveal.dataset.insightDone==="1")return;
 const questionText=document.querySelector(".challenge-card .question")?.textContent?.trim();
 if(!questionText)return;
 const current=byPrompt.get(normalize(questionText));
 if(!current)return;
 const peers=[...document.querySelectorAll(".timeline-stack .event-card")].map(questionFromCard).filter(Boolean)as Question[];
 const peer=nearest(current,peers);
 if(!peer)return;
 const box=document.createElement("div");
 box.className="timeline-insight";
 box.innerHTML=`<strong>Timeline context:</strong> ${relation(current,peer)}`;
 const small=reveal.querySelector("small");
 if(small)small.insertAdjacentElement("afterend",box);else reveal.querySelector("p")?.insertAdjacentElement("afterend",box);
 reveal.dataset.insightDone="1";
}

function scoreShockCandidate(q:Question,peer:Question){
 const gap=Math.abs(q.answerYear-peer.answerYear);
 let score=0;
 if(surpriseIds.has(q.id))score+=100;
 if(gap<=2)score+=42;else if(gap<=5)score+=30;else if(gap<=10)score+=16;
 if(q.answerYear<2000&&peer.answerYear>=2000)score+=10;
 return score;
}

function enhanceResult(){
 const result=document.querySelector<HTMLElement>(".result-card");
 const recap=document.querySelector<HTMLElement>(".recap-card");
 if(!result||!recap||result.querySelector(".timeline-shock"))return;
 const rows=[...recap.querySelectorAll(".recap-row")];
 const items=rows.map(row=>{
  const year=Number(row.querySelector(":scope > strong")?.textContent);
  const prompt=row.querySelector("p")?.textContent?.trim();
  if(!prompt||!Number.isFinite(year))return null;
  return byPrompt.get(normalize(prompt))??{id:`runtime-${year}-${normalize(prompt)}`,prompt,answerYear:year,category:""};
 }).filter(Boolean)as Question[];
 if(items.length<2)return;
 let best:{q:Question;peer:Question;score:number}|null=null;
 for(const q of items){const peer=nearest(q,items);if(!peer)continue;const score=scoreShockCandidate(q,peer);if(!best||score>best.score)best={q,peer,score}}
 if(!best)return;
 const shock=document.createElement("div");
 shock.className="timeline-shock";
 shock.innerHTML=`<span>Today’s biggest timeline shock</span><strong>${relation(best.q,best.peer)}</strong><small>This is the kind of internet-time illusion the game is built around.</small>`;
 const heading=result.querySelector(".result-heading");
 heading?.insertAdjacentElement("afterend",shock);
}

function enhance(){enhanceReveal();enhanceResult()}
const observer=new MutationObserver(enhance);
observer.observe(document.body,{subtree:true,childList:true});
queueMicrotask(enhance);
