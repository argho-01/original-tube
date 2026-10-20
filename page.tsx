 "use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { isConfigured, supabase } from "../lib/supabase";

type Video = {
  id: string; title: string; description: string | null; video_url: string;
  thumbnail_url: string | null; created_at: string; user_id: string; category: string | null;
  profiles?: { username: string | null; avatar_url: string | null } | null;
};
const categories = ["All", "Music", "Gaming", "Education", "Entertainment", "Shorts", "News", "Sports"];
const demo = [
  {title:"Discover the world, one video at a time",category:"Entertainment",emoji:"🌍",color:"sunset",creator:"Original Tube"},
  {title:"Music for your quiet moments",category:"Music",emoji:"🎧",color:"violet",creator:"OT Sounds"},
  {title:"Learn something new today",category:"Education",emoji:"📚",color:"green",creator:"OT Learn"},
  {title:"Gaming highlights & fun",category:"Gaming",emoji:"🎮",color:"blue",creator:"Pixel House"},
  {title:"A little daily inspiration",category:"Shorts",emoji:"✨",color:"pink",creator:"Good Day"},
  {title:"Food stories from the street",category:"Entertainment",emoji:"🍜",color:"gold",creator:"Taste Trail"}
];
export default function Home() {
  const [user,setUser] = useState<User|null>(null);
  const [videos,setVideos] = useState<Video[]>([]);
  const [category,setCategory] = useState("All");
  const [search,setSearch] = useState("");
  const [loading,setLoading] = useState(true);
  const [modal,setModal] = useState<"auth"|"upload"|null>(null);
  const [email,setEmail] = useState("");
  const [password,setPassword] = useState("");
  const [title,setTitle] = useState("");
  const [description,setDescription] = useState("");
  const [videoFile,setVideoFile] = useState<File|null>(null);
  const [thumbFile,setThumbFile] = useState<File|null>(null);
  const [uploading,setUploading] = useState(false);
  const [message,setMessage] = useState("");
  const [selected,setSelected] = useState<Video|null>(null);
  const [liked,setLiked] = useState<Set<string>>(new Set());
  const [comments,setComments] = useState<any[]>([]);
  const [commentText,setCommentText] = useState("");
  const [subscriptions,setSubscriptions] = useState<Set<string>>(new Set());
  const [myVideos,setMyVideos] = useState(false);

  const loadVideos = useCallback(async () => {
    if (!supabase) { setLoading(false); return; }
    const { data, error } = await supabase.from("videos")
      .select("id,title,description,video_url,thumbnail_url,created_at,user_id,category,profiles(username,avatar_url)")
      .eq("visibility","public").order("created_at",{ascending:false}).limit(60);
    if(error) setMessage(error.message); else setVideos((data as unknown as Video[]) || []);
    setLoading(false);
  },[]);
  useEffect(() => {
    if(!supabase) return;
    supabase.auth.getSession().then(({data})=>setUser(data.session?.user ?? null));
    const {data:{subscription}}=supabase.auth.onAuthStateChange((_event,session)=>setUser(session?.user??null));
    loadVideos();
    return ()=>subscription.unsubscribe();
  },[loadVideos]);
  useEffect(()=>{ if(selected && supabase) supabase.from("comments").select("id,body,created_at,user_id,profiles(username)").eq("video_id",selected.id).order("created_at",{ascending:false}).limit(50).then(({data})=>setComments(data||[])); },[selected]);
  const filtered = useMemo(()=>videos.filter(v=>(category==="All"||v.category===category)&&(!myVideos||v.user_id===user?.id)&&(`${v.title} ${v.description||""} ${v.profiles?.username||""}`).toLowerCase().includes(search.toLowerCase())),[videos,category,search,myVideos,user]);
  async function auth(e:React.FormEvent,mode:"signin"|"signup") {
    e.preventDefault(); if(!supabase)return;
    setMessage("");
    const result=mode==="signup"?await supabase.auth.signUp({email,password,options:{emailRedirectTo:typeof window!=="undefined"?window.location.origin:undefined}}):await supabase.auth.signInWithPassword({email,password});
    if(result.error) setMessage(result.error.message);
    else {setMessage(mode==="signup"?"Check your email to confirm your account.":"Signed in successfully."); if(mode==="signin")setModal(null);}
  }
  async function upload(e:React.FormEvent) {
    e.preventDefault(); if(!supabase||!user||!videoFile)return;
    if(videoFile.size>500*1024*1024){setMessage("For this starter, choose a video smaller than 500 MB.");return;}
    setUploading(true);setMessage("");
    try {
      const safe=(f:File)=>f.name.toLowerCase().replace(/[^a-z0-9._-]/g,"-");
      const path=`${user.id}/${crypto.randomUUID()}-${safe(videoFile)}`;
      const up=await supabase.storage.from("videos").upload(path,videoFile,{upsert:false,contentType:videoFile.type||"video/mp4"});
      if(up.error)throw up.error;
      const {data:publicData}=supabase.storage.from("videos").getPublicUrl(path);
      let thumbUrl:string|null=null;
      if(thumbFile){const tp=`${user.id}/${crypto.randomUUID()}-${safe(thumbFile)}`;const tr=await supabase.storage.from("thumbnails").upload(tp,thumbFile,{upsert:false,contentType:thumbFile.type||"image/jpeg"});if(tr.error)throw tr.error;thumbUrl=supabase.storage.from("thumbnails").getPublicUrl(tp).data.publicUrl;}
      const ins=await supabase.from("videos").insert({user_id:user.id,title:title.trim(),description:description.trim(),video_url:publicData.publicUrl,thumbnail_url:thumbUrl,category,visibility:"public"}).select().single();
      if(ins.error)throw ins.error;
      setMessage("Video published!");setModal(null);setTitle("");setDescription("");setVideoFile(null);setThumbFile(null);await loadVideos();
    }catch(err:any){setMessage(err.message||"Upload failed. Check Supabase setup and storage policies.");}
    finally{setUploading(false);}
  }
  async function toggleLike(v:Video) {
    if(!supabase||!user){setMessage("Sign in to like videos.");setModal("auth");return;}
    if(liked.has(v.id)){const {error}=await supabase.from("likes").delete().eq("video_id",v.id).eq("user_id",user.id);if(!error)setLiked(s=>{const n=new Set(s);n.delete(v.id);return n;});}
    else{const {error}=await supabase.from("likes").insert({video_id:v.id,user_id:user.id});if(!error)setLiked(s=>new Set(s).add(v.id));else setMessage(error.message);}
  }
  async function addComment(e:React.FormEvent){e.preventDefault();if(!supabase||!user||!selected){setMessage("Sign in to comment.");setModal("auth");return;}const {error}=await supabase.from("comments").insert({video_id:selected.id,user_id:user.id,body:commentText.trim()});if(error)setMessage(error.message);else{setCommentText("");const {data}=await supabase.from("comments").select("id,body,created_at,user_id,profiles(username)").eq("video_id",selected.id).order("created_at",{ascending:false}).limit(50);setComments(data||[]);}}
  async function toggleSub(v:Video){if(!supabase||!user){setModal("auth");return;}if(v.user_id===user.id)return;const has=subscriptions.has(v.user_id);const r=has?await supabase.from("subscriptions").delete().eq("subscriber_id",user.id).eq("channel_id",v.user_id):await supabase.from("subscriptions").insert({subscriber_id:user.id,channel_id:v.user_id});if(r.error)setMessage(r.error.message);else setSubscriptions(s=>{const n=new Set(s);has?n.delete(v.user_id):n.add(v.user_id);return n;});}
  if(!isConfigured) return <main className="setup"><div className="brand"><span className="brand-icon">▶</span> Original <b>Tube</b></div><div className="setup-card"><span className="eyebrow">YOUR VIDEO PLATFORM</span><h1>Your next big idea starts here.</h1><p>This is the real multi-user app starter. Connect a Supabase project to enable accounts, video uploads, comments, likes and shared video feeds.</p><ol><li>Create a Supabase project.</li><li>Run <code>supabase/schema.sql</code> in the SQL Editor.</li><li>Copy <code>.env.example</code> to <code>.env.local</code> and add your project URL and anon key.</li><li>Install dependencies and deploy to a hosting provider.</li></ol><p className="muted">Setup is required before online uploads or shared accounts work. Never put a service-role key in the browser.</p></div></main>;
  return <div className="app-shell">
    <header className="topbar"><a className="brand" href="#"><span className="brand-icon">▶</span><span>Original <b>Tube</b></span></a><form className="search" onSubmit={e=>e.preventDefault()}><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search videos..." aria-label="Search videos"/><button aria-label="Search">⌕</button></form><div className="top-actions">{user?<><button className="upload-btn" onClick={()=>setModal("upload")}>＋ <span>Upload</span></button><button className="user-chip" title={user.email||"Account"} onClick={async()=>{await supabase?.auth.signOut();setMessage("Signed out.");}}>◉</button></>:<button className="sign-btn" onClick={()=>setModal("auth")}>Sign in</button>}</div></header>
    <aside className="sidebar"><button className={!myVideos?"nav active":"nav"} onClick={()=>setMyVideos(false)}>⌂ <span>Home</span></button><button className="nav" onClick={()=>setCategory("Shorts")}>▣ <span>Shorts</span></button><button className="nav" onClick={()=>setMessage("Subscriptions feed: follow creators from a video page.")}>▤ <span>Subscriptions</span></button><div className="side-label">YOU</div><button className={myVideos?"nav active":"nav"} onClick={()=>{setMyVideos(true);setCategory("All");}}>▻ <span>Your videos</span></button><button className="nav" onClick={()=>setMessage("Watch history is not enabled in this starter yet.")}>◷ <span>History</span></button><div className="side-label">EXPLORE</div><button className="nav" onClick={()=>setCategory("All")}>↗ <span>Trending</span></button><button className="nav" onClick={()=>setCategory("Music")}>♫ <span>Music</span></button><button className="nav" onClick={()=>setCategory("Gaming")}>♧ <span>Gaming</span></button><div className="sidebar-note">A fresh place for original stories.</div></aside>
    <main className="main"><div className="welcome"><div><div className="eyebrow">WATCH · CREATE · SHARE</div><h1>Find your next <span>favorite.</span></h1><p>Fresh perspectives. Original voices. All in one place.</p></div><div className="welcome-mark">▶</div></div><div className="chips">{categories.map(c=><button key={c} className={category===c?"chip selected":"chip"} onClick={()=>setCategory(c)}>{c}</button>)}</div><div className="section-head"><h2>{myVideos?"Your videos":category==="All"?"Explore videos":category}</h2><span>{filtered.length} videos</span></div>{message&&<div className="message" role="status">{message}<button onClick={()=>setMessage("")}>×</button></div>}
    {loading?<div className="empty">Loading videos…</div>:filtered.length===0?<div className="empty"><div className="empty-icon">▷</div><h3>No videos here yet</h3><p>Try another search, or upload the first video to Original Tube.</p>{user&&<button className="sign-btn" onClick={()=>setModal("upload")}>Upload a video</button>}</div>:<div className="video-grid">{filtered.map((v,i)=><article key={v.id} className="video-card"><button className="thumbnail" onClick={()=>setSelected(v)} aria-label={`Play ${v.title}`}>{v.thumbnail_url?<img src={v.thumbnail_url} alt=""/>:<div className={`art art-${i%6}`}><span>{["◈","✦","⌘","◉","✧","◇"][i%6]}</span><small>ORIGINAL TUBE</small></div>}<span className="play">▶</span><span className="duration">▶ VIDEO</span></button><div className="video-info"><div className="avatar">{(v.profiles?.username||"O").slice(0,1).toUpperCase()}</div><div className="video-copy"><button className="video-title" onClick={()=>setSelected(v)}>{v.title}</button><div className="creator">{v.profiles?.username||"Original Tube creator"}</div><div className="meta">{new Date(v.created_at).toLocaleDateString()} · {v.category||"Video"}</div></div><button className="more" onClick={()=>setSelected(v)}>···</button></div></article>)}</div>}
    <footer>© {new Date().getFullYear()} Original Tube · Create something worth sharing.</footer></main>
    <nav className="mobile-nav"><button onClick={()=>{setMyVideos(false);setCategory("All")}}>⌂<small>Home</small></button><button onClick={()=>setCategory("Shorts")}>▣<small>Shorts</small></button><button onClick={()=>user?setModal("upload"):setModal("auth")}>⊕<small>Upload</small></button><button onClick={()=>setMessage("Subscriptions feed is coming soon.")}>▤<small>Subs</small></button><button onClick={()=>user?setMyVideos(true):setModal("auth")}>◉<small>You</small></button></nav>
    {modal&&<div className="overlay" onMouseDown={e=>{if(e.target===e.currentTarget)setModal(null)}}><section className="dialog"><button className="close" onClick={()=>setModal(null)}>×</button>{modal==="auth"?<><div className="brand dialog-brand"><span className="brand-icon">▶</span> Original <b>Tube</b></div><h2>Welcome to Original Tube</h2><p className="muted">Sign in or create an account to join the community.</p><form onSubmit={e=>auth(e,"signin")}><label>Email<input type="email" required value={email} onChange={e=>setEmail(e.target.value)} placeholder="you@example.com"/></label><label>Password<input type="password" minLength={6} required value={password} onChange={e=>setPassword(e.target.value)} placeholder="At least 6 characters"/></label><button className="sign-btn wide">Sign in</button><button type="button" className="text-btn" onClick={async e=>{e.preventDefault();if(!supabase)return;const {error}=await supabase.auth.signUp({email,password});setMessage(error?.message||"Check your email for account confirmation.");}}>Create new account</button></form></>:<><h2>Upload a video</h2><p className="muted">Share something original with the community.</p><form onSubmit={upload}><label>Video file<input type="file" accept="video/*" required onChange={e=>setVideoFile(e.target.files?.[0]||null)}/></label><label>Title<input required maxLength={120} value={title} onChange={e=>setTitle(e.target.value)} placeholder="Give your video a title"/></label><label>Description<textarea value={description} onChange={e=>setDescription(e.target.value)} placeholder="What is this video about?"/></label><label>Category<select value={category==="All"?"Entertainment":category} onChange={e=>setCategory(e.target.value)}>{categories.filter(c=>c!=="All").map(c=><option key={c}>{c}</option>)}</select></label><label>Thumbnail (optional)<input type="file" accept="image/*" onChange={e=>setThumbFile(e.target.files?.[0]||null)}/></label><button className="sign-btn wide" disabled={uploading}>{uploading?"Uploading…":"Publish video"}</button></form><p className="muted small">Large-video resumable uploads and moderation should be added before public launch.</p></>}</section></div>}
    {selected&&<div className="overlay" onMouseDown={e=>{if(e.target===e.currentTarget)setSelected(null)}}><section className="watch-dialog"><button className="close" onClick={()=>setSelected(null)}>×</button><video className="watch-video" src={selected.video_url} poster={selected.thumbnail_url||undefined} controls playsInline autoPlay/><h2>{selected.title}</h2><div className="watch-meta"><span>{selected.profiles?.username||"Original Tube creator"}</span><button className="sub-button" onClick={()=>toggleSub(selected)}>{subscriptions.has(selected.user_id)?"✓ Subscribed":"＋ Subscribe"}</button><button className="like-button" onClick={()=>toggleLike(selected)}>♡ Like</button></div><p>{selected.description}</p><h3>Comments</h3><form className="comment-form" onSubmit={addComment}><input value={commentText} onChange={e=>setCommentText(e.target.value)} placeholder="Add a comment…" required/><button className="sign-btn">Post</button></form><div className="comments">{comments.map(c=><div className="comment" key={c.id}><b>{c.profiles?.username||"User"}</b><p>{c.body}</p></div>)}{!comments.length&&<p className="muted">Be the first to comment.</p>}</div></section></div>}
  </div>;
}