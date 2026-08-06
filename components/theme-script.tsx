// Script inline que fija el tema antes del primer paint (evita parpadeo).
export function ThemeScript() {
  const code = `(function(){try{var t=localStorage.getItem('theme');var d=t?t==='dark':window.matchMedia('(prefers-color-scheme: dark)').matches;var e=document.documentElement;if(d)e.classList.add('dark');e.classList.add('theme-ready');}catch(_){}})();`;
  return <script dangerouslySetInnerHTML={{ __html: code }} />;
}
