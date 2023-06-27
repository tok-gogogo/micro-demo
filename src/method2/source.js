import { fetchSource } from "../common/utils";

const ALL_SCRIPT_REGEX = /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi;
const SCRIPT_TAG_REGEX =
  /<(script)\s+((?!type=('|')text\/ng-template\3).)*?>.*?<\/\1>/is;
const SCRIPT_SRC_REGEX = /.*\ssrc=('|")?([^>'"\s]+)/;
const SCRIPT_ENTRY_REGEX = /.*\sentry\s*.*/;
const LINK_TAG_REGEX = /<(link)\s+.*?>/gi;
const LINK_IGNORE_REGEX = /.*ignore\s*.*/;
const LINK_PRELOAD_OR_PREFETCH_REGEX = /\srel=('|")?(preload|prefetch)\1/;
const LINK_HREF_REGEX = /.*\shref=('|")?([^>'"\s]+)/;
const STYLE_TAG_REGEX = /<style[^>]*>[\s\S]*?<\/style>/gi;
const STYLE_TYPE_REGEX = /\s+rel=('|")?stylesheet\1.*/;
const STYLE_HREF_REGEX = /.*\shref=('|")?([^>'"\s]+)/;
const STYLE_IGNORE_REGEX = /<style(\s+|\s+.+\s+)ignore(\s*|\s+.*)>/i;
const HTML_COMMENT_REGEX = /<!--([\s\S]*?)-->/g;
const SCRIPT_IGNORE_REGEX = /<script(\s+|\s+.+\s+)ignore(\s*|\s+.*)>/i;

export function getInlineCode(match) {
  const start = match.indexOf(">") + 1;
  const end = match.lastIndexOf("<");
  return match.substring(start, end);
}

function hasProtocol(url) {
  return (
    url.startsWith("//") ||
    url.startsWith("http://") ||
    url.startsWith("https://")
  );
}

function getEntirePath(path, baseURI) {
  return new URL(path, baseURI).toString();
}

export const genLinkReplaceSymbol = (linkHref) =>
  `<!-- link ${linkHref} replaced by Micro demo -->`;
export const genScriptReplaceSymbol = (scriptSrc) =>
  `<!-- script ${scriptSrc} replaced by Micro demo -->`;
export const inlineScriptReplaceSymbol = `<!-- inline scripts replaced by Micro demo -->`;
export const genIgnoreAssetReplaceSymbol = (url) =>
  `<!-- ignore asset ${url || "file"} replaced by Micro demo -->`;
export const script = (url) =>
  `<!-- ignore asset ${url || "file"} replaced by Micro demo -->`;
export const stylesIgnore = (url) =>
  `<!-- ignore style ${url || "css"} replaced by Micro demo -->`;
export function parse(tpl, baseURI) {
  let scripts = [];
  const styles = [];
  let entry = null;
  console.log(123);
  const template = tpl
    .replace(HTML_COMMENT_REGEX, "")
    .replace(LINK_TAG_REGEX, (match) => {
      const styleType = !!match.match(STYLE_TYPE_REGEX);
      if (styleType) {
        const styleHref = match.match(STYLE_HREF_REGEX);
        const styleIgnore = match.match(LINK_IGNORE_REGEX);

        if (styleHref) {
          const href = styleHref && styleHref[2];
          let newHref = href;
          if (href && !hasProtocol(href)) {
            newHref = getEntirePath(href, baseURI);
          }
          if (styleIgnore) {
            return genIgnoreAssetReplaceSymbol(newHref);
          }

          styles.push(newHref);
          return genLinkReplaceSymbol(newHref);
        }
      }

      const preloadOrPrefetchType = !!match.match(
        LINK_PRELOAD_OR_PREFETCH_REGEX
      );
      if (preloadOrPrefetchType) {
        const linkHref = match.match(LINK_HREF_REGEX);

        if (linkHref) {
          const href = linkHref[2];
          if (href && !hasProtocol(href)) {
            const newHref = getEntirePath(href, baseURI);
            return match.replace(href, newHref);
          }
        }
      }

      return match;
    })
    .replace(STYLE_TAG_REGEX, (match) => {
      if (STYLE_IGNORE_REGEX.test(match)) {
        return genIgnoreAssetReplaceSymbol("style file");
      }
      styles.push(match);
      return stylesIgnore(match);
    })
    .replace(ALL_SCRIPT_REGEX, (match) => {
      const scriptIgnore = match.match(SCRIPT_IGNORE_REGEX);
      if (SCRIPT_TAG_REGEX.test(match) && match.match(SCRIPT_SRC_REGEX)) {
        const matchedScriptEntry = match.match(SCRIPT_ENTRY_REGEX);
        const matchedScriptSrcMatch = match.match(SCRIPT_SRC_REGEX);
        let matchedScriptSrc =
          matchedScriptSrcMatch && matchedScriptSrcMatch[2];

        if (entry && matchedScriptEntry) {
          throw new SyntaxError("You should not set multiply entry script!");
        } else {
          if (matchedScriptSrc && !hasProtocol(matchedScriptSrc)) {
            matchedScriptSrc = getEntirePath(matchedScriptSrc, baseURI);
          }

          entry = entry || (matchedScriptEntry && matchedScriptSrc);
        }

        if (scriptIgnore) {
          return genIgnoreAssetReplaceSymbol(matchedScriptSrc || "js file");
        }

        if (matchedScriptSrc) {
          scripts.push(matchedScriptSrc);
          return genScriptReplaceSymbol(matchedScriptSrc);
        }

        return match;
      } else {
        if (scriptIgnore) {
          return genIgnoreAssetReplaceSymbol("js file");
        }
        const code = getInlineCode(match);
        const isPureCommentBlock = code
          .split(/[\r\n]+/)
          .every((line) => !line.trim() || line.trim().startsWith("//"));

        if (!isPureCommentBlock) {
          scripts.push(code);
        }

        return inlineScriptReplaceSymbol;
      }
    });

  scripts = scripts.filter((s) => !!s);

  return {
    template,
    scripts,
    styles,
    entry: entry || scripts[scripts.length - 1],
  };
}

export async function loadHtml(app) {
  let template = "",
    scripts,
    styles;
  if (app.scripts) {
    scripts = app.scripts || [];
    styles = app.styles || [];
  } else {
    const tpl = await fetchSource(app.url);
    let res = parse(tpl, "");
    console.log(res);
    scripts = res.scripts;
    styles = res.styles;
    template = res.template;
  }
  scripts = await Promise.all(
    scripts.map(async (s) =>
      hasProtocol(s)
        ? await fetchSource(s)
        : s.endsWith(".js") || s.endsWith(".jsx")
        ? await fetchSource(window.origin + s)
        : s
    )
  );
  styles = await Promise.all(
    styles.map(async (s) =>
      hasProtocol(s) || s.endsWith(".css") ? await fetchSource(s) : s
    )
  );

  console.log(styles, scripts, template);
  return { template, styles, scripts };
}
