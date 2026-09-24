# Being findable

The site went live and returned nothing for `decisionfc`, `decision fc` or
`football career game`. This is what was wrong, what was fixed in the code, and
the four things that can only be done from my own accounts.

Read §3 first if you are short of time. The code was genuinely broken and is now
genuinely fixed, but **on-page work does not put a new domain in an index** —
submitting it does, and that needs a login.

---

## 1. What was actually wrong

Three things, and the first two were bad enough on their own.

**`/robots.txt` and `/sitemap.xml` returned the app's HTML, with HTTP 200.** The
Cloudflare worker serves `index.html` for any path it does not recognise, which
is right for a single-page app and wrong for these two files. A crawler asking
for a robots file and receiving a web page is being told, in the only language
it has, that this domain does not know what it is doing. Both are now real files
in `apps/web/public/`, which the worker serves before it reaches the fallback.

**The page had no content.** `<div id="root"></div>` and nothing else. Google
does execute JavaScript, but rendering is queued separately from crawling and
can lag it by days or weeks, and a domain with no inbound links has no authority
to spend on being waited for. Everything a crawler saw was a title and one meta
description.

**Nothing said what the game was.** No canonical, no structured data, no
Open Graph URL, a relative `og:image` pointing at a square app icon, no Twitter
card, and no Chinese page at all — so a search in Chinese had nothing to match
against, because the Chinese words only existed inside a JavaScript bundle.

## 2. What the code does now

| | |
|---|---|
| `robots.txt` | A real file. Allows everything worth crawling, names the Chinese engines individually, and explicitly welcomes assistant crawlers — see §4 |
| `sitemap.xml` | A real file, all four URLs, with `hreflang` pairs — every one of them the **slashed** form, which is what Cloudflare answers 200 for. Publishing the unslashed form pointed every canonical and every `hreflang` at a 307, and `tools/seo.mjs` now fails the build if that comes back |
| `llms.txt` | Written for assistants rather than for people: what the game is, what is in it, and the phrases someone would actually use to ask for it |
| The boot screen | `#root` now contains a real heading, a lede and five lines about the game, styled inline so it is never unstyled text. React replaces it on mount, so it is also the splash a player sees for the first few hundred milliseconds — it was a blank screen before |
| `/zh` | A **real prerendered page**, built by `apps/web/scripts/prerender.mjs`, with its own title, description and visible Chinese copy. Landing on it opens the game in Chinese, and switching language moves the URL |
| Head tags | Absolute canonical, `og:url`, `og:image`, `og:locale`, Twitter large card, `hreflang` for `en` / `zh-Hans` / `x-default` |
| Structured data | `VideoGame` JSON-LD naming the platform, the languages, the genre and the price (free) |
| `og-card.png` | A drawn 1200×630 card, rebuilt with `node tools/og-card.mjs`. The old `og:image` was the 512×512 app icon, which every social surface crops badly |
| `/football-career-games` and its Chinese twin | Real static comparison pages — see §5. Built from `apps/web/scripts/pages/*.json` |

`pnpm seo` checks all of it against a built preview (`pnpm preview`) — including the
two that are easy to break by accident: the page must be readable with
JavaScript off, and React must still replace that content when JavaScript runs.

## 3. What only I can do — and it is the part that matters

None of the above tells Google the site exists. These do. In rough order of
impact:

### 3.1 Google Search Console — do this first

1. <https://search.google.com/search-console> → **Add property** → **Domain** →
   `decisionfc.com`.
2. It will ask for a **DNS TXT record**. Add it in Cloudflare → the domain →
   **DNS** → **Add record** → type `TXT`, name `@`, content the string Google
   gives. Verification usually takes a few minutes.
3. **Sitemaps** → enter `sitemap.xml` → Submit.
4. **URL Inspection** → paste `https://decisionfc.com/` → **Request indexing**.
   Repeat for `https://decisionfc.com/zh/`,
   `https://decisionfc.com/football-career-games/` and
   `https://decisionfc.com/zh/football-career-games/`.

Step 4 is the one that turns weeks into days. Do it once per URL; asking
repeatedly does not help.

**Use the trailing slash.** Cloudflare answers `/zh` with a 307 to `/zh/`, and
every URL the site publishes about itself — canonical, `hreflang`, sitemap,
internal links — now says the slashed form. Submitting the other one asks Google
to index a redirect.

Google and Bing are verified by DNS and need nothing in the code.

Nothing here is optional and nothing in the repository substitutes for it. As of
the last check the site returned no result for `decisionfc`, which is not a
ranking problem: **a domain nobody has told Google about is not in the index at
all**, and on-page work cannot put it there.

### 3.2 Bing Webmaster Tools

<https://www.bing.com/webmasters> → add the site → it can **import directly from
Google Search Console**, which is the fastest route → submit the sitemap.

Worth doing beyond Bing's own traffic: ChatGPT's browsing and several other
assistants resolve web results through Bing's index, so being in it is part of
being recommendable.

**IndexNow is the part that actually asks.** A sitemap is a list Bing reads when
it feels like it; IndexNow is a request that says "these URLs changed, come and
look", and it reaches Bing, Yandex, Seznam and Naver from one call:

```bash
node tools/indexnow.mjs --dry-run
node tools/indexnow.mjs
```

There is no token. IndexNow proves the host is yours by fetching the key back
off it — `https://decisionfc.com/16d433424c2512042df54c4e2843135e.txt` has to
answer with that same string — so the key is published on purpose and lives in
`apps/web/public/`. That is the opposite of the Baidu token in §3.3, and the
distinction is worth keeping straight. `pnpm seo` fails if the file stops being
served, because a missing key turns every later submission into a silent 403.

**The deploy already does this.** `deploy-cloudflare.yml` runs the tool after a
successful deploy to main, as a step that is not allowed to fail the release.
Run it by hand only for a URL that changed without a deploy, or to prove the key
is working. Pushing an unchanged URL on a schedule is how a host teaches an
engine to ignore it.

### 3.3 Baidu — the one that needs the most patience

<https://ziyuan.baidu.com/> (a Baidu account is required; a mainland phone
number is usually required to register).

1. 站点管理 → 添加网站 → `decisionfc.com`. **Ownership is already verified in
   the code**: the HTML-tag method, `<meta name="baidu-site-verification"
   content="codeva-T9GPpE8fxa" />`, is in `apps/web/index.html` and inherited by
   `/zh`. Deploy, then press 完成验证. `tools/seo.mjs` holds the tag in place,
   because Baidu re-checks it and un-verifies the site if it disappears.
2. 链接提交 → submit `https://decisionfc.com/sitemap.xml`.
3. **普通收录 → 推送接口** is the channel that actually asks Baidu to come and
   look, and there is a tool for it:

   ```bash
   BAIDU_PUSH_TOKEN=<准入密钥> node tools/baidu-push.mjs --dry-run
   BAIDU_PUSH_TOKEN=<准入密钥> node tools/baidu-push.mjs
   ```

   It takes its URL list from `apps/web/public/sitemap.xml`, so there is one list
   rather than two that drift, and it refuses to submit anything that would
   redirect — Baidu's own instruction is 「若链接存在跳转关系，请直接提交跳转后
   链接」, and the daily quota does not roll over. The token is a credential:
   it lives in the environment, never in the repository, and can be rotated in
   the console if it leaks. Baidu's own caveat is worth repeating: 「不保证收录和
   展现效果」 — pushing is how the crawler learns the URL exists, not a promise
   that it indexes it.

   Re-run it when a URL is genuinely new. Pushing an unchanged URL again does
   nothing except spend quota.

Two honest warnings. Baidu indexes sites hosted outside mainland China slowly
and reluctantly, and it will be slower still without an ICP filing (备案), which
Cloudflare hosting cannot have. Expect weeks, and expect Bing and Google to
carry the Chinese traffic first. If Chinese search becomes commercially
important, the real answer is a mainland-hosted mirror with an ICP number, which
is a business decision rather than a code change.

### 3.4 The first few links

A domain with zero inbound links is a domain search engines have no reason to
visit. Anything genuine helps, and these cost nothing:

- Post it on **itch.io** as a browser game — free, indexed fast, and the exact
  audience.
- **r/WebGames**, **r/incremental_games**, **r/FootballManagerGames** (read each
  one's self-promotion rules first).
- **Product Hunt**, once, on a day you can answer comments.
- **少数派 / 豆瓣小组 / 贴吧** for the Chinese side, linking `/zh` directly.
- A **Bilibili or YouTube clip** of one career, five minutes, with the link in
  the description.

One real link from a site people already visit is worth more than every meta tag
on this page.

### 3.5 `www.decisionfc.com` does not resolve

Checked on 2026-08-05: the apex serves the site, and **`www` has no DNS record
at all** — a browser typing it gets a connection failure, not a redirect. The
apex is attached through the Cloudflare dashboard rather than a `routes` block
in `wrangler.jsonc`, and the `www` hostname was never added alongside it.

Not the reason the site is not indexed — nothing published by this site ever
names the `www` form, so no crawler is being sent there. It is worth fixing
anyway, because people type it, other people link it, and a dead hostname on the
brand is the kind of thing that reads as an abandoned site.

Cloudflare → the domain → **DNS** → add a `CNAME` for `www` pointing at
`decisionfc.com`, proxied; then **Rules → Redirect Rules** → redirect
`www.decisionfc.com/*` to `https://decisionfc.com/$1` with a **301**. A redirect
rather than a second copy of the site: two hostnames serving identical pages is
a duplicate-content problem, and a 301 hands every signal to the apex, which is
the hostname every canonical on this site already names.

## 4. Being recommended by assistants

A newer discovery path, and one this site is unusually well placed for: someone
asks an assistant for "a football career game I can play in five minutes" and it
answers with a name.

Two things make that possible, and both are done:

- **`robots.txt` allows the assistant crawlers** — GPTBot, ClaudeBot,
  PerplexityBot, Google-Extended, Applebot and the rest. Most sites now block
  these. A free browser game with nothing to sell has everything to gain from
  being readable and nothing to lose.
- **`llms.txt` is written for them.** Plain prose, no marketing, and a section
  listing the phrases people actually use when they are looking for this kind of
  thing in both languages — because that is what a retrieval query looks like.

What it cannot do is invent a reputation. Assistants surface what the web
already says about a thing, so §3.4 feeds this as much as it feeds Google.

## 5. Ranking for FIFA, EA FC, Football Manager and PES

This deserves a straight answer rather than a hedge.

**The head terms are not winnable, and nothing in this repository will change
that.** `FIFA`, `EA FC`, `Football Manager`, `PES`, `足球经理` on their own are
owned by EA, Sega, Konami, Wikipedia and Steam, with two decades of authority
and millions of links each. A new domain does not enter those results, and any
approach that claims otherwise is either lying or is a technique that gets a
site penalised.

**The comparison queries are winnable, and they are where the person who would
actually enjoy this game is searching.** "football manager alternative free",
"games like FIFA career mode but shorter", "free football career game no
download", "类似FM的手机游戏", "免费足球生涯游戏", "不用下载的足球游戏". Real
volume, weak competition, and — the part that matters — an honest answer exists.

So `/football-career-games` and `/zh/football-career-games` are real pages that
compare this game to those four, including the parts where the answer is "go and
play the other one". That is the ethical version and, not coincidentally, the
version that ranks: a page built only to catch traffic is a doorway page, and
Google demotes those deliberately. Both pages are static HTML that need no
JavaScript, carry `FAQPage` structured data, and link back to the game.

The same text is the strongest lever for §4. An assistant answering "what is a
game like Football Manager but shorter" is doing retrieval over exactly this
kind of prose, and it will quote a fair comparison far more readily than a sales
page.

Where to go next, in order of return:

1. **More comparison pages, one query each.** "Best free football games in the
   browser", "football games you can play at work", "球员生涯 模拟 游戏 推荐".
   One page per genuine question, written to answer it.
2. **A page per league.** "Play a career in the Premier League / La Liga /
   Championship" — the club list is already in the content pack, so these can be
   generated rather than written.
3. **Never** a page that exists only to repeat a keyword. The generator in
   `apps/web/scripts/build-pages.mjs` says the same thing at more length.

## 6. What to expect, honestly

- **`decisionfc` / `decision fc`** — a brand-new coined term with no competition.
  Once indexed, the site should be the first result. Days, after §3.1.
- **`足球生涯` / `football career game`** — competitive terms with established
  sites. On-page work makes the site *eligible*; links and time decide where it
  lands. Months, not days, and §3.4 is the lever.
- **Anything before the site is indexed at all** — nothing. That is the state it
  was in, and it was a code bug rather than a ranking problem.

- **`football manager alternative` and its neighbours** — the comparison pages
  are eligible from the day they are indexed, and can place on page one for the
  narrower phrasings within a couple of months if §3.4 happens.

Check progress in Search Console under **Pages**, or by searching
`site:decisionfc.com`. An empty result means not yet indexed; it does not mean
the work is wrong.

## 7. Reading what the two consoles actually say

Both tools report in a register that makes a normal state look like a fault.
These are the two messages this site produced on **2026-08-05**, a week after
the domain went up, and what each one means.

**Bing — «Discovered but not crawled. URL cannot appear on Bing».** Bing has the
URL and has not yet spent a crawl on it. It is a queue position, not a verdict:
crawl budget goes to hosts with a history and inbound links, and this domain has
neither yet. The second sentence is literally true and reads like a rejection —
a page Bing has not fetched cannot be in its results. Nothing on the page causes
this and nothing on the page fixes it. What moves it: IndexNow (§3.2), the
sitemap submitted in Bing's own console, and links (§3.4).

**Google — «URL is available to Google. Page can be indexed. Crawl allowed:
Yes. Page fetch: Successful. Indexing allowed: Yes».** This is the *good*
result, and it is the live test rather than the index — Google fetched the page
during the inspection and found nothing wrong with it. The giveaway that the
page is not yet indexed is one line further down: **«Google-selected canonical:
Only determined after indexing»**. If the page were in the index, the panel
would say "URL is on Google" instead.

So on that date: no technical blocker in either engine, the page crawlable and
indexable by Google's own verdict, and the site simply not indexed yet. The
honest summary of a one-week-old domain with zero backlinks. **Request indexing
once per URL** (§3.1), **push through IndexNow** (§3.2), and then the lever is
§3.4 and patience — not another pass over the meta tags.

One thing that is worth re-checking rather than assumed: `site:decisionfc.com`
returning nothing means *not indexed*, which is the same answer for "brand new"
and for "removed". If it ever goes from returning pages to returning none, that
is a real incident — check Search Console → **Pages** for an exclusion reason
and `curl -I https://decisionfc.com/` for a header the deploy should not have
shipped.

## 8. Indexed on 2026-08-06, and what a brand query still needs

Three days after §3's submissions, `decision fc game` returns **two results from
this domain** — the home page and `/football-career-games/` — with the home page
first. That is the whole of §1 and §2 doing their job: the pages were crawled,
the title and description are the ones written here, and two different URLs both
earned a place. Two results from one host on one query is not duplication; it is
Google finding two pages that each answer the query, and it caps at two per host
unless a site has earned more.

**`decision fc` and `decisionfc` still return nothing, and that is a different
problem from the one §1 fixed.** A query naming the game is answered by matching
*content*: the title says "football career game", the description says "free
football career simulator", and the query says `game`. A query that is only the
brand asks a different question — *what is Decision FC* — and Google answers it
from an **entity**, not from a page. The entity does not exist yet: nothing off
this domain has ever used the name, so there is no evidence that the two words
are a proper noun rather than two ordinary ones. And as ordinary words they are
crowded: "decision" + "FC" currently returns FC Cincinnati match reports, MLS
Decision Day, and a handful of consultancies called Decision-something.

Nothing on the page fixes that, and adding more markup about ourselves does not
either — an entity is built from what *other* sites say. §3.4 is the whole
lever: one itch.io listing, one Reddit post, one Bilibili description with the
name and the URL in it. Expect the brand query to resolve within a week or two
of the first few mentions, and to resolve to first place when it does, because
nobody else is competing for a coined name.

Worth keeping straight, because the two look alike from the outside and have
opposite fixes:

| Symptom | What it means | What fixes it |
|---|---|---|
| No result for anything, `site:` empty | Not in the index | §3.1 submission, then time |
| Ranks for descriptive queries, not for the brand | Indexed; no entity yet | §3.4 off-site mentions |
| Ranks for the brand, not for competitive terms | Entity exists; no authority | §3.4 and §5, months |
