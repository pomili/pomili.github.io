import Swup from 'swup';
import HeadPlugin from '@swup/head-plugin';

const $ = <T extends Element = HTMLElement>(selector: string) => document.querySelector<T>(selector);
const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
const menu = $<HTMLElement>('#mobile-menu');
const menuButton = $<HTMLButtonElement>('.menu-toggle');
const backdrop = $<HTMLElement>('.mobile-backdrop');
const sidebar = $<HTMLElement>('#sidenav');
const sidebarButton = $<HTMLButtonElement>('.sidebar-toggle');
let previousFocus: HTMLElement | null = null;
let bodyOverflow = '';

function closeMenu(restoreFocus = false) {
  if (!document.body.classList.contains('menu-is-open')) return;
  document.body.classList.remove('menu-is-open');
  document.body.style.overflow = bodyOverflow;
  menu?.setAttribute('inert', '');
  menuButton?.setAttribute('aria-expanded', 'false');
  menuButton?.setAttribute('aria-label', '打开导航菜单');
  if (backdrop) backdrop.hidden = true;
  if (restoreFocus) previousFocus?.focus();
}
function openMenu() {
  if (!$<HTMLElement>('#loading-cover')?.hidden) return;
  previousFocus = document.activeElement as HTMLElement;
  bodyOverflow = document.body.style.overflow;
  document.body.style.overflow = 'hidden';
  document.body.classList.add('menu-is-open');
  menu?.removeAttribute('inert');
  menuButton?.setAttribute('aria-expanded', 'true');
  menuButton?.setAttribute('aria-label', '关闭导航菜单');
  if (backdrop) backdrop.hidden = false;
  menu?.querySelector<HTMLElement>('a')?.focus();
}
menuButton?.addEventListener('click', () => document.body.classList.contains('menu-is-open') ? closeMenu(true) : openMenu());
backdrop?.addEventListener('click', () => closeMenu(true));
menu?.addEventListener('click', (event) => { if ((event.target as Element).closest('a')) closeMenu(); });
window.matchMedia('(min-width: 768px)').addEventListener('change', (event) => { if (event.matches) closeMenu(); });
sidebarButton?.addEventListener('click', () => {
  const open = sidebar?.classList.toggle('is-expanded') || false;
  sidebarButton.setAttribute('aria-expanded', String(open));
  sidebarButton.setAttribute('aria-label', open ? '收起侧边导航' : '展开侧边导航');
});

const themeButton = $<HTMLButtonElement>('.theme-toggle');
const themeMedia = window.matchMedia('(prefers-color-scheme: dark)');
function syncTheme() { themeButton?.setAttribute('aria-pressed', String(document.documentElement.dataset.theme === 'dark')); }
themeButton?.addEventListener('click', () => {
  const theme = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
  document.documentElement.dataset.theme = theme;
  try { localStorage.setItem('pomili-theme', theme); } catch {}
  syncTheme();
});
themeMedia.addEventListener('change', (event) => {
  let preference;
  try { preference = localStorage.getItem('pomili-theme'); } catch {}
  if (preference !== 'light' && preference !== 'dark') {
    document.documentElement.dataset.theme = event.matches ? 'dark' : 'light';
    syncTheme();
  }
});
$('.top-button')?.addEventListener('click', () => window.scrollTo({ top: 0, behavior: reduced.matches ? 'instant' : 'smooth' }));

const drawer = $<HTMLElement>('#toc-drawer');
const tocButton = $<HTMLButtonElement>('.toc-toggle');
function closeToc(restoreFocus = false) {
  if (drawer) drawer.hidden = true;
  tocButton?.setAttribute('aria-expanded', 'false');
  if (restoreFocus) tocButton?.focus();
}
tocButton?.addEventListener('click', () => {
  if (!drawer) return;
  drawer.hidden = !drawer.hidden;
  tocButton.setAttribute('aria-expanded', String(!drawer.hidden));
  if (!drawer.hidden) drawer.querySelector<HTMLElement>('button')?.focus();
});
$('.toc-close')?.addEventListener('click', () => closeToc(true));
$('.toc-links')?.addEventListener('click', (event) => { if ((event.target as Element).closest('a')) closeToc(); });
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') { closeMenu(true); if (drawer && !drawer.hidden) closeToc(true); }
  if (event.key !== 'Tab' || !document.body.classList.contains('menu-is-open')) return;
  const nodes = [menuButton, ...Array.from(menu?.querySelectorAll<HTMLElement>('a') || [])].filter(Boolean) as HTMLElement[];
  const first = nodes[0], last = nodes[nodes.length - 1];
  if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
  else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
});

let pageController: AbortController | null = null;
let tocObserver: IntersectionObserver | null = null;
let scrollFrame = 0;
function cleanupPage() {
  pageController?.abort();
  tocObserver?.disconnect();
  cancelAnimationFrame(scrollFrame);
  closeMenu(); closeToc();
}
function setupPage() {
  cleanupPage();
  pageController = new AbortController();
  const signal = pageController.signal;
  const home = $('#swup-main')?.getAttribute('data-home') === 'true';
  document.body.classList.toggle('is-home', home);
  const base = import.meta.env.BASE_URL.replace(/\/$/, '');
  const current = location.pathname.slice(base.length).replace(/^\//, '');
  document.querySelectorAll<HTMLAnchorElement>('[data-nav]').forEach((link) => {
    const target = link.dataset.nav || '';
    const active = !target ? current === '' : target === 'posts/' ? /^(posts|blog)\//.test(current) : target === 'aboutme/' ? /^(aboutme|about)\//.test(current) : current.startsWith(target);
    if (active) link.setAttribute('aria-current', 'page'); else link.removeAttribute('aria-current');
  });
  syncTheme();
  const toc = $<HTMLTemplateElement>('#page-toc');
  const tocLinks = $('.toc-links');
  tocLinks?.replaceChildren(toc?.content.cloneNode(true) || document.createDocumentFragment());
  const anchors = Array.from(tocLinks?.querySelectorAll<HTMLAnchorElement>('a') || []);
  if (tocButton) tocButton.hidden = anchors.length === 0;
  if (anchors.length) {
    tocObserver = new IntersectionObserver((entries) => {
      const visible = entries.find((entry) => entry.isIntersecting);
      if (!visible) return;
      anchors.forEach((a) => a.classList.toggle('is-active', decodeURIComponent(a.hash.slice(1)) === visible.target.id));
    }, { rootMargin: '-5% 0px -65% 0px' });
    anchors.forEach((a) => { const heading = document.getElementById(decodeURIComponent(a.hash.slice(1))); if (heading) tocObserver?.observe(heading); });
  }
  const updateScroll = () => {
    const total = document.documentElement.scrollHeight - innerHeight;
    const percent = Math.min(100, Math.max(0, total > 0 ? Math.round(scrollY / total * 100) : 0));
    const el = $('.scroll-percent'); if (el) el.textContent = `${percent}%`;
  };
  window.addEventListener('scroll', () => {
    cancelAnimationFrame(scrollFrame);
    scrollFrame = requestAnimationFrame(() => {
      updateScroll();
      history.replaceState({ ...history.state, pomiliScroll: [scrollX, scrollY] }, '');
    });
  }, { passive: true, signal });
  updateScroll();
  setupSearch(signal);
}

type SearchEntry = { title: string; description: string; tags: string[]; url: string; body: string };
const searchCache = new Map<string, SearchEntry[]>();
function setupSearch(signal: AbortSignal) {
  const container = $<HTMLElement>('[data-search]');
  const input = $<HTMLInputElement>('[data-search-input]');
  const results = $('[data-search-results]');
  const status = $('[data-search-status]');
  if (!container || !input || !results || !status) return;
  const url = container.dataset.indexUrl!;
  input.value = typeof history.state?.pomiliSearch === 'string' ? history.state.pomiliSearch : '';
  let queryVersion = 0;
  const search = async () => {
    const version = ++queryVersion;
    const query = input.value.trim().toLocaleLowerCase();
    history.replaceState({ ...history.state, pomiliSearch: input.value }, '');
    results.replaceChildren();
    if (!query) { status.textContent = '输入关键词，搜索文章标题、标签与正文。'; return; }
    status.textContent = '正在检索…';
    try {
      let entries = searchCache.get(url);
      if (!entries) {
        const response = await fetch(url, { signal });
        if (!response.ok) throw new Error('Index unavailable');
        entries = await response.json() as SearchEntry[]; searchCache.set(url, entries);
      }
      if (signal.aborted || version !== queryVersion) return;
      const terms = query.split(/\s+/);
      const matches = entries.filter((entry) => terms.every((term) => `${entry.title} ${entry.description} ${entry.tags.join(' ')} ${entry.body}`.toLocaleLowerCase().includes(term)));
      status.textContent = matches.length ? `找到 ${matches.length} 篇文章` : '没有找到相关文章，试试其他关键词。';
      matches.forEach((entry) => {
        const li = document.createElement('li'); li.className = 'search-result';
        const a = document.createElement('a'); a.href = entry.url;
        const h = document.createElement('h2'); h.textContent = entry.title;
        const p = document.createElement('p'); p.textContent = entry.description;
        a.append(h, p); li.append(a); results.append(li);
      });
    } catch (error) {
      if (!signal.aborted && version === queryVersion) status.textContent = '索引加载失败，请稍后重试。';
    }
  };
  input.addEventListener('input', search, { signal });
  container.querySelector('form')?.addEventListener('submit', (event) => { event.preventDefault(); search(); }, { signal });
  search();
}

function startLoader() {
  const cover = $<HTMLElement>('#loading-cover');
  if (!cover || reduced.matches) return;
  const fill = $<HTMLElement>('.loading-fill');
  const info = $<HTMLElement>('.loading-info');
  const percent = $('.loading-percent');
  const status = $('.loading-status');
  cover.hidden = false;
  const oldOverflow = document.body.style.overflow;
  document.body.style.overflow = 'hidden';
  const images = Array.from(document.images);
  let loaded = images.filter((image) => image.complete).length;
  let pageLoaded = document.readyState === 'complete';
  let displayed = 0;
  let finished = false;
  const controller = new AbortController();
  const completeImage = () => { loaded++; };
  images.filter((image) => !image.complete).forEach((image) => {
    const done = () => { image.removeEventListener('load', done); image.removeEventListener('error', done); completeImage(); };
    image.addEventListener('load', done, { signal: controller.signal }); image.addEventListener('error', done, { signal: controller.signal });
  });
  window.addEventListener('load', () => { pageLoaded = true; }, { once: true, signal: controller.signal });
  const initTimer = window.setTimeout(() => { if (status) status.textContent = 'LOADING'; }, 100);
  const release = () => {
    cover.hidden = true;
    if (!document.body.classList.contains('menu-is-open')) document.body.style.overflow = oldOverflow;
    controller.abort(); cancelAnimationFrame(frame); clearTimeout(hardStop); clearTimeout(initTimer);
  };
  const exit = () => {
    if (finished) return; finished = true;
    if (status) status.textContent = 'READY';
    setTimeout(() => { cover.classList.add('is-sweeping'); if (status) status.textContent = 'LAUNCHING'; setTimeout(() => { cover.classList.add('is-fading'); if (status) status.textContent = 'WELCOME'; setTimeout(release, 300); }, 400); }, 100);
  };
  let frame = 0;
  const tick = () => {
    const target = pageLoaded ? 100 : Math.min(90, loaded / Math.max(1, images.length) * 100);
    displayed = Math.min(target, displayed + Math.max(.5, (target - displayed) * .15));
    const value = Math.floor(displayed);
    if (percent) percent.textContent = `${value}%`;
    const mobile = matchMedia('(max-width: 768px)').matches;
    if (fill) { fill.style.width = mobile ? `${value}%` : '100%'; fill.style.height = mobile ? '100%' : `${value}%`; }
    if (info) { info.style.top = mobile ? '-22px' : `${Math.min(97, Math.max(3, value))}%`; info.style.left = mobile ? `${value}%` : '24px'; }
    if (value >= 100) exit(); else frame = requestAnimationFrame(tick);
  };
  const hardStop = window.setTimeout(release, 5000);
  frame = requestAnimationFrame(tick);
}

setupPage();
startLoader();
const swup = new Swup({ containers: ['#swup-main'], plugins: [new HeadPlugin()], cache: false, animateHistoryBrowsing: true });
swup.hooks.before('content:replace', cleanupPage);
swup.hooks.on('history:popstate', (visit) => { visit.scroll.reset = false; });
swup.hooks.on('animation:out:start', () => { const spinner = $<HTMLElement>('.page-spinner'); if (spinner) spinner.hidden = reduced.matches; closeMenu(); closeToc(); });
swup.hooks.on('page:view', (visit) => {
  setupPage();
  if (visit.history.popstate) {
    const position = history.state?.pomiliScroll || [0, 0];
    if (Array.isArray(position) && position.length === 2) window.scrollTo({ left: position[0], top: position[1], behavior: 'instant' });
  }
  if (!location.hash) $('#main')?.focus({ preventScroll: true });
});
swup.hooks.on('animation:in:end', () => { const spinner = $<HTMLElement>('.page-spinner'); if (spinner) spinner.hidden = true; });
swup.hooks.on('fetch:error', () => { const spinner = $<HTMLElement>('.page-spinner'); if (spinner) spinner.hidden = true; });
