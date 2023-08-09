import {
  CompletionPath,
  getLinkFileDir,
  logError,
  trim,
} from "../common/utils";

// common reg
const rootSelectorREG = /(^|\s+)(html|:root)(?=[\s>~[.#:]+|$)/;
const bodySelectorREG = /(^|\s+)((html[\s>~]+body)|body)(?=[\s>~[.#:]+|$)/;

function parseError(msg, linkPath) {
  msg = linkPath ? `${linkPath} ${msg}` : msg;
  const err = new Error(msg);
  err.reason = msg;
  if (linkPath) {
    err.filename = linkPath;
  }
  throw err;
}

/**
 * Reference https://github.com/reworkcss/css
 * CSSParser mainly deals with 3 scenes: styleRule, @, and comment
 * And scopecss deals with 2 scenes: selector & url
 * And can also disable scopecss with inline comments
 */
class CSSParser {
  constructor() {
    this.cssText = ""; // css content
    this.prefix = ""; // prefix as micro-app[name=xxx]
    this.baseURI = ""; // domain name
    this.linkPath = ""; // link resource address, if it is the style converted from link, it will have linkPath
    this.result = ""; // parsed cssText
    this.scopecssDisable = false; // use block comments /* scopecss-disable */ to disable scopecss in your file, and use /* scopecss-enable */ to enable scopecss
    this.scopecssDisableSelectors = []; // disable or enable scopecss for specific selectors
    this.scopecssDisableNextLine = false; // use block comments /* scopecss-disable-next-line */ to disable scopecss on a specific line
    // https://developer.mozilla.org/en-US/docs/Web/API/CSSMediaRule
    this.mediaRule = this.createMatcherForRuleWithChildRule(
      /^@media *([^{]+)/,
      "@media"
    );
  }

  exec(cssText, prefix, baseURI, linkPath) {
    this.cssText = cssText;
    this.prefix = prefix;
    this.baseURI = baseURI;
    this.linkPath = linkPath || "";
    this.matchRules();
    return this.result;
  }

  reset() {
    this.cssText =
      this.prefix =
      this.baseURI =
      this.linkPath =
      this.result =
        "";
    this.scopecssDisable = this.scopecssDisableNextLine = false;
    this.scopecssDisableSelectors = [];
  }

  // core action for match rules
  matchRules() {
    this.matchLeadingSpaces();
    this.matchComments();
    while (
      this.cssText.length &&
      this.cssText.charAt(0) !== "}" &&
      (this.matchAtRule() || this.matchStyleRule())
    ) {
      this.matchComments();
    }
  }
  // https://developer.mozilla.org/en-US/docs/Web/API/CSSStyleRule
  matchStyleRule() {
    const selectors = this.formatSelector(true);

    // reset scopecssDisableNextLine
    this.scopecssDisableNextLine = false;

    if (!selectors) {
      return parseError("selector missing", this.linkPath);
    }

    this.recordResult(selectors);

    this.matchComments();

    this.styleDeclarations();

    this.matchLeadingSpaces();

    return true;
  }

  formatSelector(skip) {
    const m = this.commonMatch(/^[^{]+/, skip);
    if (!m) return false;

    return m[0].replace(/(^|,[\n\s]*)([^,]+)/g, (_, separator, selector) => {
      selector = trim(selector);
      if (
        !(
          this.scopecssDisableNextLine ||
          (this.scopecssDisable &&
            (!this.scopecssDisableSelectors.length ||
              this.scopecssDisableSelectors.includes(selector))) ||
          rootSelectorREG.test(selector)
        )
      ) {
        if (bodySelectorREG.test(selector)) {
          selector = selector.replace(
            bodySelectorREG,
            this.prefix + " micro-app-body"
          );
        } else {
          selector = this.prefix + " " + selector;
        }
      }

      return separator + selector;
    });
  }

  // https://developer.mozilla.org/en-US/docs/Web/API/CSSStyleDeclaration
  styleDeclarations() {
    if (!this.matchOpenBrace()) {
      return parseError("Declaration missing '{'", this.linkPath);
    }

    this.matchAllDeclarations();

    if (!this.matchCloseBrace()) {
      return parseError("Declaration missing '}'", this.linkPath);
    }

    return true;
  }

  matchAllDeclarations() {
    let cssValue = this.commonMatch(
      /^(?:url\(["']?(?:[^)"'}]+)["']?\)|[^}/])*/,
      true
    )[0];

    if (cssValue) {
      if (
        !this.scopecssDisableNextLine &&
        (!this.scopecssDisable || this.scopecssDisableSelectors.length)
      ) {
        cssValue = cssValue.replace(
          /url\(["']?([^)"']+)["']?\)/gm,
          (all, $1) => {
            if (/^((data|blob):|#)/.test($1) || /^(https?:)?\/\//.test($1)) {
              return all;
            }

            // ./a/b.png  ../a/b.png  a/b.png
            if (/^((\.\.?\/)|[^/])/.test($1) && this.linkPath) {
              this.baseURI = getLinkFileDir(this.linkPath);
            }

            return `url("${CompletionPath($1, this.baseURI)}")`;
          }
        );
      }

      this.recordResult(cssValue);
    }

    // reset scopecssDisableNextLine
    this.scopecssDisableNextLine = false;

    if (!this.cssText || this.cssText.charAt(0) === "}") return;

    // extract comments in declarations
    if (this.cssText.charAt(0) === "/" && this.cssText.charAt(1) === "*") {
      this.matchComments();
    } else {
      this.commonMatch(/\/+/);
    }

    return this.matchAllDeclarations();
  }

  matchAtRule() {
    if (this.cssText[0] !== "@") return false;
    // reset scopecssDisableNextLine
    this.scopecssDisableNextLine = false;

    return (
      this.mediaRule()
    );
  }

  // common matcher for @media, @supports, @document, @host, :global
  createMatcherForRuleWithChildRule(reg, name) {
    return () => {
      if (!this.commonMatch(reg)) return false;

      if (!this.matchOpenBrace())
        return parseError(`${name} missing '{'`, this.linkPath);

      this.matchComments();

      this.matchRules();

      if (!this.matchCloseBrace())
        return parseError(`${name} missing '}'`, this.linkPath);

      this.matchLeadingSpaces();

      return true;
    };
  }


  matchComments() {
    while (this.matchComment());
  }

  matchComment() {
    if (this.cssText.charAt(0) !== "/" || this.cssText.charAt(1) !== "*")
      return false;
    // reset scopecssDisableNextLine
    this.scopecssDisableNextLine = false;

    let i = 2;
    while (
      this.cssText.charAt(i) !== "" &&
      (this.cssText.charAt(i) !== "*" || this.cssText.charAt(i + 1) !== "/")
    )
      ++i;
    i += 2;

    if (this.cssText.charAt(i - 1) === "") {
      return parseError("End of comment missing", this.linkPath);
    }

    // get comment content
    let commentText = this.cssText.slice(2, i - 2);

    this.recordResult(`/*${commentText}*/`);

    commentText = trim(commentText.replace(/^\s*!/, ""));

    // set ignore config
    if (commentText === "scopecss-disable-next-line") {
      this.scopecssDisableNextLine = true;
    } else if (/^scopecss-disable/.test(commentText)) {
      if (commentText === "scopecss-disable") {
        this.scopecssDisable = true;
      } else {
        this.scopecssDisable = true;
        const ignoreRules = commentText
          .replace("scopecss-disable", "")
          .split(",");
        ignoreRules.forEach((rule) => {
          this.scopecssDisableSelectors.push(trim(rule));
        });
      }
    } else if (commentText === "scopecss-enable") {
      this.scopecssDisable = false;
      this.scopecssDisableSelectors = [];
    }

    this.cssText = this.cssText.slice(i);

    this.matchLeadingSpaces();

    return true;
  }

  commonMatch(reg, skip = false) {
    const matchArray = reg.exec(this.cssText);
    if (!matchArray) return;
    const matchStr = matchArray[0];
    this.cssText = this.cssText.slice(matchStr.length);
    if (!skip) this.recordResult(matchStr);
    return matchArray;
  }

  matchOpenBrace() {
    return this.commonMatch(/^{\s*/);
  }

  matchCloseBrace() {
    return this.commonMatch(/^}/);
  }

  matchLeadingSpaces() {
    this.commonMatch(/^\s*/);
  }

  recordResult(strFragment) {
      this.result += strFragment;
  }
}

/**
 * common method of bind CSS
 */
function commonAction(styleCode, appName, prefix, baseURI, linkPath) {
    let result = "";
    try {
      result = parser.exec(styleCode, prefix, baseURI, linkPath);
      parser.reset();
    } catch (e) {
      parser.reset();
      logError("An error occurred while parsing CSS:\n", appName, e);
    }

    return result
}

let parser;
export default function scopedCSS2(styleCodes, app, linkPath) {
  let prefixStyle = "";

    const prefix = createPrefix(app.name);

    if (!parser) parser = new CSSParser();

    if (styleCodes) {
      prefixStyle = commonAction(styleCodes, app.name, prefix, app.url, linkPath);
    } 

  return prefixStyle;
}

export function createPrefix(appName) {
  return `${'micro-demo'}[name=${appName}]`;
}
